from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field,ConfigDict,AliasChoices

class Client(BaseModel):
    id: str
    name: str
    password: Optional[str] = None
    email: Optional[str] = None
    status: Literal["active", "inactive"] = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class User(BaseModel):
    id: str
    client_id: str
    name: str
    email: str
    password: Optional[str] = None
    auth_provider: str = "local"
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

    # Canvas position — persisted so the layout is restored exactly on reload
    position: Optional[dict] = None

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

    variable_name: Optional[str] = None
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
    media_type: Literal["text", "image", "audio"] = "text"
    media_url: Optional[str] = None

class AskQuestionOptionConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    label: str

    next_node_id: str = Field(
        validation_alias=AliasChoices("next_node_id", "nextNodeId"),
    )

class AskQuestionListRowConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    label: str
    description: Optional[str] = None

    next_node_id: str = Field(
        validation_alias=AliasChoices("next_node_id", "nextNodeId"),
    )

class AskQuestionListSectionConfig(BaseModel):
    """
    Section title
    Row 1
    Row 2
    """
    model_config = ConfigDict(populate_by_name=True)

    title: str
    rows: list[AskQuestionListRowConfig] = Field(default_factory=list)

class AskQuestionListConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    button_text: str = Field(
        default="Choose option",
        validation_alias=AliasChoices("button_text", "buttonText"),
    )

    sections: list[AskQuestionListSectionConfig] = Field(default_factory=list)

class AskQuestionConfig(BaseModel):
    """AskQuestionConfig
    common:
        question
        input_type
        variable_name

    buttons only:
        options

    list only:
        list_config
            button_text
            sections
                rows
                
thus Button node config:

{
  "question": "What do you need help with?",
  "input_type": "buttons",
  "variable_name": "issue_type",
  "options": [
    {
      "id": "track_order",
      "label": "Track Order",
      "next_node_id": "client:meta_test/workflow:support_bot/node:3"
    },
    {
      "id": "return_item",
      "label": "Return Item",
      "next_node_id": "client:meta_test/workflow:support_bot/node:4"
    }
  ]
}

No list_config.


For list, do this:

{
  "question": "What do you need help with?",
  "input_type": "list",
  "variable_name": "issue_type",
  "list_config": {
    "button_text": "Choose option",
    "sections": [
      {
        "title": "Orders",
        "rows": [
          {
            "id": "track_order",
            "label": "Track Order",
            "description": "Check your order status",
            "next_node_id": "client:meta_test/workflow:support_bot/node:3"
          }
        ]
      },
      {
        "title": "Returns",
        "rows": [
          {
            "id": "return_item",
            "label": "Return Item",
            "description": "Start a return request",
            "next_node_id": "client:meta_test/workflow:support_bot/node:4"
          }
        ]
      }
    ]
  }
}

No options"""
    model_config = ConfigDict(populate_by_name=True)

    question: str

    input_type: Literal["text", "buttons", "list"] = Field(
        default="text",
        validation_alias=AliasChoices("input_type", "inputType"),
    )
    # Used only when input_type = "buttons"
    options: list[AskQuestionOptionConfig] = Field(default_factory=list)

    # Used only when input_type = "list"
    list_config: Optional[AskQuestionListConfig] = Field(
        default=None,
        validation_alias=AliasChoices("list_config", "listConfig"),
    )

    variable_name: Optional[str] = Field(
        default=None,
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


### the below are just for testing purposes
class SendWhatsAppTestRequest(BaseModel):
    phone_number_id: str
    to_phone: str
    text: str


class SendWhatsAppButtonTestRequest(BaseModel):
    phone_number_id: str
    to_phone: str
    text: str

class SendWhatsAppListTestRequest(BaseModel):
    phone_number_id: str
    to_phone: str
    body_text: str
    list_config: dict


class TriggerRule(BaseModel):
    id: str
    client_id: str
    workflow_id: str
    keyword: str
    match_type: Literal["exact", "contains"] = "contains"
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SignupRequest(BaseModel):
    client_name: str
    user_name: str
    email: str
    password: str
    phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    client_name: str
    phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None


class SendMessageReplyRequest(BaseModel):
    client_id: str
    contact_phone: str
    text: str