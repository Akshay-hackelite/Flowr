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
    AskQuestionListConfig
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
    update_message_after_send,
    get_whatsapp_account_by_id,
    update_message_status_by_meta_message_id,
    get_whatsapp_account_for_client,
    get_active_trigger_rules,
)
from whatsapp_service import (
    send_whatsapp_text_message,
    send_whatsapp_button_message,
    send_whatsapp_list_message,
    send_whatsapp_image_message,
    send_whatsapp_audio_message,
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

def get_button_option_metadata(options):
    return [
        option.model_dump(mode="python")
        for option in options
    ]

def get_list_config_metadata(list_config: AskQuestionListConfig | None):
    if not list_config:
        return None

    return list_config.model_dump(
        mode="python",
        exclude_none=True,
    )

def get_option_display_labels(options): 
    #This returns full option objects into option labels. both for buttons or list config
    return [option.label for option in options]


def get_ask_question_choices(config: AskQuestionConfig):
    """This function will help in fetching all options(in case of buttons) or all rows of all sections(in case of list. Why all rows only? no section titles? it is becaues for matching user selected text , we only need rows becuase only it has label and id) , of ask question node. """
    if config.input_type == "buttons":
        return config.options

    if config.input_type == "list" and config.list_config:
        choices = []

        for section in config.list_config.sections:
            choices.extend(section.rows)

        return choices

    return []

def find_selected_option(
    config: AskQuestionConfig,
    user_text: str,
):
    choices = get_ask_question_choices(config)

    cleaned_user_text = user_text.strip()
    normalized_user_text = cleaned_user_text.lower()

    for choice in choices:
        # 1. Exact id match.
        # This handles real WhatsApp button/list clicks.
        if choice.id and cleaned_user_text == choice.id:
            return choice

        # 2. Case-insensitive label match.
        # This handles manual typing like "track order".
        normalized_label = choice.label.strip().lower()

        if normalized_user_text == normalized_label:
            return choice

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

def validate_workflow_graph(workflow: Workflow, nodes: list[WorkflowNode]) -> list[Any]:
    errors = []
    node_ids = [node.id for node in nodes]
    node_id_set = set(node_ids)

    if len(node_ids) != len(node_id_set):
        errors.append("Duplicate node IDs found.")

    if not workflow.first_node_id:
        errors.append("workflow.first_node_id is required.")
    elif workflow.first_node_id not in node_id_set:
        errors.append("workflow.first_node_id must exist in nodes.")

    for node in nodes:
        if node.next_node_id and node.next_node_id not in node_id_set:
            errors.append(f"node '{node.id}' has invalid next_node_id '{node.next_node_id}'.")

        try:
            config = parse_node_config(node)
        except (ValidationError, ValueError) as error:
            errors.append({"node_id": node.id, "node_type": node.type, "message": str(error)})
            continue

        if isinstance(config, AskQuestionConfig):
            if not config.variable_name or not config.variable_name.strip():
                errors.append(f"ask_question node '{node.id}' is missing a variable name.")

            if config.input_type == "buttons":
                if config.list_config:
                    errors.append(f"ask_question node '{node.id}' uses buttons but has list_config.")
                if not config.options:
                    errors.append(f"ask_question node '{node.id}' uses buttons but has no options.")
                if len(config.options) > 3:
                    errors.append(f"ask_question node '{node.id}' uses buttons but has more than 3 options.")

                option_labels = [option.label for option in config.options]
                option_ids = [option.id for option in config.options if option.id]
                if len(option_labels) != len(set(option_labels)):
                    errors.append(f"ask_question node '{node.id}' has duplicate button labels.")
                if len(option_ids) != len(set(option_ids)):
                    errors.append(f"ask_question node '{node.id}' has duplicate button ids.")

                for index, option in enumerate(config.options):
                    if not option.id:
                        errors.append(f"ask_question node '{node.id}' button option {index + 1} is missing id.")
                    if option.next_node_id and option.next_node_id not in node_id_set:
                        errors.append(f"ask_question node '{node.id}' button option {index + 1} points to non-existent node.")

            elif config.input_type == "list":
                if config.options:
                    errors.append(f"ask_question node '{node.id}' uses list but has options.")
                if not config.list_config:
                    errors.append(f"ask_question node '{node.id}' uses list but has no list_config.")
                else:
                    if not config.list_config.button_text:
                        errors.append(f"ask_question node '{node.id}' uses list but missing button_text.")
                    if not config.list_config.sections:
                        errors.append(f"ask_question node '{node.id}' uses list but has no sections.")
                    all_rows = []
                    for section in config.list_config.sections:
                        if not section.rows:
                            errors.append(f"ask_question node '{node.id}' list section '{section.title}' has no rows.")
                        all_rows.extend(section.rows)
                    if len(all_rows) > 10:
                        errors.append(f"ask_question node '{node.id}' uses list but has more than 10 total rows.")
                    row_labels = [row.label for row in all_rows]
                    row_ids = [row.id for row in all_rows if row.id]
                    if len(row_labels) != len(set(row_labels)):
                        errors.append(f"ask_question node '{node.id}' has duplicate list row labels.")
                    if len(row_ids) != len(set(row_ids)):
                        errors.append(f"ask_question node '{node.id}' has duplicate list row ids.")
                    for index, row in enumerate(all_rows):
                        if not row.id:
                            errors.append(f"ask_question node '{node.id}' list row {index + 1} is missing id.")
                        if row.next_node_id and row.next_node_id not in node_id_set:
                            errors.append(f"ask_question node '{node.id}' list row {index + 1} points to non-existent node.")
            else:
                if config.options:
                    errors.append(f"text ask_question node '{node.id}' should not have options.")
                if config.list_config:
                    errors.append(f"text ask_question node '{node.id}' should not have list_config.")
                if node.next_node_id and node.next_node_id not in node_id_set:
                    errors.append(f"text ask_question node '{node.id}' points to non-existent node.")

        elif isinstance(config, ConditionConfig):
            if not config.conditions and not config.default_next_node_id:
                errors.append(f"condition node '{node.id}' needs conditions or default_next_node_id.")
            for index, condition in enumerate(config.conditions):
                if condition.next_node_id and condition.next_node_id not in node_id_set:
                    errors.append(f"condition node '{node.id}' rule {index + 1} points to non-existent node.")
            if config.default_next_node_id and config.default_next_node_id not in node_id_set:
                errors.append(f"condition node '{node.id}' points to non-existent default node.")

    return errors

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

    for node in nodes:
        if node.client_id != client.id:
            errors.append(f"node '{node.id}' has wrong client_id.")
        if node.workflow_id != workflow.id:
            errors.append(f"node '{node.id}' has wrong workflow_id.")

    errors.extend(validate_workflow_graph(workflow, nodes))

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
    res = {}
    for node in nodes:
        res[node.id] = node
        if ":" in node.id:
            res[node.id.split(":")[-1]] = node
        if "/" in node.id:
            res[node.id.split("/")[-1]] = node
    return res


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

def resolve_variables(text: str, run: WorkflowRun) -> str:
    if not text:
        return ""
    res = text
    vars_dict = {
        "contact_phone": run.contact_phone,
        **(run.variables or {}),
    }
    for k, v in vars_dict.items():
        res = res.replace(f"@{k}", str(v)).replace(f"{{{{{k}}}}}", str(v))
    return res


def send_outgoing_message_to_whatsapp(
    run: WorkflowRun,
    message: MessageRecord,
):
    if message.direction != "outgoing":
        return

    if message.message_type not in ["text", "interactive_buttons", "interactive_list", "image", "audio"]:
        return

    account = get_whatsapp_account_by_id(run.whatsapp_account_id)

    if not account:
        message.status = "failed"
        message.metadata["send_error"] = "WhatsApp account not found for sending."

        update_message_after_send(
            message_id=message.id,
            status=message.status,
            metadata=message.metadata,
        )
        return

    try:
        if message.message_type == "text":
            meta_response = send_whatsapp_text_message(
                phone_number_id=account.phone_number_id,
                to_phone=run.contact_phone,
                text=message.text or "",
            )

        elif message.message_type == "interactive_buttons":
            option_metadata = message.metadata.get("options", [])

            buttons = []

            for option in option_metadata:
                buttons.append(
                    {
                        "id": option["id"],
                        "title": option["label"],
                    }
                )

            meta_response = send_whatsapp_button_message(
                phone_number_id=account.phone_number_id,
                to_phone=run.contact_phone,
                body_text=message.text or "",
                buttons=buttons,
            )
        elif message.message_type == "interactive_list":
            list_config = message.metadata.get("list_config") or {}

            meta_response = send_whatsapp_list_message(
                phone_number_id=account.phone_number_id,
                to_phone=run.contact_phone,
                body_text=message.text or "",
                list_config=list_config,
            )
        elif message.message_type == "image":
            image_url = message.metadata.get("media_url")
            if not image_url:
                return
            meta_response = send_whatsapp_image_message(
                phone_number_id=account.phone_number_id,
                to_phone=run.contact_phone,
                image_url=image_url,
                caption=message.text or None,
            )
        elif message.message_type == "audio":
            audio_url = message.metadata.get("media_url")
            if not audio_url:
                return
            meta_response = send_whatsapp_audio_message(
                phone_number_id=account.phone_number_id,
                to_phone=run.contact_phone,
                audio_url=audio_url,
            )
        else:
            return

        message.metadata["meta_response"] = meta_response

        meta_messages = meta_response.get("messages", [])

        if meta_messages:
            message.metadata["meta_message_id"] = meta_messages[0].get("id")

        message.status = "sent"

    except HTTPException as error:
        message.metadata["send_error"] = error.detail
        message.status = "failed"

    update_message_after_send(
        message_id=message.id,
        status=message.status,
        metadata=message.metadata,
    )

def get_send_failure_reason(message: MessageRecord) -> str:
    send_error = message.metadata.get("send_error")

    if isinstance(send_error, dict):
        return (
            send_error.get("message")
            or send_error.get("detail")
            or str(send_error)
        )

    if send_error:
        return str(send_error)

    return "Outgoing WhatsApp message failed to send."


def fail_workflow_after_send_failure(
    run: WorkflowRun,
    node_run: WorkflowNodeRun,
    message: MessageRecord,
    responses: list[dict[str, Any]],
):
    error_message = get_send_failure_reason(message)

    node_run.status = "failed"
    node_run.error = error_message
    node_run.completed_at = now_utc()
    save_workflow_node_run(node_run)

    run.status = "failed"
    run.current_node_id = node_run.node_id
    run.waiting_at_node_id = None
    run.waiting_node_run_id = None
    run.completed_at = now_utc()
    save_workflow_run(run)

    responses.append(
        {
            "type": message.message_type,
            "text": message.text,
            "status": "failed",
            "message_id": message.id,
            "send_error": message.metadata.get("send_error"),
        }
    )

    return {
        "status": "failed",
        "workflow_run_id": run.id,
        "failed_at_node_id": node_run.node_id,
        "failed_node_run_id": node_run.id,
        "failed_message_id": message.id,
        "error": error_message,
        "messages": responses,
        "variables": run.variables,
    }

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

            message_text = resolve_variables(config.message, run)
            media_type = getattr(config, "media_type", "text") or "text"
            media_url = getattr(config, "media_url", None)
            metadata = {}
            if media_type in ["image", "audio"] and media_url:
                metadata["media_url"] = media_url

            node_run.status = "success"
            node_run.completed_at = now_utc()
            save_workflow_node_run(node_run)

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=message_text,
                message_type=media_type,
                metadata=metadata,
            )
            send_outgoing_message_to_whatsapp(
                run=run,
                message=message,
            )
        
            if message.status == "failed":
                return fail_workflow_after_send_failure(
                    run=run,
                    node_run=node_run,
                    message=message,
                    responses=responses,
                )

            responses.append(
                {
                    "type": media_type,
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

            question = resolve_variables(config.question, run)
            input_type = config.input_type
            variable_name = config.variable_name
            
            # ---------------------------------------
            # 1. Decide message type and metadata
            # ---------------------------------------
            if input_type == "buttons":
                message_type = "interactive_buttons"

                message_metadata = {
                    "input_type": input_type,
                    "options": get_button_option_metadata(config.options),
                    "store_answer_in": variable_name,
                }

            elif input_type == "list":
                message_type = "interactive_list"

                message_metadata = {
                    "input_type": input_type,
                    "list_config": get_list_config_metadata(config.list_config),
                    "store_answer_in": variable_name,
                }

            else:
                message_type = "text"

                message_metadata = {
                    "input_type": input_type,
                    "store_answer_in": variable_name,
                }

            # ---------------------------------------
            # 2. Create outgoing message record
            # ---------------------------------------

            message = create_outgoing_message(
                run=run,
                node_run=node_run,
                text=question,
                message_type=message_type,
                metadata=message_metadata,
            )
            # ---------------------------------------
            # 3. Send the message to WhatsApp
            # ---------------------------------------
            send_outgoing_message_to_whatsapp(
                run=run,
                message=message,
            )
            """the message that we created above is very useful both for our db and also we will use this message to send the node buttons or list to user.outgoing message already has:

                message.text
                message.message_type
                message.metadata.options
                message.contact_phone


                The sender should simply ask:

                What message do I need to send?
                To whom?
                Through which WhatsApp account?
                With what options/buttons?

                That data is inside the MessageRecord i.e the message we need to send."""

            if message.status == "failed":
                return fail_workflow_after_send_failure(
                    run=run,
                    node_run=node_run,
                    message=message,
                    responses=responses,
                )
            # ---------------------------------------
            # 4. Now mark node/run as waiting
            # ---------------------------------------

            node_run.status = "waiting_for_user"
            node_run.completed_at = None
            save_workflow_node_run(node_run)

            run.status = "waiting_for_user"
            run.current_node_id = node.id
            run.waiting_at_node_id = node.id
            run.waiting_node_run_id = node_run.id
            save_workflow_run(run)

            # ---------------------------------------
            # 5. Build API response based on input type
            # ---------------------------------------

            question_response = {
                "type": "question",
                "question": message.text,
                "input_type": input_type,
                "store_answer_in": variable_name,
            }

            if input_type == "buttons":
                question_response["options"] = get_option_display_labels(config.options)
                question_response["option_details"] = message_metadata["options"]

            elif input_type == "list":
                question_response["options"] = get_option_display_labels(
                    get_ask_question_choices(config)
                )
                question_response["list_config"] = message_metadata["list_config"]

            responses.append(question_response)

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

    selected_label = user_text
    selected_next_node_id = waiting_node.next_node_id

    if config.input_type in ["buttons", "list"]: 
        selected_option = find_selected_option(
            config=config,
            user_text=user_text,
        )

        if selected_option:
            selected_label = selected_option.label
            selected_next_node_id = selected_option.next_node_id
        else:
            # User typed an invalid or custom option:
            # Route to default fallback handle if configured (stored in next_node_id or default_next_node_id)
            selected_label = user_text
            # Check if there is a default fallback handle configured on node or config
            default_fallback = None
            if hasattr(config, "default_next_node_id") and getattr(config, "default_next_node_id", None):
                default_fallback = config.default_next_node_id
            elif isinstance(waiting_node.config, dict):
                default_fallback = waiting_node.config.get("default_next_node_id")
            selected_next_node_id = default_fallback or waiting_node.next_node_id

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
        "value": selected_label,
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
        response=selected_label,
    )
    save_node_response(response)

    if variable_name and variable_name.strip():
        run.variables[variable_name.strip()] = selected_label
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
        variables={"last_message": first_message_text or ""},
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
        if active_run.status == "waiting_for_user":
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
        else:
            # run exists, but bot is not waiting for user(i.e if user sends messages before we ask any question)
            # so do NOT continue and do NOT start a new run , instead just ignore the message
            incoming_message = create_incoming_message(
                client_id=active_run.client_id,
                whatsapp_account_id=active_run.whatsapp_account_id,
                workflow_id=active_run.workflow_id,
                workflow_run_id=active_run.id,
                node_run_id=None,
                contact_phone=active_run.contact_phone,
                text=text,
                message_type=message_type,
                )

            return {
                "mode": "ignored_user_message",
                "source": source,
                "from_phone": from_phone,
                "phone_number_id": phone_number_id,
                "workflow_run_id": active_run.id,
                "run_status": active_run.status,
                "message_id": incoming_message.id,
                "reason": "Workflow run is active but not waiting for user input.",
            }


    active_rules = get_active_trigger_rules(account.client_id)
    matched_workflow = None
    for rule in active_rules:
        if rule.match_type == "exact" and text.strip().lower() == rule.keyword.strip().lower():
            wf = get_workflow_by_id(rule.workflow_id)
            if wf and wf.status == "published" and not wf.deleted:
                matched_workflow = wf
                break
        elif rule.match_type == "contains" and rule.keyword.strip().lower() in text.strip().lower():
            wf = get_workflow_by_id(rule.workflow_id)
            if wf and wf.status == "published" and not wf.deleted:
                matched_workflow = wf
                break

    if matched_workflow:
        workflow = matched_workflow
    else:
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
                text = button_reply.get("title") or button_reply.get("id") or ""
                message_type = "button_reply"

            elif interactive_type == "list_reply":
                list_reply = interactive.get("list_reply", {})
                text = list_reply.get("title") or list_reply.get("id") or ""
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

def process_status_update_webhook(payload: dict[str, Any]):
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]

    except (KeyError, IndexError, TypeError):
        return {
            "ignored": True,
            "reason": "Invalid WhatsApp webhook payload structure.",
        }

    statuses = value.get("statuses", [])

    if not statuses:
        return {
            "ignored": True,
            "reason": "No statuses found in webhook payload.",
        }

    results = []

    for status_event in statuses:
        meta_message_id = status_event.get("id")
        delivery_status = status_event.get("status")

        if not meta_message_id or not delivery_status:
            results.append(
                {
                    "updated": False,
                    "reason": "Status event missing id or status.",
                    "status_event": status_event,
                }
            )
            continue

        db_result = update_message_status_by_meta_message_id(
            meta_message_id=meta_message_id,
            status=delivery_status,
            status_payload=status_event,
        )

        results.append(
            {
                "updated": db_result["matched_count"] > 0,
                "applied_to_main_status": db_result.get("applied", False),
                "meta_message_id": meta_message_id,
                "incoming_status": delivery_status,
                "previous_status": db_result.get("previous_status"),
                "status": db_result.get("final_status"),
                "matched_count": db_result["matched_count"],
                "modified_count": db_result["modified_count"],
                "reason": db_result.get("reason"),
            }
        )

    return {
        "mode": "status_update",
        "processed": len(statuses),
        "results": results,
    }

