from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field,ConfigDict,AliasChoices

class Client(BaseModel):
    id: str
    name: str
    status: Literal["active", "inactive"] = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class User(BaseModel):
    id: str
    client_id: str
    name: str
    email: str
    role: str = "admin"
    status: Literal["active", "inactive"] = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WhatsAppAccount(BaseModel): # currently it does not have access_token and verify token needed for whatsapp.
    id: str
    client_id: str

    name: str
    phone_number_id: str
    display_phone_number: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None

    status: Literal["connected", "disconnected"] = "connected"

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Workflow(BaseModel):
    id: str
    client_id: str
    whatsapp_account_id: str

    created_by_user_id: str
    updated_by_user_id: str

    name: str
    description: Optional[str] = None

    node_ids: list[str] = Field(default_factory=list)
    first_node_id: Optional[str] = None

    status: Literal["draft", "published", "archived"] = "draft"
    deleted: bool = False

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkflowNode(BaseModel):
    id: str
    client_id: str
    workflow_id: str

    created_by_user_id: str
    updated_by_user_id: str

    name: str
    type: Literal["send_message", "ask_question", "condition"]

    next_node_id: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)

    deleted: bool = False

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkflowRun(BaseModel):
    id: str

    client_id: str
    whatsapp_account_id: str
    workflow_id: str

    contact_phone: str

    status: Literal[
        "active",
        "waiting_for_user",
        "completed",
        "failed",
    ] = "active"

    current_node_id: Optional[str] = None
    waiting_at_node_id: Optional[str] = None
    waiting_node_run_id: Optional[str] = None

    variables: dict[str, Any] = Field(default_factory=dict)

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkflowNodeRun(BaseModel):
    id: str

    client_id: str
    whatsapp_account_id: str
    workflow_id: str
    workflow_run_id: str

    node_id: str
    node_type: str
    node_name: str

    status: Literal[
        "active",
        "waiting_for_user",
        "success",
        "failed",
    ] = "active"

    user_input: Optional[dict[str, Any]] = None

    next_node_id: Optional[str] = None

    error: Optional[str] = None

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MessageRecord(BaseModel):
    id: str

    client_id: str
    whatsapp_account_id: str
    workflow_id: Optional[str] = None
    workflow_run_id: Optional[str] = None
    node_run_id: Optional[str] = None

    contact_phone: str

    direction: Literal["incoming", "outgoing"]
    message_type: str = "text"

    text: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    status: str = "created"

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NodeResponse(BaseModel):
    id: str

    client_id: str
    whatsapp_account_id: str
    workflow_id: str
    workflow_run_id: str

    node_id: str
    node_run_id: str

    variable_name: str
    question: Optional[str] = None
    response: Any

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FullSetupRequest(BaseModel):
    client: Client
    user: User
    whatsapp_account: WhatsAppAccount
    workflow: Workflow
    nodes: list[WorkflowNode]


class TestWebhookRequest(BaseModel):
    phone_number_id: str
    from_phone: str
    text: str
    message_type: str = "text"

class SendMessageConfig(BaseModel):
    message: str

class AskQuestionOptionConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    label: str
    value: str

    next_node_id: str = Field(
        validation_alias=AliasChoices("next_node_id", "nextNodeId"),
    )

class AskQuestionConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str

    input_type: Literal["text", "buttons", "list"] = Field(
        default="text",
        validation_alias=AliasChoices("input_type", "inputType"),
    )

    options: list[AskQuestionOptionConfig] = Field(default_factory=list)

    variable_name: str = Field(
        validation_alias=AliasChoices("variable_name", "variableName"),
    )

class ConditionRuleConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    variable: str
    operator: Literal["equals", "not_equals"] = "equals"
    value: Any

    next_node_id: str = Field(
        validation_alias=AliasChoices("next_node_id", "nextNodeId"),
    )

class ConditionConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conditions: list[ConditionRuleConfig] = Field(default_factory=list)

    default_next_node_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("default_next_node_id", "defaultNextNodeId"),
    )


