import os
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from fastapi import HTTPException


def get_whatsapp_access_token() -> str:
    load_dotenv(override=True)
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")

    if not access_token:
        raise HTTPException(
            status_code=500,
            detail="WHATSAPP_ACCESS_TOKEN is not configured.",
        )

    return access_token


def get_whatsapp_api_version() -> str:
    return os.getenv("WHATSAPP_API_VERSION", "v25.0")


def build_whatsapp_messages_url(phone_number_id: str) -> str:
    api_version = get_whatsapp_api_version()

    return f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"


def send_whatsapp_text_message(
    phone_number_id: str,
    to_phone: str,
    text: str,
) -> dict[str, Any]:
    url = build_whatsapp_messages_url(phone_number_id)
    access_token = get_whatsapp_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text,
        },
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=20,
    )

    response_json = {}

    try:
        response_json = response.json()
    except ValueError:
        response_json = {
            "raw_response": response.text,
        }

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Failed to send WhatsApp text message.",
                "meta_status_code": response.status_code,
                "meta_response": response_json,
            },
        )

    return response_json

def send_whatsapp_button_message(
    phone_number_id: str,
    to_phone: str,
    body_text: str,
    buttons: list[dict[str, str]],
) -> dict[str, Any]:
    if not buttons:
        raise HTTPException(
            status_code=400,
            detail="Button message must have at least one button.",
        )

    if len(buttons) > 3:
        raise HTTPException(
            status_code=400,
            detail="WhatsApp reply button message supports maximum 3 buttons.",
        )

    url = build_whatsapp_messages_url(phone_number_id)
    access_token = get_whatsapp_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    whatsapp_buttons = []

    for button in buttons:
        button_id = button.get("id")
        button_title = button.get("title") or button.get("label")

        if not button_id or not button_title:
            raise HTTPException(
                status_code=400,
                detail="Each button must have id and title/label.",
            )

        whatsapp_buttons.append(
            {
                "type": "reply",
                "reply": {
                    "id": button_id,
                    "title": button_title,
                },
            }
        )

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {
                "text": body_text,
            },
            "action": {
                "buttons": whatsapp_buttons,
            },
        },
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=20,
    )

    try:
        response_json = response.json()
    except ValueError:
        response_json = {
            "raw_response": response.text,
        }

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Failed to send WhatsApp button message.",
                "meta_status_code": response.status_code,
                "meta_response": response_json,
            },
        )

    return response_json

def send_whatsapp_list_message(
    phone_number_id: str,
    to_phone: str,
    body_text: str,
    list_config: dict,
) -> dict[str, Any]:
    button_text = list_config.get("button_text") or "Choose option"
    sections = list_config.get("sections", [])

    if not sections:
        raise HTTPException(
            status_code=400,
            detail="List message must have at least one section.",
        )

    total_rows = 0
    whatsapp_sections = []

    for section in sections:
        section_title = section.get("title")
        rows_config = section.get("rows", [])

        if not section_title:
            raise HTTPException(
                status_code=400,
                detail="Each list section must have a title.",
            )

        if not rows_config:
            raise HTTPException(
                status_code=400,
                detail=f"List section '{section_title}' must have at least one row.",
            )

        whatsapp_rows = []

        for row in rows_config:
            row_id = row.get("id")
            row_label = row.get("label")
            row_description = row.get("description")

            if not row_id or not row_label:
                raise HTTPException(
                    status_code=400,
                    detail="Each list row must have id and label.",
                )

            whatsapp_row = {
                "id": row_id,
                "title": row_label,
            }

            if row_description:
                whatsapp_row["description"] = row_description

            whatsapp_rows.append(whatsapp_row)

        total_rows += len(whatsapp_rows)

        whatsapp_sections.append(
            {
                "title": section_title,
                "rows": whatsapp_rows,
            }
        )

    if total_rows > 10:
        raise HTTPException(
            status_code=400,
            detail="WhatsApp list message supports maximum 10 rows in total.",
        )

    url = build_whatsapp_messages_url(phone_number_id)
    access_token = get_whatsapp_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {
                "text": body_text,
            },
            "action": {
                "button": button_text,
                "sections": whatsapp_sections,
            },
        },
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=20,
    )

    try:
        response_json = response.json()
    except ValueError:
        response_json = {
            "raw_response": response.text,
        }

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Failed to send WhatsApp list message.",
                "meta_status_code": response.status_code,
                "meta_response": response_json,
            },
        )

    return response_json


def send_whatsapp_image_message(
    phone_number_id: str,
    to_phone: str,
    image_url: str,
    caption: Optional[str] = None,
) -> dict[str, Any]:
    url = build_whatsapp_messages_url(phone_number_id)
    access_token = get_whatsapp_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone,
        "type": "image",
        "image": {
            "link": image_url,
        },
    }
    if caption:
        payload["image"]["caption"] = caption

    response = requests.post(url, headers=headers, json=payload, timeout=20)
    try:
        response_json = response.json()
    except ValueError:
        response_json = {"raw_response": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Failed to send WhatsApp image message.",
                "meta_status_code": response.status_code,
                "meta_response": response_json,
            },
        )
    return response_json


def send_whatsapp_audio_message(
    phone_number_id: str,
    to_phone: str,
    audio_url: str,
) -> dict[str, Any]:
    url = build_whatsapp_messages_url(phone_number_id)
    access_token = get_whatsapp_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone,
        "type": "audio",
        "audio": {
            "link": audio_url,
        },
    }

    response = requests.post(url, headers=headers, json=payload, timeout=20)
    try:
        response_json = response.json()
    except ValueError:
        response_json = {"raw_response": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Failed to send WhatsApp audio message.",
                "meta_status_code": response.status_code,
                "meta_response": response_json,
            },
        )
    return response_json