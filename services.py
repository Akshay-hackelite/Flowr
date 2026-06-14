from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from models import (
    FullSetupRequest,
    Workflow,
    WorkflowNode,
    WorkflowRun,
    WorkflowNodeRun,
    MessageRecord,
    NodeResponse,
    TestWebhookRequest,
)
from storage import (
    save_client,
    save_user,
    save_whatsapp_account,
    save_workflow,
    save_workflow_node,
    mark_missing_nodes_deleted,
    get_whatsapp_account_by_phone_number_id,
    get_published_workflows_for_account,
    get_workflow_by_id,
    get_workflow_nodes,
    find_active_workflow_run,
    save_workflow_run,
    save_workflow_node_run,
    get_workflow_node_run_by_id,
    save_message,
    save_node_response,
    get_run_messages,
    get_run_node_responses,
    get_workflow_run_by_id,
    get_workflow_node_runs_by_run_id,
)


def now_utc():
    return datetime.now(timezone.utc)


def short_id():
    return uuid4().hex[:10]


def make_workflow_run_id(workflow_id: str):
    return f"{workflow_id}/run:{short_id()}"


def make_node_run_id(workflow_run_id: str):
    return f"{workflow_run_id}/node_run:{short_id()}"


def make_message_id():
    return f"msg:{short_id()}"


def make_response_id():
    return f"response:{short_id()}"


def get_variable_name_from_node(node: WorkflowNode) -> str | None:
    return (
        node.config.get("variable_name")
        or node.config.get("variableName")
    )


def validate_full_setup(setup: FullSetupRequest):
    errors = []

    client = setup.client
    user = setup.user
    account = setup.whatsapp_account
    workflow = setup.workflow
    nodes = setup.nodes

    if user.client_id != client.id:
        errors.append("user.client_id must match client.id.")

    if account.client_id != client.id:
        errors.append("whatsapp_account.client_id must match client.id.")

    if workflow.client_id != client.id:
        errors.append("workflow.client_id must match client.id.")

    if workflow.whatsapp_account_id != account.id:
        errors.append("workflow.whatsapp_account_id must match whatsapp_account.id.")

    node_ids = [node.id for node in nodes]
    node_id_set = set(node_ids)

    if len(node_ids) != len(node_id_set):
        errors.append("Duplicate node IDs found.")

    if workflow.first_node_id not in node_id_set:
        errors.append("workflow.first_node_id must exist in nodes.")

    for node in nodes:
        if node.client_id != client.id:
            errors.append(f"node '{node.id}' has wrong client_id.")

        if node.workflow_id != workflow.id:
            errors.append(f"node '{node.id}' has wrong workflow_id.")

        if node.next_node_id and node.next_node_id not in node_id_set:
            errors.append(
                f"node '{node.id}' has invalid next_node_id '{node.next_node_id}'."
            )

        if node.type == "send_message":
            if not node.config.get("message"):
                errors.append(
                    f"send_message node '{node.id}' must have config.message."
                )

        elif node.type == "ask_question":
            if not node.config.get("question"):
                errors.append(
                    f"ask_question node '{node.id}' must have config.question."
                )

            if not get_variable_name_from_node(node):
                errors.append(
                    f"ask_question node '{node.id}' must have config.variable_name."
                )

            input_type = node.config.get("inputType") or node.config.get("input_type")

            if input_type in ["buttons", "list"]:
                options = node.config.get("options", [])

                if not options:
                    errors.append(
                        f"ask_question node '{node.id}' uses {input_type} but has no options."
                    )

                if len(options) != len(set(options)):
                    errors.append(
                        f"ask_question node '{node.id}' has duplicate options."
                    )

        elif node.type == "condition":
            conditions = node.config.get("conditions", [])
            default_next_node_id = node.config.get("default_next_node_id")

            if not conditions and not default_next_node_id:
                errors.append(
                    f"condition node '{node.id}' needs conditions or default_next_node_id."
                )

            for index, condition in enumerate(conditions):
                next_node_id = condition.get("next_node_id")

                if next_node_id not in node_id_set:
                    errors.append(
                        f"condition node '{node.id}' rule {index + 1} has invalid next_node_id."
                    )

            if default_next_node_id and default_next_node_id not in node_id_set:
                errors.append(
                    f"condition node '{node.id}' has invalid default_next_node_id."
                )

    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid setup JSON.",
                "errors": errors,
            },
        )


