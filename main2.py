from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal, Any, Union, Annotated
from uuid import uuid4


app = FastAPI(title="WATI-like Workflow Bot Backend")


class ConditionRule(BaseModel):
    variable: str
    operator: Literal["equals", "not_equals"] = "equals"
    value: Any
    nextNodeId: str


class BaseNode(BaseModel):
    id: str


class SendMessageNode(BaseNode):
    type: Literal["send_message"]
    message: str
    nextNodeId: Optional[str] = None


class AskQuestionNode(BaseNode):
    type: Literal["ask_question"]
    question: str
    inputType: Literal["text", "buttons", "list"] = "text"
    options: list[str] = Field(default_factory=list)
    variableName: str
    nextNodeId: Optional[str] = None


class ConditionNode(BaseNode):
    type: Literal["condition"]
    conditions: list[ConditionRule] = Field(default_factory=list)
    defaultNextNodeId: Optional[str] = None


BotNode = Annotated[
    Union[SendMessageNode, AskQuestionNode, ConditionNode],
    Field(discriminator="type")
]


class Workflow(BaseModel):
    id: str
    name: str
    startNodeId: str
    nodes: list[BotNode]


class NodeResponse(BaseModel):
    id: str
    sessionId: str
    workflowId: str
    nodeId: str
    variableName: Optional[str] = None
    question: Optional[str] = None
    response: Any


class SessionState(BaseModel):
    sessionId: str
    workflowId: str
    waitingAtNodeId: Optional[str] = None
    status: Literal["active", "waiting_for_user", "completed"] = "active"


class ReplyRequest(BaseModel):
    sessionId: str
    userReply: str


workflows: dict[str, Workflow] = {}
sessions: dict[str, SessionState] = {}
node_responses: list[NodeResponse] = []


def build_node_map(workflow: Workflow) -> dict[str, BotNode]:
    return {node.id: node for node in workflow.nodes}


def validate_workflow(workflow: Workflow):
    errors = []

    node_ids = [node.id for node in workflow.nodes]
    node_id_set = set(node_ids)

    if len(node_ids) != len(node_id_set):
        errors.append("Duplicate node IDs found. Every node must have a unique id.")

    if workflow.startNodeId not in node_id_set:
        errors.append(f"startNodeId '{workflow.startNodeId}' does not exist in nodes.")

    for node in workflow.nodes:
        if node.type == "send_message":
            if node.nextNodeId and node.nextNodeId not in node_id_set:
                errors.append(
                    f"send_message node '{node.id}' has invalid nextNodeId '{node.nextNodeId}'."
                )

        elif node.type == "ask_question":
            if node.nextNodeId and node.nextNodeId not in node_id_set:
                errors.append(
                    f"ask_question node '{node.id}' has invalid nextNodeId '{node.nextNodeId}'."
                )

            if node.inputType in ["buttons", "list"] and not node.options:
                errors.append(
                    f"ask_question node '{node.id}' uses inputType '{node.inputType}' but has no options."
                )

            if len(node.options) != len(set(node.options)):
                errors.append(
                    f"ask_question node '{node.id}' has duplicate options."
                )

        elif node.type == "condition":
            if not node.conditions and not node.defaultNextNodeId:
                errors.append(
                    f"condition node '{node.id}' has no conditions and no defaultNextNodeId."
                )

            for index, rule in enumerate(node.conditions):
                if rule.nextNodeId not in node_id_set:
                    errors.append(
                        f"condition node '{node.id}' rule {index + 1} has invalid nextNodeId '{rule.nextNodeId}'."
                    )

            if node.defaultNextNodeId and node.defaultNextNodeId not in node_id_set:
                errors.append(
                    f"condition node '{node.id}' has invalid defaultNextNodeId '{node.defaultNextNodeId}'."
                )

    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid workflow.",
                "errors": errors,
            },
        )
    
def build_variables_for_session(session_id: str) -> dict[str, Any]:
    variables = {}

    for response in node_responses:
        if response.sessionId == session_id and response.variableName:
            variables[response.variableName] = response.response

    return variables


def condition_matches(rule: ConditionRule, variables: dict[str, Any]) -> bool:
    actual_value = variables.get(rule.variable)

    if rule.operator == "equals":
        return actual_value == rule.value

    if rule.operator == "not_equals":
        return actual_value != rule.value

    return False


