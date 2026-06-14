import os

from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()


MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "botify")


client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]


clients_collection = db["clients"]
users_collection = db["users"]
whatsapp_accounts_collection = db["whatsapp_accounts"]
workflows_collection = db["workflows"]
workflow_nodes_collection = db["workflow_nodes"]
workflow_runs_collection = db["workflow_runs"]
workflow_node_runs_collection = db["workflow_node_runs"]
messages_collection = db["messages"]
node_responses_collection = db["node_responses"]


def init_db():
    client.admin.command("ping")

    clients_collection.create_index("id", unique=True)
    users_collection.create_index("id", unique=True)

    whatsapp_accounts_collection.create_index("id", unique=True)
    whatsapp_accounts_collection.create_index("phone_number_id", unique=True)
    whatsapp_accounts_collection.create_index("client_id")

    workflows_collection.create_index("id", unique=True)
    workflows_collection.create_index(
        [
            ("client_id", 1),
            ("whatsapp_account_id", 1),
            ("status", 1),
            ("deleted", 1),
        ]
    )

    workflow_nodes_collection.create_index("id", unique=True)
    workflow_nodes_collection.create_index(
        [
            ("workflow_id", 1),
            ("deleted", 1),
        ]
    )

    workflow_runs_collection.create_index("id", unique=True)
    workflow_runs_collection.create_index(
        [
            ("client_id", 1),
            ("whatsapp_account_id", 1),
            ("contact_phone", 1),
            ("status", 1),
        ]
    )

    workflow_node_runs_collection.create_index("id", unique=True)
    workflow_node_runs_collection.create_index("workflow_run_id")

    messages_collection.create_index("id", unique=True)
    messages_collection.create_index("workflow_run_id")
    messages_collection.create_index("contact_phone")

    node_responses_collection.create_index("id", unique=True)
    node_responses_collection.create_index("workflow_run_id")