def save_full_setup(setup: FullSetupRequest):
    validate_full_setup(setup)

    workflow = setup.workflow
    nodes = setup.nodes

    if workflow.status == "published":
        existing_published = get_published_workflows_for_account(
            client_id=workflow.client_id,
            whatsapp_account_id=workflow.whatsapp_account_id,
        )

        for existing in existing_published:
            if existing.id != workflow.id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Another published workflow already exists for this "
                        "client + WhatsApp account. Set it to draft first."
                    ),
                )

    workflow.node_ids = [node.id for node in nodes]

    save_client(setup.client)
    save_user(setup.user)
    save_whatsapp_account(setup.whatsapp_account)
    save_workflow(workflow)

    for node in nodes:
        save_workflow_node(node)

    mark_missing_nodes_deleted(
        workflow_id=workflow.id,
        active_node_ids=workflow.node_ids,
    )

    return {
        "message": "Setup saved successfully.",
        "client_id": setup.client.id,
        "whatsapp_account_id": setup.whatsapp_account.id,
        "workflow_id": workflow.id,
        "total_nodes": len(nodes),
    }


def build_node_map(nodes: list[WorkflowNode]) -> dict[str, WorkflowNode]:
    return {
        node.id: node
        for node in nodes
    }


def create_outgoing_message(
    run: WorkflowRun,
    node_run: WorkflowNodeRun,
    text: str,
    message_type: str = "text",
    metadata: dict[str, Any] | None = None,
):
    message = MessageRecord(
        id=make_message_id(),
        client_id=run.client_id,
        whatsapp_account_id=run.whatsapp_account_id,
        workflow_id=run.workflow_id,
        workflow_run_id=run.id,
        node_run_id=node_run.id,
        contact_phone=run.contact_phone,
        direction="outgoing",
        message_type=message_type,
        text=text,
        metadata=metadata or {},
        status="created",
    )

    save_message(message)

    return message


def create_incoming_message(
    client_id: str,
    whatsapp_account_id: str,
    contact_phone: str,
    text: str,
    workflow_id: str | None = None,
    workflow_run_id: str | None = None,
    node_run_id: str | None = None,
    message_type: str = "text",
):
    message = MessageRecord(
        id=make_message_id(),
        client_id=client_id,
        whatsapp_account_id=whatsapp_account_id,
        workflow_id=workflow_id,
        workflow_run_id=workflow_run_id,
        node_run_id=node_run_id,
        contact_phone=contact_phone,
        direction="incoming",
        message_type=message_type,
        text=text,
        status="received",
    )

    save_message(message)

    return message


def evaluate_condition_node(
    node: WorkflowNode,
    variables: dict[str, Any],
) -> str | None:
    conditions = node.config.get("conditions", [])
    default_next_node_id = node.config.get("default_next_node_id")

    for condition in conditions:
        variable = condition.get("variable")
        operator = condition.get("operator", "equals")
        expected_value = condition.get("value")
        next_node_id = condition.get("next_node_id")

        actual_value = variables.get(variable)

        if operator == "equals" and actual_value == expected_value:
            return next_node_id

        if operator == "not_equals" and actual_value != expected_value:
            return next_node_id

    return default_next_node_id


