from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from pydantic import ValidationError
from fastapi import HTTPException
import os
from models import (
    FullSetupRequest,
    Workflow,
    WorkflowNode,
    WorkflowRun,
    WorkflowNodeRun,
    MessageRecord,
    NodeResponse,
    TestWebhookRequest,
    SendMessageConfig,
    AskQuestionConfig,
    ConditionConfig,
)
from storage import (
    save_client,
    save_user,
    save_whatsapp_account,
    save_workflow,
    save_workflow_node,
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
    config = parse_node_config(node)

    if isinstance(config, AskQuestionConfig):
        return config.variable_name

    return None

def get_option_metadata(options):
    return [
        option.model_dump(mode="python")
        for option in options
    ]

def get_option_display_labels(options): #This returns full option objects into option labels:
    return [option.label for option in options]

def find_selected_option( #The user replied with some text of some question node then Which option did they select?
    config: AskQuestionConfig,
    user_text: str,
):
    for option in config.options:
        possible_matches = {
            option.label,
            option.value,
        }

        if option.id:
            possible_matches.add(option.id)

        if user_text in possible_matches:
            return option

    return None


NODE_CONFIG_MODELS = {
    "send_message": SendMessageConfig,
    "ask_question": AskQuestionConfig,
    "condition": ConditionConfig,
}

def parse_node_config(node: WorkflowNode):
    config_model = NODE_CONFIG_MODELS.get(node.type)

    if not config_model:
        raise ValueError(f"Unsupported node type: {node.type}")

    return config_model.model_validate(node.config) 

'''what this line do config_model.model_validate(node.config)?
Here node.config is a normal dict, and model_validate() checks it against the selected config model(class), then returns a proper Pydantic object.raw_config = {
    "question": "What do you need help with?",
    "input_type": "buttons",
    "variable_name": "issue_type",
    "options": [
        {
            "id": "track_order",
            "label": "Track Order",
            "value": "Track Order",
            "next_node_id": "node:3",
        }
    ],
}

This is just a dict.

Now validate it:

config = AskQuestionConfig.model_validate(raw_config)

This one line does two things:

1. Checks if raw_config is valid AskQuestionConfig data.
2. Returns an AskQuestionConfig object.'''

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

    if not workflow.first_node_id:
        errors.append("workflow.first_node_id is required.")

    elif workflow.first_node_id not in node_id_set:
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

        # ----------------------------
        # Config validation
        # ----------------------------

        try:
            config = parse_node_config(node)

        except ValidationError as error:
            errors.append(
                {
                    "node_id": node.id,
                    "node_type": node.type,
                    "message": "Invalid node config.",
                    "errors": error.errors(),
                }
            )
            continue

        except ValueError as error:
            errors.append(
                {
                    "node_id": node.id,
                    "node_type": node.type,
                    "message": str(error),
                }
            )
            continue

        # ----------------------------
        # Extra graph validation using parsed config
        # ----------------------------

        if isinstance(config, AskQuestionConfig):
            if config.input_type in ["buttons", "list"]:
                if not config.options:
                    errors.append(
                        f"ask_question node '{node.id}' uses {config.input_type} but has no options."
                    )

                option_labels = [option.label for option in config.options]
                option_values = [option.value for option in config.options]
                option_ids = [
                    option.id
                    for option in config.options
                    if option.id
                ]

                if len(option_labels) != len(set(option_labels)):
                    errors.append(
                        f"ask_question node '{node.id}' has duplicate option labels."
                    )

                if len(option_values) != len(set(option_values)):
                    errors.append(
                        f"ask_question node '{node.id}' has duplicate option values."
                    )

                if len(option_ids) != len(set(option_ids)):
                    errors.append(
                        f"ask_question node '{node.id}' has duplicate option ids."
                    )

                for index, option in enumerate(config.options):
                    if option.next_node_id not in node_id_set:
                        errors.append(
                            f"ask_question node '{node.id}' option {index + 1} has invalid next_node_id."
                        )

            else:
                if node.next_node_id and node.next_node_id not in node_id_set:
                    errors.append(
                        f"text ask_question node '{node.id}' has invalid next_node_id '{node.next_node_id}'."
                    )

        elif isinstance(config, ConditionConfig):
            if not config.conditions and not config.default_next_node_id:
                errors.append(
                    f"condition node '{node.id}' needs conditions or default_next_node_id."
                )

            for index, condition in enumerate(config.conditions):
                if condition.next_node_id not in node_id_set:
                    errors.append(
                        f"condition node '{node.id}' rule {index + 1} has invalid next_node_id."
                    )

            if (
                config.default_next_node_id
                and config.default_next_node_id not in node_id_set
            ):
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

def save_full_setup(setup: FullSetupRequest): # in routes , it will come as FullSetupRequest object , u can see routes
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
    config = parse_node_config(node)

    if not isinstance(config, ConditionConfig):
        raise HTTPException(
            status_code=400,
            detail=f"Node '{node.id}' is not a condition node.",
        )

    for condition in config.conditions:
        actual_value = variables.get(condition.variable)

        if condition.operator == "equals" and actual_value == condition.value:
            return condition.next_node_id

        if condition.operator == "not_equals" and actual_value != condition.value:
            return condition.next_node_id

    return config.default_next_node_id


def execute_workflow_from_node(
    run: WorkflowRun,
    workflow: Workflow,
    nodes: list[WorkflowNode],
    start_node_id: str | None,
):
    node_map = build_node_map(nodes)
    current_node_id = start_node_id
    responses = []
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
            config = parse_node_config(node)

            if not isinstance(config, SendMessageConfig):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid config for send_message node '{node.id}'.",
                )

            message_text = config.message

            node_run.status = "success"
            node_run.completed_at = now_utc()
            save_workflow_node_run(node_run)

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=message_text,
                message_type="text",
            )

            responses.append(
                {
                    "type": "text",
                    "text": message.text,
                }
            )

            current_node_id = node.next_node_id
            run.current_node_id = current_node_id
            save_workflow_run(run)

        elif node.type == "ask_question":
            config = parse_node_config(node)

            if not isinstance(config, AskQuestionConfig):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid config for ask_question node '{node.id}'.",
                )

            question = config.question
            input_type = config.input_type
            options = config.options
            variable_name = config.variable_name
            option_labels = get_option_display_labels(options)
            option_metadata = get_option_metadata(options)

            node_run.status = "waiting_for_user"
            node_run.completed_at = None
            save_workflow_node_run(node_run)

            message_type = "text"

            if input_type == "buttons":
                message_type = "buttons"

            if input_type == "list":
                message_type = "list"

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=question,
                message_type=message_type,
                metadata={
                    "input_type": input_type,
                    "options": option_metadata,
                    "store_answer_in": variable_name,
                },
            )

            responses.append(
                {
                    "type": "question",
                    "question": message.text,
                    "input_type": input_type,
                    "options": option_labels,
                    "option_details": option_metadata,
                    "store_answer_in": variable_name,
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
                "messages": responses,
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
        "messages": responses,
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

    config = parse_node_config(waiting_node)

    if not isinstance(config, AskQuestionConfig):
        raise HTTPException(
            status_code=400,
            detail="Waiting node config is not valid for ask_question.",
        )

    selected_value = user_text
    selected_label = user_text
    selected_next_node_id = waiting_node.next_node_id

    if config.input_type in ["buttons", "list"]: #currently if user didnt selected from the given buttons or list , it will throw error.
        selected_option = find_selected_option(
            config=config,
            user_text=user_text,
        )

        if not selected_option:
            allowed_options = get_option_display_labels(config.options)

            raise HTTPException(
                status_code=400,
                detail=f"Invalid option. Allowed options are: {allowed_options}",
            )

        selected_value = selected_option.value
        selected_label = selected_option.label
        selected_next_node_id = selected_option.next_node_id

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

    variable_name = config.variable_name

    waiting_node_run.status = "success"
    waiting_node_run.user_input = {
        "variable_name": variable_name,
        "value": selected_value,
        "label": selected_label,
        "raw_text": user_text,
        "message_id": incoming_message.id,
        "received_at": now_utc(),
    }
    waiting_node_run.next_node_id = selected_next_node_id
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
        question=config.question,
        response=selected_value,
    )
    save_node_response(response)

    run.variables[variable_name] = selected_value
    run.status = "active"
    run.waiting_at_node_id = None
    run.waiting_node_run_id = None
    run.current_node_id = selected_next_node_id
    save_workflow_run(run)

    return execute_workflow_from_node(
        run=run,
        workflow=workflow,
        nodes=nodes,
        start_node_id=selected_next_node_id,
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

def verify_whatsapp_webhook(
    mode: str | None,
    verify_token: str | None,
    challenge: str | None,
):
    expected_verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN")

    if not expected_verify_token:
        raise HTTPException(
            status_code=500,
            detail="WHATSAPP_VERIFY_TOKEN is not configured.",
        )

    if mode == "subscribe" and verify_token == expected_verify_token and challenge:
        return challenge

    raise HTTPException(
        status_code=403,
        detail="WhatsApp webhook verification failed.",
    )


def extract_whatsapp_message(payload: dict[str, Any]) -> dict[str, Any] | None:
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]

        phone_number_id = value["metadata"]["phone_number_id"]

        messages = value.get("messages", [])

        if not messages:
            return None

        message = messages[0]

        from_phone = message["from"]
        message_type = message.get("type", "unknown")

        text = ""

        if message_type == "text":
            text = message["text"]["body"]

        elif message_type == "button":
            button = message["button"]
            text = button.get("payload") or button.get("text") or ""

        elif message_type == "interactive":
            interactive = message.get("interactive", {})
            interactive_type = interactive.get("type")

            if interactive_type == "button_reply":
                button_reply = interactive.get("button_reply", {})
                text = button_reply.get("id") or button_reply.get("title") or ""
                message_type = "button_reply"

            elif interactive_type == "list_reply":
                list_reply = interactive.get("list_reply", {})
                text = list_reply.get("id") or list_reply.get("title") or ""
                message_type = "list_reply"

            else:
                text = ""

        else:
            text = ""

        return {
            "phone_number_id": phone_number_id,
            "from_phone": from_phone,
            "text": text,
            "message_type": message_type,
            "raw_message": message,
        }

    except (KeyError, IndexError, TypeError):
        return None


def process_whatsapp_webhook_payload(payload: dict[str, Any]):
    extracted = extract_whatsapp_message(payload)

    if not extracted:
        return {
            "ignored": True,
            "reason": "No supported incoming message found in webhook payload.",
        }

    if not extracted["text"]:
        return {
            "ignored": True,
            "reason": f"Unsupported or empty message type: {extracted['message_type']}",
        }

    return process_incoming_message(
        phone_number_id=extracted["phone_number_id"],
        from_phone=extracted["from_phone"],
        text=extracted["text"],
        message_type=extracted["message_type"],
        source="whatsapp_webhook",
    )