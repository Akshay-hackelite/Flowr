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
    upsert_document(
        whatsapp_accounts_collection,
        {"id": account.id},
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