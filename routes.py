from fastapi import APIRouter,Request, Query, HTTPException
from fastapi.responses import PlainTextResponse
from models import FullSetupRequest, TestWebhookRequest
from services import (
    save_full_setup,
    process_test_webhook,
    get_run_debug_data,
    process_whatsapp_webhook_payload,
    verify_whatsapp_webhook,
)


router = APIRouter()


@router.get("/")
def home():
    return {
        "message": "WATI-like Workflow Bot Backend is running."
    }


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

    print("WHATSAPP WEBHOOK PAYLOAD:")
    print(payload)

    result = process_whatsapp_webhook_payload(payload)

    print("WHATSAPP WEBHOOK RESULT:")
    print(result)

    return {
        "status": "received",
        "result": result,
    }