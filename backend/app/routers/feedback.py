"""Feedback submission endpoint.

Deprecated CourtPulse feedback transport retained for reference only.

The Expo client no longer routes submissions here because paste.rs is not durable
private storage. Production feedback must use the Supabase submit-feedback Edge
Function and feedback_reports table. Do not configure EXPO_PUBLIC_FEEDBACK_ENDPOINT
to this route. The brrr helpers remain solely as a reference for best-effort
notification behavior until the Edge Function is deployed.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

PASTE_RS_URL = "https://paste.rs/"
BRRR_NOTIFY_URL = os.getenv("BRRR_NOTIFY_URL", "")
BRRR_BEARER_TOKEN = os.getenv("BRRR_BEARER_TOKEN", "")

FEEDBACK_TYPE_LABEL: dict[str, str] = {
    "bug": "Bug Report",
    "feature_request": "Feature Request",
    "data_issue": "Data Issue",
    "ux_feedback": "UX Feedback",
    "performance": "Performance Report",
    "question": "Question",
}

FEEDBACK_NOTIFY_MESSAGE: dict[str, str] = {
    "bug": "New Bug Report",
    "feature_request": "New Feature Request",
    "data_issue": "New Data Issue",
    "ux_feedback": "New UX Feedback",
    "performance": "New Performance Report",
    "question": "New Question",
}

SENSITIVE_KEY_PATTERN = re.compile(
    r"(authorization|bearer|api[_-]?key|secret|password|token)",
    re.IGNORECASE,
)


class FeedbackContext(BaseModel):
    screen: str | None = None
    subscreen: str | None = None
    gameId: str | None = None
    filters: dict[str, Any] | None = None
    extra: dict[str, Any] | None = None


class FeedbackApp(BaseModel):
    name: str | None = None
    version: str | None = None
    buildChannel: str | None = None
    platform: str | None = None
    platformVersion: Any | None = None
    isDevice: bool | None = None


class FeedbackRequest(BaseModel):
    type: str
    title: str
    description: str
    expectedBehavior: str | None = None
    actualBehavior: str | None = None
    reproSteps: str | None = None
    testerName: str | None = None
    testerContact: str | None = None
    timestamp: str | None = None
    context: FeedbackContext | None = None
    app: FeedbackApp | None = None
    flags: dict[str, Any] | None = Field(default=None)


def _redact(value: str | None) -> str | None:
    if not value:
        return value
    redacted = re.sub(
        r"(?i)(bearer|authorization|api[_-]?key|secret|password|token)\s*[:=]\s*\S+",
        r"\1: [REDACTED]",
        value,
    )
    return redacted


def _redact_dict(data: dict[str, Any] | None) -> dict[str, Any]:
    if not data:
        return {}
    out: dict[str, Any] = {}
    for k, v in data.items():
        if SENSITIVE_KEY_PATTERN.search(k):
            out[k] = "[REDACTED]"
        elif isinstance(v, str):
            out[k] = _redact(v)
        elif isinstance(v, dict):
            out[k] = _redact_dict(v)
        else:
            out[k] = v
    return out


def _section(title: str, body: str | None) -> str:
    if not body or not body.strip():
        return ""
    return f"## {title}\n{_redact(body.strip())}\n\n"


def format_feedback_markdown(req: FeedbackRequest) -> str:
    type_label = FEEDBACK_TYPE_LABEL.get(req.type, req.type)
    ctx = req.context or FeedbackContext()
    appinfo = req.app or FeedbackApp()

    lines: list[str] = []
    lines.append("# CourtPulse User Submission")
    lines.append("")
    lines.append(f"Type: {type_label}")
    lines.append(f"Title: {_redact(req.title) or ''}")
    if req.timestamp:
        lines.append(f"Timestamp: {req.timestamp}")
    lines.append("")

    body = "".join(
        [
            _section("Description", req.description),
            _section("Expected Behavior", req.expectedBehavior),
            _section("Actual Behavior", req.actualBehavior),
            _section("Steps to Reproduce", req.reproSteps),
        ]
    )
    lines.append(body.rstrip())
    lines.append("")

    lines.append("## Context")
    if ctx.screen:
        lines.append(f"Screen: {ctx.screen}")
    if ctx.subscreen:
        lines.append(f"Subscreen: {ctx.subscreen}")
    if ctx.gameId:
        lines.append(f"Game ID: {ctx.gameId}")
    if ctx.filters:
        lines.append(f"Filters: {_redact_dict(ctx.filters)}")
    if ctx.extra:
        lines.append(f"Extra: {_redact_dict(ctx.extra)}")
    if appinfo.version:
        lines.append(f"App Version: {appinfo.version} ({appinfo.buildChannel or 'unknown'})")
    if appinfo.platform:
        lines.append(f"Platform: {appinfo.platform} {appinfo.platformVersion or ''}".strip())
    if req.flags:
        safe_flags = {
            "channel": req.flags.get("channel"),
            "enabled": req.flags.get("enabled"),
            "overrides": req.flags.get("overrides"),
        }
        lines.append(f"Flags: {safe_flags}")
    lines.append("")

    if req.testerName or req.testerContact:
        lines.append("## Reporter")
        if req.testerName:
            lines.append(f"Name: {_redact(req.testerName)}")
        if req.testerContact:
            lines.append(f"Contact: {_redact(req.testerContact)}")

    return "\n".join(lines).strip() + "\n"


async def _post_to_paste_rs(content: str) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            PASTE_RS_URL,
            content=content.encode("utf-8"),
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
    if resp.status_code not in (200, 201, 206):
        logger.warning("[Feedback] paste.rs failed status=%s", resp.status_code)
        raise HTTPException(status_code=502, detail=f"paste.rs returned {resp.status_code}")
    url = resp.text.strip()
    if not url.startswith("http"):
        raise HTTPException(status_code=502, detail="paste.rs returned invalid URL")
    return url


def _redact_url(url: str) -> str:
    """Mask the secret portion of a brrr webhook URL for safe logging."""
    if not url:
        return ""
    try:
        # keep scheme + host + path prefix, mask trailing secret
        m = re.match(r"(https?://[^/]+/v1/)(.*)", url)
        if not m:
            return "[REDACTED_URL]"
        prefix, secret = m.group(1), m.group(2)
        if not secret:
            return prefix
        tail = secret[-4:] if len(secret) >= 4 else ""
        return f"{prefix}***{tail}"
    except Exception:  # noqa: BLE001
        return "[REDACTED_URL]"


async def _send_brrr_notification(title: str, message: str, open_url: str) -> dict[str, Any]:
    """Send a brrr.now push notification.

    brrr.now supports two auth modes:
      1. Secret embedded in URL path (https://api.brrr.now/v1/br_usr_...)
      2. POST https://api.brrr.now/v1/send with Authorization: Bearer <secret>

    We only attach the Authorization header when the URL is the generic /v1/send
    endpoint, otherwise the bearer header is unnecessary and may be rejected.
    """
    result: dict[str, Any] = {"sent": False, "status": None, "reason": None}
    if not BRRR_NOTIFY_URL:
        logger.warning("[Feedback] BRRR_NOTIFY_URL not configured; skipping notification")
        result["reason"] = "missing_url"
        return result

    headers: dict[str, str] = {"Content-Type": "application/json"}
    uses_send_endpoint = BRRR_NOTIFY_URL.rstrip("/").endswith("/v1/send")
    if uses_send_endpoint and BRRR_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {BRRR_BEARER_TOKEN}"

    payload: dict[str, Any] = {
        "title": title,
        "message": message,
        "open_url": open_url,
        "sound": "default",
        "interruption_level": "time-sensitive",
        "thread_id": "courtpulse-feedback",
    }

    safe_url = _redact_url(BRRR_NOTIFY_URL)
    logger.info(
        "[Feedback] brrr notify -> url=%s send_endpoint=%s auth_header=%s payload_keys=%s",
        safe_url,
        uses_send_endpoint,
        "Authorization" in headers,
        list(payload.keys()),
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(BRRR_NOTIFY_URL, json=payload, headers=headers)
        result["status"] = resp.status_code
        body_preview = (resp.text or "")[:300]
        if resp.status_code >= 400:
            logger.warning(
                "[Feedback] brrr notify failed status=%s body=%s",
                resp.status_code,
                body_preview,
            )
            result["reason"] = f"http_{resp.status_code}"
            result["body"] = body_preview
            return result
        logger.info(
            "[Feedback] brrr notify ok status=%s body=%s",
            resp.status_code,
            body_preview,
        )
        result["sent"] = True
        result["body"] = body_preview
        return result
    except Exception as e:  # noqa: BLE001
        logger.warning("[Feedback] brrr notify exception: %s: %s", type(e).__name__, e)
        result["reason"] = f"exception_{type(e).__name__}"
        return result


@router.post("")
@router.post("/")
async def submit_feedback(req: FeedbackRequest) -> dict[str, Any]:
    logger.info(
        "[Feedback] received type=%s title_len=%s screen=%s",
        req.type,
        len(req.title or ""),
        (req.context.screen if req.context else None),
    )

    markdown = format_feedback_markdown(req)
    paste_url = await _post_to_paste_rs(markdown)
    logger.info("[Feedback] paste created %s", paste_url)

    notify_message = FEEDBACK_NOTIFY_MESSAGE.get(req.type, "Click here to view submission")
    notify_result = await _send_brrr_notification(
        title="CourtPulse User Submission \u2b07\ufe0f",
        message=notify_message,
        open_url=paste_url,
    )

    return {
        "ok": True,
        "pasteUrl": paste_url,
        "notified": notify_result.get("sent", False),
        "notifyStatus": notify_result.get("status"),
        "notifyReason": notify_result.get("reason"),
    }


@router.get("/_diag/brrr")
async def brrr_diagnostic() -> dict[str, Any]:
    """Dev diagnostic: send a test brrr notification with a known-good payload.

    Does NOT echo the secret URL or bearer token. Only logs a redacted form.
    """
    result = await _send_brrr_notification(
        title="CourtPulse Diagnostic \u2705",
        message="Test notification from /api/feedback/_diag/brrr",
        open_url="https://brrr.now/docs",
    )
    return {
        "configured": bool(BRRR_NOTIFY_URL),
        "hasBearer": bool(BRRR_BEARER_TOKEN),
        "urlPreview": _redact_url(BRRR_NOTIFY_URL),
        "result": result,
    }
