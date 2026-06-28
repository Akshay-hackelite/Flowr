from datetime import datetime, timezone
from typing import Optional

from database import (
    clients_collection,
    users_collection,
    whatsapp_accounts_collection,
    workflows_collection,
    workflow_nodes_collection,
    workflow_runs_collection,
    workflow_node_runs_collection,
    messages_collection,
    node_responses_collection,
    trigger_rules_collection,
)
from models import (
    Client,
    User,
    WhatsAppAccount,
    Workflow,
    WorkflowNode,
    WorkflowRun,
    WorkflowNodeRun,
    MessageRecord,
    NodeResponse,
    TriggerRule,
)


def now_utc():
    return datetime.now(timezone.utc)


def model_to_dict(model):
    data = model.model_dump(mode="python")

    data.pop("created_at", None)
    data.pop("updated_at", None)

    return data


def parse_model(model_class, document):
    if not document:
        return None

    document = dict(document)
    document.pop("_id", None)

    return model_class(**document)


def upsert_document(collection, key_filter: dict, document: dict):
    current_time = now_utc()
    document["updated_at"] = current_time

    collection.update_one(
        key_filter,
        {
            "$set": document,
            "$setOnInsert": {
                "created_at": current_time,
            },
        },
        upsert=True,
    )


def save_client(client: Client):
    upsert_document(
        clients_collection,
        {"id": client.id},
        model_to_dict(client),
    )


def save_user(user: User):
    upsert_document(
        users_collection,
        {"id": user.id},
        model_to_dict(user),
    )


def save_whatsapp_account(account: WhatsAppAccount):
    from pymongo.errors import DuplicateKeyError
    try:
        # Primary upsert by account id
        upsert_document(
            whatsapp_accounts_collection,
            {"id": account.id},
            model_to_dict(account),
        )
    except DuplicateKeyError:
        # phone_number_id unique index conflict — upsert by phone_number_id instead
        upsert_document(
            whatsapp_accounts_collection,
            {"phone_number_id": account.phone_number_id},
            model_to_dict(account),
        )


def get_whatsapp_account_by_phone_number_id(
    phone_number_id: str,
) -> Optional[WhatsAppAccount]:
    document = whatsapp_accounts_collection.find_one(
        {"phone_number_id": phone_number_id}
    )
    return parse_model(WhatsAppAccount, document)


def save_workflow(workflow: Workflow):
    upsert_document(
        workflows_collection,
        {"id": workflow.id},
        model_to_dict(workflow),
    )


def get_workflow_by_id(workflow_id: str) -> Optional[Workflow]:
    document = workflows_collection.find_one({"id": workflow_id})
    return parse_model(Workflow, document)


def get_published_workflows_for_account(
    client_id: str,
    whatsapp_account_id: str,
) -> list[Workflow]:
    documents = workflows_collection.find(
        {
            "client_id": client_id,
            "whatsapp_account_id": whatsapp_account_id,
            "status": "published",
            "deleted": False,
        }
    )

    return [
        parse_model(Workflow, document)
        for document in documents
    ]


def save_workflow_node(node: WorkflowNode):
    upsert_document(
        workflow_nodes_collection,
        {"id": node.id},
        model_to_dict(node),
    )



def get_workflow_nodes(workflow_id: str) -> list[WorkflowNode]:
    documents = workflow_nodes_collection.find(
        {
            "workflow_id": workflow_id,
            "deleted": False,
        }
    )

    return [
        parse_model(WorkflowNode, document)
        for document in documents
    ]


def save_workflow_run(run: WorkflowRun):
    upsert_document(
        workflow_runs_collection,
        {"id": run.id},
        model_to_dict(run),
    )


def get_workflow_run_by_id(run_id: str) -> Optional[WorkflowRun]:
    document = workflow_runs_collection.find_one({"id": run_id})
    return parse_model(WorkflowRun, document)


def find_active_workflow_run(
    client_id: str,
    whatsapp_account_id: str,
    contact_phone: str,
) -> Optional[WorkflowRun]:
    document = workflow_runs_collection.find_one(
        {
            "client_id": client_id,
            "whatsapp_account_id": whatsapp_account_id,
            "contact_phone": contact_phone,
            "status": {
                "$in": ["active", "waiting_for_user"],
            },
        },
        sort=[("updated_at", -1)],
    )

    return parse_model(WorkflowRun, document)


def save_workflow_node_run(node_run: WorkflowNodeRun):
    upsert_document(
        workflow_node_runs_collection,
        {"id": node_run.id},
        model_to_dict(node_run),
    )


