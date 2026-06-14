from fastapi import APIRouter

from models import FullSetupRequest, TestWebhookRequest
from services import (
    save_full_setup,
    process_test_webhook,
    get_run_debug_data,
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


@router.post("/webhook/test")
def test_webhook(request: TestWebhookRequest):
    return process_test_webhook(request)


@router.get("/runs/debug")
def debug_run(workflow_run_id: str):
    return get_run_debug_data(workflow_run_id)