def execute_workflow_from_node(
    run: WorkflowRun,
    workflow: Workflow,
    nodes: list[WorkflowNode],
    start_node_id: str | None,
):
    node_map = build_node_map(nodes)
    current_node_id = start_node_id
    outgoing_messages = []
    safety_counter = 0

    while current_node_id:
        safety_counter += 1

        if safety_counter > 100:
            run.status = "failed"
            save_workflow_run(run)

            raise HTTPException(
                status_code=400,
                detail="Workflow seems to have an infinite loop.",
            )

        node = node_map.get(current_node_id)

        if not node:
            run.status = "failed"
            save_workflow_run(run)

            raise HTTPException(
                status_code=400,
                detail=f"Node not found: {current_node_id}",
            )

        node_run = WorkflowNodeRun(
            id=make_node_run_id(run.id),
            client_id=run.client_id,
            whatsapp_account_id=run.whatsapp_account_id,
            workflow_id=run.workflow_id,
            workflow_run_id=run.id,
            node_id=node.id,
            node_type=node.type,
            node_name=node.name,
            status="active",
            user_input=None,
            next_node_id=node.next_node_id,
            started_at=now_utc(),
        )

        if node.type == "send_message":
            message_text = node.config.get("message")

            node_run.status = "success"
            node_run.completed_at = now_utc()
            save_workflow_node_run(node_run)

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=message_text,
                message_type="text",
            )

            outgoing_messages.append(
                {
                    "type": "text",
                    "text": message.text,
                }
            )

            current_node_id = node.next_node_id
            run.current_node_id = current_node_id
            save_workflow_run(run)

        elif node.type == "ask_question":
            question = node.config.get("question")
            input_type = node.config.get("inputType") or node.config.get("input_type", "text")
            options = node.config.get("options", [])
            variable_name = get_variable_name_from_node(node)

            node_run.status = "waiting_for_user"
            node_run.completed_at = None
            save_workflow_node_run(node_run)

            message_type = "text"

            if input_type == "buttons":
                message_type = "interactive_buttons"

            if input_type == "list":
                message_type = "interactive_list"

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=question,
                message_type=message_type,
                metadata={
                    "inputType": input_type,
                    "options": options,
                    "storeAnswerIn": variable_name,
                },
            )

            outgoing_messages.append(
                {
                    "type": "question",
                    "question": message.text,
                    "inputType": input_type,
                    "options": options,
                    "storeAnswerIn": variable_name,
                }
            )

            run.status = "waiting_for_user"
            run.current_node_id = node.id
            run.waiting_at_node_id = node.id
            run.waiting_node_run_id = node_run.id
            save_workflow_run(run)

            return {
                "status": "waiting_for_user",
                "workflow_run_id": run.id,
                "messages": outgoing_messages,
                "variables": run.variables,
            }

        elif node.type == "condition":
            next_node_id = evaluate_condition_node(
                node=node,
                variables=run.variables,
            )

            node_run.status = "success"
            node_run.next_node_id = next_node_id
            node_run.completed_at = now_utc()
            save_workflow_node_run(node_run)

            current_node_id = next_node_id
            run.current_node_id = current_node_id
            save_workflow_run(run)

    run.status = "completed"
    run.current_node_id = None
    run.waiting_at_node_id = None
    run.waiting_node_run_id = None
    run.completed_at = now_utc()
    save_workflow_run(run)

    return {
        "status": "completed",
        "workflow_run_id": run.id,
        "messages": outgoing_messages,
        "variables": run.variables,
    }


def continue_existing_run(
    run: WorkflowRun,
    user_text: str,
    message_type: str = "text",
):
    if run.status != "waiting_for_user":
        raise HTTPException(
            status_code=400,
            detail="Workflow run is not waiting for user input.",
        )

    workflow = get_workflow_by_id(run.workflow_id)

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail="Workflow not found.",
        )

    nodes = get_workflow_nodes(workflow.id)
    node_map = build_node_map(nodes)

    waiting_node = node_map.get(run.waiting_at_node_id)

    if not waiting_node:
        raise HTTPException(
            status_code=400,
            detail="Waiting node not found.",
        )

    if waiting_node.type != "ask_question":
        raise HTTPException(
            status_code=400,
            detail="Waiting node is not an ask_question node.",
        )

    waiting_node_run = get_workflow_node_run_by_id(run.waiting_node_run_id)

    if not waiting_node_run:
        raise HTTPException(
            status_code=400,
            detail="Waiting node run not found.",
        )

    options = waiting_node.config.get("options", [])

    if options and user_text not in options:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid option. Allowed options are: {options}",
        )

    incoming_message = create_incoming_message(
        client_id=run.client_id,
        whatsapp_account_id=run.whatsapp_account_id,
        workflow_id=run.workflow_id,
        workflow_run_id=run.id,
        node_run_id=waiting_node_run.id,
        contact_phone=run.contact_phone,
        text=user_text,
        message_type=message_type,
    )

    variable_name = get_variable_name_from_node(waiting_node)

    waiting_node_run.status = "success"
    waiting_node_run.user_input = {
        "variable_name": variable_name,
        "value": user_text,
        "message_id": incoming_message.id,
        "received_at": now_utc(),
    }
    waiting_node_run.next_node_id = waiting_node.next_node_id
    waiting_node_run.completed_at = now_utc()
    save_workflow_node_run(waiting_node_run)

    response = NodeResponse(
        id=make_response_id(),
        client_id=run.client_id,
        whatsapp_account_id=run.whatsapp_account_id,
        workflow_id=run.workflow_id,
        workflow_run_id=run.id,
        node_id=waiting_node.id,
        node_run_id=waiting_node_run.id,
        variable_name=variable_name,
        question=waiting_node.config.get("question"),
        response=user_text,
    )
    save_node_response(response)

    run.variables[variable_name] = user_text
    run.status = "active"
    run.waiting_at_node_id = None
    run.waiting_node_run_id = None
    run.current_node_id = waiting_node.next_node_id
    save_workflow_run(run)

    return execute_workflow_from_node(
        run=run,
        workflow=workflow,
        nodes=nodes,
        start_node_id=waiting_node.next_node_id,
    )