def get_workflow_node_run_by_id(
    node_run_id: str,
) -> Optional[WorkflowNodeRun]:
    document = workflow_node_runs_collection.find_one({"id": node_run_id})
    return parse_model(WorkflowNodeRun, document)


def save_message(message: MessageRecord):
    upsert_document(
        messages_collection,
        {"id": message.id},
        model_to_dict(message),
    )


def save_node_response(response: NodeResponse):
    upsert_document(
        node_responses_collection,
        {"id": response.id},
        model_to_dict(response),
    )


def get_run_messages(workflow_run_id: str) -> list[MessageRecord]:
    documents = messages_collection.find(
        {
            "workflow_run_id": workflow_run_id,
        }
    ).sort("created_at", 1)

    return [
        parse_model(MessageRecord, document)
        for document in documents
    ]

def get_workflow_node_runs_by_run_id(
    workflow_run_id: str,
) -> list[WorkflowNodeRun]:
    documents = workflow_node_runs_collection.find(
        {
            "workflow_run_id": workflow_run_id,
        }
    ).sort("created_at", 1)

    return [
        parse_model(WorkflowNodeRun, document)
        for document in documents
    ]


def get_run_node_responses(workflow_run_id: str) -> list[NodeResponse]:
    documents = node_responses_collection.find(
        {
            "workflow_run_id": workflow_run_id,
        }
    ).sort("created_at", 1)

    return [
        parse_model(NodeResponse, document)
        for document in documents
    ]

def update_message_after_send( 
    message_id: str,
    status: str,
    metadata: dict,
):
    """Because initially our outgoing message status is:

        created

        After Meta accepts it, we want:

        sent

        or if Meta rejects it:

        failed """
    
    messages_collection.update_one(
        {"id": message_id},
        {
            "$set": {
                "status": status,
                "metadata": metadata,
                "updated_at": now_utc(),
            },
        },
    )

def get_whatsapp_account_by_id(
    account_id: str,
) -> Optional[WhatsAppAccount]:
    document = whatsapp_accounts_collection.find_one(
        {"id": account_id}
    )
    if not document:
        import os
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        if phone_id:
            return WhatsAppAccount(
                id=account_id or "wa:default",
                client_id="client:amazon",
                name="Env WhatsApp Account",
                phone_number_id=phone_id,
                status="connected",
                created_at=now_utc(),
            )
        return None

    return parse_model(WhatsAppAccount, document)


def get_whatsapp_account_for_client(
    client_id: str,
) -> Optional[WhatsAppAccount]:
    document = whatsapp_accounts_collection.find_one(
        {"client_id": client_id}
    )
    if not document:
        import os
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        if phone_id:
            return WhatsAppAccount(
                id=f"wa:{client_id}",
                client_id=client_id,
                name="Env WhatsApp Account",
                phone_number_id=phone_id,
                status="connected",
                created_at=now_utc(),
            )
        return None

    return parse_model(WhatsAppAccount, document)

MESSAGE_STATUS_ORDER = {
    "created": 0,
    "sent": 1,
    "delivered": 2,
    "read": 3,
}


def should_apply_message_status_update(
    current_status: str | None,
    incoming_status: str | None,
) -> bool:
    current = (current_status or "created").lower()
    incoming = (incoming_status or "").lower()

    # Once read, nothing should downgrade it.
    if current == "read":
        return False

    # Once delivered, sent should not downgrade it.
    if current == "delivered" and incoming == "sent":
        return False

    # Failed is special.
    # Allow failed only if message has not already reached delivered/read.
    if incoming == "failed":
        return current not in ["delivered", "read"]

    # If current is failed, do not revive it from later status webhooks.
    if current == "failed":
        return False

    incoming_rank = MESSAGE_STATUS_ORDER.get(incoming)

    # Unknown status should be recorded in history,
    # but should not become main message.status.
    if incoming_rank is None:
        return False

    current_rank = MESSAGE_STATUS_ORDER.get(current, 0)

    return incoming_rank >= current_rank


