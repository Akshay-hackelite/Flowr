from fastapi import APIRouter,Request, Query, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from models import (
    FullSetupRequest,
    TestWebhookRequest,
    SendWhatsAppTestRequest,
    SendWhatsAppButtonTestRequest,
    SendWhatsAppListTestRequest,
    Workflow,
    WorkflowNode,
    SignupRequest,
    LoginRequest,
    GoogleAuthRequest,
    TriggerRule,
    SendMessageReplyRequest,
    Client,
    User,
    WhatsAppAccount,
)
from services import (
    save_full_setup,
    process_test_webhook,
    get_run_debug_data,
    route_whatsapp_webhook_payload,
    verify_whatsapp_webhook,
    send_human_reply_message,
    validate_workflow_graph,
)
from whatsapp_service import send_whatsapp_text_message,send_whatsapp_button_message,send_whatsapp_list_message
from storage import (
    get_workflows_for_client,
    get_workflow_by_id,
    get_workflow_nodes,
    save_workflow,
    save_workflow_node,
    soft_delete_workflow,
    delete_workflow_nodes_by_workflow_id,
    get_workflow_runs_for_workflow,
    get_published_workflows_for_account,
    get_messages_for_client,
    get_user_by_email,
    save_user,
    save_client,
    save_whatsapp_account,
    get_all_workflow_runs,
    save_trigger_rule,
    get_trigger_rules_for_client,
    delete_trigger_rule,
    get_client_by_id,
)
from datetime import datetime, timezone

router = APIRouter()


@router.get("/")
def home():
    return {
        "message": "Flowr — WhatsApp Workflow Bot Backend is running."
    }


# ──────────────────────────────────────────────
# Workflow CRUD API (for frontend)
# ──────────────────────────────────────────────

class CreateWorkflowRequest(BaseModel):
    client_id: str
    whatsapp_account_id: str
    created_by_user_id: str
    name: str
    description: Optional[str] = None


class UpdateWorkflowRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    updated_by_user_id: Optional[str] = None


class SaveCanvasRequest(BaseModel):
    """The frontend sends its full React Flow state here.
    We convert it to backend WorkflowNode documents."""
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    first_node_id: Optional[str] = None
    updated_by_user_id: str = "user:default"


@router.get("/api/workflows")
def list_workflows(client_id: str = Query(...)):
    workflows = get_workflows_for_client(client_id)
    return {
        "workflows": [w.model_dump(mode="json") for w in workflows],
    }


@router.get("/api/workflows/{workflow_id:path}/runs")
def list_workflow_runs(workflow_id: str, limit: int = Query(default=50)):
    runs = get_workflow_runs_for_workflow(workflow_id, limit=limit)
    return {
        "runs": [r.model_dump(mode="json") for r in runs],
    }