def route_whatsapp_webhook_payload(payload: dict[str, Any]):
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]

    except (KeyError, IndexError, TypeError):
        return {
            "ignored": True,
            "reason": "Invalid WhatsApp webhook payload structure.",
        }
    if value.get("messages"): # if the webhook contains message i.e it is the webhook which was fired becuase user sent a message to our bot
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
    if value.get("statuses"): # if the webhook contains status i.e. it is the webhook that was fired because the message we sent to user , now it is either sent or delivered or read. thus this webhook just informs us about the updated status of our sent msg.
        return process_status_update_webhook(payload)

    return {
        "ignored": True,
        "reason": "Webhook payload did not contain messages or statuses.",
    }


def send_human_reply_message(client_id: str, contact_phone: str, text: str) -> MessageRecord:
    account = get_whatsapp_account_for_client(client_id)
    account_id = account.id if account else "test_account_id"

    message = MessageRecord(
        id=make_message_id(),
        client_id=client_id,
        whatsapp_account_id=account_id,
        workflow_id="human_handoff",
        workflow_run_id="human_handoff",
        node_run_id=None,
        contact_phone=contact_phone,
        direction="outgoing",
        message_type="text",
        text=text,
        metadata={"human_handoff": True},
        status="sent",
    )
    save_message(message)

    if account and os.getenv("WHATSAPP_ACCESS_TOKEN"):
        try:
            meta_response = send_whatsapp_text_message(
                phone_number_id=account.phone_number_id,
                to_phone=contact_phone,
                text=text,
            )
            message.metadata["meta_response"] = meta_response
            meta_messages = meta_response.get("messages", [])
            if meta_messages:
                message.metadata["meta_message_id"] = meta_messages[0].get("id")
            update_message_after_send(message.id, "sent", message.metadata)
        except Exception as e:
            message.metadata["send_error"] = str(e)
            update_message_after_send(message.id, "failed", message.metadata)

    return message