def update_message_status_by_meta_message_id(
    meta_message_id: str,
    status: str,
    status_payload: dict,
):
    current_time = now_utc()

    message_document = messages_collection.find_one(
        {
            "metadata.meta_message_id": meta_message_id,
        }
    )

    if not message_document:
        return {
            "matched_count": 0,
            "modified_count": 0,
            "applied": False,
            "previous_status": None,
            "incoming_status": status,
            "final_status": None,
            "reason": "Message not found for Meta message id.",
        }

    previous_status = message_document.get("status", "created")

    should_apply = should_apply_message_status_update(
        current_status=previous_status,
        incoming_status=status,
    )

    history_item = {
        "status": status,
        "payload": status_payload,
        "received_at": current_time,
        "applied_to_main_status": should_apply,
        "previous_status": previous_status,
    }

    update_query = {
        "$set": {
            "updated_at": current_time,
        },
        "$push": {
            "metadata.status_history": history_item,
        },
    }

    if should_apply:
        update_query["$set"]["status"] = status

    result = messages_collection.update_one(
        {
            "metadata.meta_message_id": meta_message_id,
        },
        update_query,
    )

    final_status = status if should_apply else previous_status

    return {
        "matched_count": result.matched_count,
        "modified_count": result.modified_count,
        "applied": should_apply,
        "previous_status": previous_status,
        "incoming_status": status,
        "final_status": final_status,
        "reason": None if should_apply else "Skipped because incoming status would downgrade current status.",
    }

def get_workflows_for_client(client_id: str) -> list[Workflow]:
    documents = workflows_collection.find(
        {
            "client_id": client_id,
            "deleted": False,
        }
    ).sort("updated_at", -1)

    return [
        parse_model(Workflow, document)
        for document in documents
    ]


def get_workflow_runs_for_workflow(
    workflow_id: str,
    limit: int = 50,
) -> list[WorkflowRun]:
    import urllib.parse
    decoded_id = urllib.parse.unquote(workflow_id)
    short_id = decoded_id.split("/")[-1].split(":")[-1]

    query = {
        "$or": [
            {"workflow_id": workflow_id},
            {"workflow_id": decoded_id},
            {"workflow_id": {"$regex": short_id, "$options": "i"}}
        ]
    }
    documents = workflow_runs_collection.find(query).sort("created_at", -1).limit(limit)

    return [
        parse_model(WorkflowRun, document)
        for document in documents
    ]


def soft_delete_workflow(workflow_id: str):
    current_time = now_utc()

    workflows_collection.update_one(
        {"id": workflow_id},
        {
            "$set": {
                "deleted": True,
                "status": "archived",
                "updated_at": current_time,
            }
        },
    )


def delete_workflow_nodes_by_workflow_id(workflow_id: str):
    """Hard-delete all nodes for a workflow (used before bulk re-insert from canvas)."""
    workflow_nodes_collection.delete_many(
        {"workflow_id": workflow_id}
    )


def get_workflow_node_by_id(node_id: str) -> Optional[WorkflowNode]:
    document = workflow_nodes_collection.find_one({"id": node_id})
    return parse_model(WorkflowNode, document)


def get_messages_for_client(client_id: str, limit: int = 100) -> list[MessageRecord]:
    documents = messages_collection.find(
        {"client_id": client_id}
    ).sort("created_at", -1).limit(limit)

    return [
        parse_model(MessageRecord, document)
        for document in documents
    ]


def get_user_by_email(email: str) -> Optional[User]:
    document = users_collection.find_one({"email": email})
    return parse_model(User, document)


def get_client_by_email(email: str) -> Optional[Client]:
    document = clients_collection.find_one({"email": email})
    return parse_model(Client, document)


def get_client_by_id(client_id: str) -> Optional[Client]:
    document = clients_collection.find_one({"id": client_id})
    return parse_model(Client, document)


def get_all_workflow_runs(client_id: str, limit: int = 100) -> list[WorkflowRun]:
    documents = workflow_runs_collection.find(
        {"client_id": client_id}
    ).sort("created_at", -1).limit(limit)

    return [
        parse_model(WorkflowRun, document)
        for document in documents
    ]


def save_trigger_rule(rule: TriggerRule):
    upsert_document(
        trigger_rules_collection,
        {"id": rule.id},
        model_to_dict(rule),
    )


def get_trigger_rules_for_client(client_id: str) -> list[TriggerRule]:
    documents = trigger_rules_collection.find(
        {"client_id": client_id}
    ).sort("created_at", -1)

    return [
        parse_model(TriggerRule, document)
        for document in documents
    ]


def get_active_trigger_rules(client_id: str) -> list[TriggerRule]:
    documents = trigger_rules_collection.find(
        {"client_id": client_id, "is_active": {"$ne": False}}
    )

    return [
        parse_model(TriggerRule, document)
        for document in documents
    ]


def delete_trigger_rule(rule_id: str):
    trigger_rules_collection.delete_one({"id": rule_id})