def execute_workflow_from_node(
    workflow: Workflow,
    session: SessionState,
    start_node_id: Optional[str],
):
    node_map = build_node_map(workflow)
    current_node_id = start_node_id
    outgoing_messages = []
    safety_counter = 0

    while current_node_id:
        safety_counter += 1

        if safety_counter > 100:
            raise HTTPException(
                status_code=400,
                detail="Workflow seems to have an infinite loop.",
            )

        node = node_map.get(current_node_id)

        if not node:
            raise HTTPException(
                status_code=400,
                detail=f"Node not found: {current_node_id}",
            )

        if node.type == "send_message":
            outgoing_messages.append({
                "type": "text",
                "text": node.message,
            })

            current_node_id = node.nextNodeId

        elif node.type == "ask_question":
            outgoing_messages.append({
                "type": "question",
                "question": node.question,
                "inputType": node.inputType,
                "options": node.options,
                "storeAnswerIn": node.variableName,
            })

            session.waitingAtNodeId = node.id
            session.status = "waiting_for_user"

            return {
                "status": "waiting_for_user",
                "sessionId": session.sessionId,
                "workflowId": session.workflowId,
                "waitingAtNodeId": session.waitingAtNodeId,
                "messages": outgoing_messages,
                "variables": build_variables_for_session(session.sessionId),
            }

        elif node.type == "condition":
            variables = build_variables_for_session(session.sessionId)
            selected_next_node_id = None

            for rule in node.conditions:
                if condition_matches(rule, variables):
                    selected_next_node_id = rule.nextNodeId
                    break

            current_node_id = selected_next_node_id or node.defaultNextNodeId

    session.waitingAtNodeId = None
    session.status = "completed"

    return {
        "status": "completed",
        "sessionId": session.sessionId,
        "workflowId": session.workflowId,
        "waitingAtNodeId": session.waitingAtNodeId,
        "messages": outgoing_messages,
        "variables": build_variables_for_session(session.sessionId),
    }


@app.get("/")
def home():
    return {
        "message": "WATI-like Workflow Bot Backend is running."
    }


@app.post("/workflows")
def create_workflow(workflow: Workflow):
    validate_workflow(workflow)
    workflows[workflow.id] = workflow

    return {
        "message": "Workflow saved successfully.",
        "workflowId": workflow.id,
        "totalNodes": len(workflow.nodes),
    }


@app.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str):
    workflow = workflows.get(workflow_id)

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail="Workflow not found.",
        )

    return workflow


@app.post("/bot/start/{workflow_id}")
def start_bot(workflow_id: str):
    workflow = workflows.get(workflow_id)

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail="Workflow not found.",
        )

    session = SessionState(
        sessionId=str(uuid4()),
        workflowId=workflow.id,
        waitingAtNodeId=None,
        status="active",
    )

    sessions[session.sessionId] = session

    return execute_workflow_from_node(
        workflow=workflow,
        session=session,
        start_node_id=workflow.startNodeId,
    )


@app.post("/bot/reply")
def reply_to_bot(request: ReplyRequest):
    session = sessions.get(request.sessionId)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    if session.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="This bot session is already completed.",
        )

    workflow = workflows.get(session.workflowId)

    if not workflow:
        raise HTTPException(
            status_code=404,
            detail="Workflow not found.",
        )

    node_map = build_node_map(workflow)
    current_node = node_map.get(session.waitingAtNodeId)

    if not current_node:
        raise HTTPException(
            status_code=400,
            detail="Bot is not waiting for any reply.",
        )

    if current_node.type != "ask_question":
        raise HTTPException(
            status_code=400,
            detail="Current node is not an ask_question node.",
        )

    if current_node.options and request.userReply not in current_node.options:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid option. Allowed options are: {current_node.options}",
        )

    response_record = NodeResponse(
        id=str(uuid4()),
        sessionId=session.sessionId,
        workflowId=session.workflowId,
        nodeId=current_node.id,
        variableName=current_node.variableName,
        question=current_node.question,
        response=request.userReply,
    )

    node_responses.append(response_record)
    session.waitingAtNodeId = None
    session.status = "active"

    return execute_workflow_from_node(
        workflow=workflow,
        session=session,
        start_node_id=current_node.nextNodeId,
    )


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    session = sessions.get(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    return {
        "session": session,
        "variables": build_variables_for_session(session_id),
        "responses": [
            response
            for response in node_responses
            if response.sessionId == session_id
        ],
    }