@router.get("/api/workflows/{workflow_id:path}")
def get_workflow(workflow_id: str):
    workflow = get_workflow_by_id(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    nodes = get_workflow_nodes(workflow_id)
    return {
        "workflow": workflow.model_dump(mode="json"),
        "nodes": [n.model_dump(mode="json") for n in nodes],
    }


@router.post("/api/workflows")
def create_workflow(req: CreateWorkflowRequest):
    now = datetime.now(timezone.utc)
    # Generate an ID based on client + short unique name
    import uuid
    short = uuid.uuid4().hex[:8]
    workflow_id = f"{req.client_id}/workflow:{short}"

    workflow = Workflow(
        id=workflow_id,
        client_id=req.client_id,
        whatsapp_account_id=req.whatsapp_account_id,
        created_by_user_id=req.created_by_user_id,
        updated_by_user_id=req.created_by_user_id,
        name=req.name,
        description=req.description,
        node_ids=[],
        first_node_id=None,
        status="draft",
        deleted=False,
    )
    save_workflow(workflow)

    return {
        "message": "Workflow created.",
        "workflow": workflow.model_dump(mode="json"),
    }


@router.put("/api/workflows/{workflow_id:path}")
def update_workflow(workflow_id: str, req: UpdateWorkflowRequest):
    workflow = get_workflow_by_id(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    if req.name is not None:
        workflow.name = req.name
    if req.description is not None:
        workflow.description = req.description
    if req.updated_by_user_id is not None:
        workflow.updated_by_user_id = req.updated_by_user_id

    if req.status is not None:
        if req.status == "published":
            # Enforce one published workflow per account
            existing = get_published_workflows_for_account(
                client_id=workflow.client_id,
                whatsapp_account_id=workflow.whatsapp_account_id,
            )
            for ex in existing:
                if ex.id != workflow.id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Another workflow '{ex.name}' is already published for this WhatsApp account. Unpublish it first.",
                    )
        workflow.status = req.status

    save_workflow(workflow)
    return {
        "message": "Workflow updated.",
        "workflow": workflow.model_dump(mode="json"),
    }


@router.delete("/api/workflows/{workflow_id:path}")
def delete_workflow(workflow_id: str):
    workflow = get_workflow_by_id(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    soft_delete_workflow(workflow_id)
    return {"message": "Workflow deleted."}


@router.post("/api/workflows/{workflow_id:path}/save-canvas")
def save_canvas(workflow_id: str, req: SaveCanvasRequest):
    """Receives the full canvas state from the frontend and saves all nodes.
    This does a full replace: deletes existing nodes, then inserts new ones."""
    workflow = get_workflow_by_id(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    # Delete existing nodes for this workflow
    delete_workflow_nodes_by_workflow_id(workflow_id)

    # Build ID map from canvas node IDs to canonical backend IDs
    id_map = {}
    for c_node in req.nodes:
        cid = c_node.get("id", "")
        ntype = c_node.get("type", "")
        if ntype == "start":
            continue
        ndata = c_node.get("data", {})
        b_id = ndata.get("backendId") or (cid if "/" in cid else f"{workflow_id}/node:{cid}")
        id_map[cid] = b_id
        if ":" in cid:
            id_map[cid.split(":")[-1]] = b_id
        if "/" in cid:
            id_map[cid.split("/")[-1]] = b_id

    # Build edge map: source_node_id → target_node_id
    edge_map = {}
    for edge in req.edges:
        source = edge.get("source")
        target = edge.get("target")
        source_handle = edge.get("sourceHandle")

        if source and target:
            if source_handle:
                edge_map.setdefault(source, {})[source_handle] = target
            else:
                edge_map.setdefault(source, {})["default"] = target

    saved_nodes = []
    node_ids = []

    for canvas_node in req.nodes:
        cid = canvas_node.get("id", "")
        node_type = canvas_node.get("type", "send_message")
        node_data = canvas_node.get("data", {})

        if node_type == "start":
            continue

        backend_node_id = id_map.get(cid, cid)

        backend_type = node_type
        if backend_type not in ["send_message", "ask_question", "condition"]:
            backend_type = "send_message"

        config = node_data.get("config", {})
        node_edges = edge_map.get(cid, {})
        raw_default = node_edges.get("default")
        next_node_id_raw = id_map.get(raw_default, raw_default) if raw_default else None

        if backend_type == "ask_question" and isinstance(config, dict):
            input_type = config.get("input_type", "text")

            if input_type == "buttons" and "options" in config:
                for option in config["options"]:
                    option_handle = f"option_{option.get('id', '')}"
                    if option_handle in node_edges:
                        raw_tgt = node_edges[option_handle]
                        option["next_node_id"] = id_map.get(raw_tgt, raw_tgt)
                    else:
                        option["next_node_id"] = None

            elif input_type == "list" and "list_config" in config and isinstance(config["list_config"], dict):
                list_config = config["list_config"]
                for section in list_config.get("sections", []):
                    if isinstance(section, dict):
                        for row in section.get("rows", []):
                            if isinstance(row, dict):
                                row_handle = f"option_{row.get('id', '')}"
                                if row_handle in node_edges:
                                    raw_tgt = node_edges[row_handle]
                                    row["next_node_id"] = id_map.get(raw_tgt, raw_tgt)
                                else:
                                    row["next_node_id"] = None

            if input_type in ["buttons", "list"]:
                if "default" in node_edges:
                    raw_tgt = node_edges["default"]
                    config["default_next_node_id"] = id_map.get(raw_tgt, raw_tgt)
                else:
                    config["default_next_node_id"] = None

        if backend_type == "condition" and isinstance(config, dict):
            for i, cond in enumerate(config.get("conditions", [])):
                if isinstance(cond, dict):
                    cond_handle = f"condition_{i}"
                    if cond_handle in node_edges:
                        raw_tgt = node_edges[cond_handle]
                        cond["next_node_id"] = id_map.get(raw_tgt, raw_tgt)
                    else:
                        cond["next_node_id"] = None

            default_handle = "default"
            if default_handle in node_edges:
                raw_tgt = node_edges[default_handle]
                config["default_next_node_id"] = id_map.get(raw_tgt, raw_tgt)
            else:
                config["default_next_node_id"] = None

        final_next_node_id = None
        if backend_type == "send_message":
            final_next_node_id = next_node_id_raw
        elif backend_type == "ask_question":
            aq_input_type = config.get("input_type", "text") if isinstance(config, dict) else "text"
            if aq_input_type == "text":
                final_next_node_id = next_node_id_raw

        canvas_position = canvas_node.get("position") or None

        node = WorkflowNode(
            id=backend_node_id,
            client_id=workflow.client_id,
            workflow_id=workflow_id,
            created_by_user_id=req.updated_by_user_id,
            updated_by_user_id=req.updated_by_user_id,
            name=node_data.get("label", node_type),
            type=backend_type,
            next_node_id=final_next_node_id,
            config=config or {},
            position=canvas_position,
            deleted=False,
        )
        save_workflow_node(node)
        saved_nodes.append(node)
        node_ids.append(backend_node_id)

    workflow.node_ids = node_ids
    if req.first_node_id:
        workflow.first_node_id = id_map.get(req.first_node_id, req.first_node_id)
    else:
        workflow.first_node_id = None
    workflow.updated_by_user_id = req.updated_by_user_id
    save_workflow(workflow)

    validation_errors = validate_workflow_graph(workflow, saved_nodes)
    if workflow.status == "published" and validation_errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot save invalid published workflow. Please fix errors or unpublish first.", "errors": validation_errors}
        )

    return {
        "message": f"Canvas saved. {len(saved_nodes)} nodes saved.",
        "workflow_id": workflow_id,
        "node_ids": node_ids,
        "first_node_id": workflow.first_node_id,
        "validation_errors": validation_errors,
        "is_valid": len(validation_errors) == 0,
    }



@router.get("/api/messages")
def list_client_messages(client_id: str = Query(...), limit: int = Query(default=100)):
    messages = get_messages_for_client(client_id, limit=limit)
    return {
        "messages": [m.model_dump(mode="json") for m in messages],
    }


# ──────────────────────────────────────────────
# Existing endpoints (preserved as-is)
# ──────────────────────────────────────────────

@router.post("/dev/setup")  
def dev_setup(request: FullSetupRequest):
    return save_full_setup(request)
'''
FastAPI route parameter annotation = automatic Pydantic conversion and validation.Here FastAPI sees the type annotation:
request: FullSetupRequest
So FastAPI converts JSON dict into FullSetupRequest. in normal python without this routeer , its just a type hint i.e will not automatically convert and valdiate'''


@router.post("/webhook/test")
def test_webhook(request: TestWebhookRequest):
    return process_test_webhook(request)


@router.get("/runs/debug")
def debug_run(workflow_run_id: str):
    return get_run_debug_data(workflow_run_id)

@router.get("/webhook/whatsapp")
def whatsapp_webhook_verify(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    challenge = verify_whatsapp_webhook(
        mode=hub_mode,
        verify_token=hub_verify_token,
        challenge=hub_challenge,
    )

    return PlainTextResponse(content=challenge)


@router.post("/webhook/whatsapp")
async def whatsapp_webhook_receive(request: Request):
    payload = await request.json()

    print("WHATSAPP WEBHOOK PAYLOAD:",flush=True)
    print(payload,flush=True)

    result = route_whatsapp_webhook_payload(payload)

    print("WHATSAPP WEBHOOK RESULT:",flush=True)
    print(result,flush=True)

    return {
        "status of request": "received",
        "result": result,
    }

## the below are just for testing purposes

@router.post("/dev/whatsapp/send-text")
def dev_send_whatsapp_text(request: SendWhatsAppTestRequest):
    result = send_whatsapp_text_message(
        phone_number_id=request.phone_number_id,
        to_phone=request.to_phone,
        text=request.text,
    )

    return {
        "status": "sent",
        "meta_response": result,
    }

@router.post("/dev/whatsapp/send-buttons")
def dev_send_whatsapp_buttons(request: SendWhatsAppButtonTestRequest):
    result = send_whatsapp_button_message(
        phone_number_id=request.phone_number_id,
        to_phone=request.to_phone,
        body_text=request.text,
        buttons=[
            {
                "id": "track_order",
                "title": "Track Order",
            },
            {
                "id": "return_item",
                "title": "Return Item",
            },
        ],
    )

    return {
        "status": "sent",
        "meta_response": result,
    }
@router.post("/dev/whatsapp/send-list")
def dev_send_whatsapp_list(request: SendWhatsAppListTestRequest):
    result = send_whatsapp_list_message(
        phone_number_id=request.phone_number_id,
        to_phone=request.to_phone,
        body_text=request.body_text,
        list_config=request.list_config,
    )

    return {
        "status": "sent",
        "meta_response": result,
    }


# ──────────────────────────────────────────────
# Authentication & Google Login Endpoints
# ──────────────────────────────────────────────

@router.post("/api/auth/signup")
def signup(req: SignupRequest):
    import uuid
    from pymongo.errors import DuplicateKeyError as MongoDuplicateKey

    existing_user = get_user_by_email(req.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    slug = req.client_name.lower().strip().replace(" ", "_") or "client"
    short = uuid.uuid4().hex[:4]
    client_id = f"client:{slug}_{short}"
    account_id = f"wa:{slug}_{short}"
    now = datetime.now(timezone.utc)

    client = Client(
        id=client_id,
        name=req.client_name,
        password=req.password,
        email=req.email,
        status="active",
        created_at=now,
    )
    save_client(client)

    user_id = f"user_{uuid.uuid4().hex[:8]}"
    user = User(
        id=user_id,
        client_id=client_id,
        name=req.user_name,
        email=req.email,
        password=req.password,
        auth_provider="local",
        role="admin",
        status="active",
        created_at=now,
    )
    save_user(user)

    try:
        wa = WhatsAppAccount(
            id=account_id,
            client_id=client_id,
            name=f"{req.client_name} WhatsApp",
            phone_number_id=req.phone_number_id or "test_phone_id",
            display_phone_number="+91 99999 99999",
            whatsapp_business_account_id=req.whatsapp_business_account_id or "test_waba_id",
            status="connected",
            created_at=now,
            updated_at=now,
        )
        save_whatsapp_account(wa)
    except MongoDuplicateKey:
        raise HTTPException(
            status_code=400,
            detail=f"A WhatsApp account with Phone Number ID '{req.phone_number_id}' already exists. Use a different Phone Number ID or log in."
        )

    return {
        "token": f"mock_token_{user_id}",
        "user": user.model_dump(),
        "client": client.model_dump(),
        "whatsapp_account": wa.model_dump(),
    }


@router.post("/api/auth/login")
def login(req: LoginRequest):
    user = get_user_by_email(req.email)
    from storage import get_client_by_email
    client = get_client_by_email(req.email) if not user else get_client_by_id(user.client_id)

    if user and user.password == req.password:
        pass
    elif client and client.password == req.password:
        if not user:
            user = User(id=f"user_{client.id}", client_id=client.id, name=client.name, email=req.email)
    else:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    from storage import get_whatsapp_account_for_client
    wa = get_whatsapp_account_for_client(user.client_id)
    return {
        "token": f"mock_token_{user.id}",
        "user": user.model_dump(),
        "client": client.model_dump() if client else {"id": user.client_id, "name": "Default Client"},
        "whatsapp_account": wa.model_dump() if wa else None,
    }


@router.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest):
    import uuid
    user = get_user_by_email(req.email)
    from storage import get_whatsapp_account_for_client
    if user:
        client = get_client_by_id(user.client_id)
        wa = get_whatsapp_account_for_client(user.client_id)
        return {
            "token": f"mock_token_{user.id}",
            "user": user.model_dump(),
            "client": client.model_dump() if client else {"id": user.client_id, "name": req.client_name},
            "whatsapp_account": wa.model_dump() if wa else None,
        }

    slug = req.client_name.lower().strip().replace(" ", "_") or "client"
    short = uuid.uuid4().hex[:4]
    client_id = f"client:{slug}_{short}"
    account_id = f"wa:{slug}_{short}"
    now = datetime.now(timezone.utc)

    client = Client(
        id=client_id,
        name=req.client_name,
        status="active",
        created_at=now,
    )
    save_client(client)

    user_id = f"user_{uuid.uuid4().hex[:8]}"
    user = User(
        id=user_id,
        client_id=client_id,
        name=req.name,
        email=req.email,
        password=None,
        auth_provider="google",
        role="admin",
        status="active",
        created_at=now,
    )
    save_user(user)

    wa = WhatsAppAccount(
        id=account_id,
        client_id=client_id,
        name=f"{req.client_name} WhatsApp",
        phone_number_id=req.phone_number_id or "test_phone_id",
        display_phone_number="+91 99999 99999",
        whatsapp_business_account_id=req.whatsapp_business_account_id or "test_waba_id",
        status="connected",
        created_at=now,
        updated_at=now,
    )
    save_whatsapp_account(wa)

    return {
        "token": f"mock_token_{user_id}",
        "user": user.model_dump(),
        "client": client.model_dump(),
        "whatsapp_account": wa.model_dump(),
    }


# ──────────────────────────────────────────────
# Global Workflow Runs & Publishing Constraint
# ──────────────────────────────────────────────

@router.get("/api/runs")
def list_all_workflow_runs(client_id: str = Query(..., description="Client ID"), limit: int = 100):
    runs = get_all_workflow_runs(client_id, limit)
    return {"runs": [r.model_dump(mode="json") for r in runs]}


@router.post("/api/workflows/{workflow_id:path}/publish")
def publish_workflow_endpoint(workflow_id: str):
    wf = get_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    published = get_published_workflows_for_account(wf.client_id, wf.whatsapp_account_id)
    for p in published:
        if p.id != wf.id:
            raise HTTPException(
                status_code=400,
                detail="You can publish only one workflow at a time. Please unpublish the currently active workflow first.",
            )

    nodes = get_workflow_nodes(workflow_id)
    validation_errors = validate_workflow_graph(wf, nodes)
    if validation_errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot publish invalid workflow. Please fix graph errors.", "errors": validation_errors}
        )

    wf.status = "published"
    wf.updated_at = datetime.now(timezone.utc)
    save_workflow(wf)
    return {"status": "published", "workflow": wf.model_dump(mode="json")}


@router.post("/api/workflows/{workflow_id:path}/unpublish")
def unpublish_workflow_endpoint(workflow_id: str):
    wf = get_workflow_by_id(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    wf.status = "draft"
    wf.updated_at = datetime.now(timezone.utc)
    save_workflow(wf)
    return {"status": "draft", "workflow": wf.model_dump(mode="json")}


# ──────────────────────────────────────────────
# Live Inbox Human Reply
# ──────────────────────────────────────────────

@router.post("/api/messages/send")
def send_reply_message(req: SendMessageReplyRequest):
    msg = send_human_reply_message(req.client_id, req.contact_phone, req.text)
    return {"status": "sent", "message": msg.model_dump(mode="json")}


# ──────────────────────────────────────────────
# Trigger Rules Dashboard API
# ──────────────────────────────────────────────

@router.get("/api/trigger-rules")
def list_trigger_rules(client_id: str = Query(...)):
    rules = get_trigger_rules_for_client(client_id)
    return {"rules": [r.model_dump(mode="json") for r in rules]}


@router.post("/api/trigger-rules")
def create_or_update_trigger_rule(rule: TriggerRule):
    if not rule.created_at:
        rule.created_at = datetime.now(timezone.utc)
    rule.updated_at = datetime.now(timezone.utc)
    save_trigger_rule(rule)
    return {"status": "saved", "rule": rule.model_dump(mode="json")}


@router.delete("/api/trigger-rules/{rule_id}")
def remove_trigger_rule(rule_id: str):
    delete_trigger_rule(rule_id)
    return {"status": "deleted", "id": rule_id}