def start_new_run(
    workflow: Workflow,
    contact_phone: str,
    first_message_text: str | None = None,
    first_message_type: str = "text",
):
    run = WorkflowRun(
        id=make_workflow_run_id(workflow.id),
        client_id=workflow.client_id,
        whatsapp_account_id=workflow.whatsapp_account_id,
        workflow_id=workflow.id,
        contact_phone=contact_phone,
        status="active",
        current_node_id=workflow.first_node_id,
        variables={},
        started_at=now_utc(),
    )

    save_workflow_run(run)
    if first_message_text is not None:
        create_incoming_message(
            client_id=run.client_id,
            whatsapp_account_id=run.whatsapp_account_id,
            workflow_id=run.workflow_id,
            workflow_run_id=run.id,
            contact_phone=run.contact_phone,
            text=first_message_text,
            message_type=first_message_type,
        )

    nodes = get_workflow_nodes(workflow.id)

    return execute_workflow_from_node(
        run=run,
        workflow=workflow,
        nodes=nodes,
        start_node_id=workflow.first_node_id,
    )

def process_incoming_message(
    phone_number_id: str,
    from_phone: str,
    text: str,
    message_type: str = "text",
    source: str = "test_webhook",
):
    account = get_whatsapp_account_by_phone_number_id(
        phone_number_id
    )

    if not account:
        raise HTTPException(
            status_code=404,
            detail="WhatsApp account not found for this phone_number_id.",
        )

    active_run = find_active_workflow_run(
        client_id=account.client_id,
        whatsapp_account_id=account.id,
        contact_phone=from_phone,
    )

    if active_run:
        result = continue_existing_run(
            run=active_run,
            user_text=text,
            message_type=message_type,
        )

        return {
            "mode": "continued_existing_workflow_run",
            "source": source,
            "from_phone": from_phone,
            "phone_number_id": phone_number_id,
            **result,
        }

    published_workflows = get_published_workflows_for_account(
        client_id=account.client_id,
        whatsapp_account_id=account.id,
    )

    if not published_workflows:
        raise HTTPException(
            status_code=404,
            detail="No published workflow found for this WhatsApp account.",
        )

    if len(published_workflows) > 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "Multiple published workflows found for this WhatsApp account. "
                "For now, keep only one workflow published."
            ),
        )

    workflow = published_workflows[0]

    result = start_new_run(
        workflow=workflow,
        contact_phone=from_phone,
        first_message_text=text,
        first_message_type=message_type,
    )

    return {
        "mode": "started_new_workflow_run",
        "source": source,
        "from_phone": from_phone,
        "phone_number_id": phone_number_id,
        **result,
    }

def process_test_webhook(request: TestWebhookRequest):
    return process_incoming_message(
        phone_number_id=request.phone_number_id,
        from_phone=request.from_phone,
        text=request.text,
        message_type=request.message_type,
        source="test_webhook",
    )


def get_run_debug_data(workflow_run_id: str):
    workflow_run = get_workflow_run_by_id(workflow_run_id)

    if not workflow_run:
        raise HTTPException(
            status_code=404,
            detail="Workflow run not found.",
        )

    return {
        "workflow_run": workflow_run,
        "workflow_node_runs": get_workflow_node_runs_by_run_id(workflow_run_id),
        "messages": get_run_messages(workflow_run_id),
        "node_responses": get_run_node_responses(workflow_run_id),
    }