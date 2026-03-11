"""
U:Echo — FastAPI Backend Routes
REST API endpoints for the agent pipeline.
"""

import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    BoundingBox,
    GestureDelta,
    GestureEvent,
    MetadataPayload,
    PromptSchema,
    VerificationResult,
    AgentResponse,
    TextEnhanceRequest,
    SendToIdeRequest,
)
from ..agents.intent_interpreter import interpret_intent
from ..agents.prompt_builder import build_prompt
from ..agents.verification import verify_prompt
from ..embedding.embedder import embed_gesture
from ..storage.example_store import create_seeded_store

load_dotenv()

# ─── Initialize Vector Store with seed examples ─────────────────
_vector_store = create_seeded_store()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="U:Echo Backend",
    version="0.1.0",
    description="Agent pipeline backend for the U:Echo Chrome extension",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:*",
        "http://127.0.0.1:*",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ─── Health ──────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "project": os.getenv("GOOGLE_CLOUD_PROJECT", "user-echo-ui-navigator"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Process Gesture ─────────────────────────────────────────────
@app.post("/api/process-gesture", response_model=AgentResponse)
@limiter.limit("30/minute")
async def process_gesture(request: Request, payload: MetadataPayload):
    """
    Main agent pipeline entry point.
    1. Action Recorder → interpret gesture
    2. Embedding → multimodal vector
    3. Vector Search → retrieve examples
    4. Prompt Builder → structured prompt
    5. Verification → schema + safety + drift check
    """
    try:
        # 1. Interpret gesture → human-readable intent
        intent = interpret_intent(payload)

        # 2. Embed gesture for similarity search
        gesture_vector = embed_gesture(payload)

        # 3. Retrieve similar examples from vector store
        results = _vector_store.search(gesture_vector)
        retrieved_examples = [entry.text for entry, _score in results]

        # 4. Build structured prompt
        prompt = build_prompt(payload, intent, retrieved_examples)

        # 5. Verify prompt quality
        verification = verify_prompt(prompt, intent)

        status = "success"
        if not verification.schema_valid or not verification.safety_passed:
            status = "error"
        elif verification.drift_warning:
            status = "needs_review"

        return AgentResponse(
            interpreted_intent=intent,
            prompt=prompt,
            verification=verification,
            status=status,
        )
    except Exception as e:
        logger.exception("process_gesture failed")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Enhance Text ────────────────────────────────────────────────
@app.post("/api/enhance-text")
@limiter.limit("30/minute")
async def enhance_text(request: Request, body: TextEnhanceRequest):
    """Use LLM to enhance user's natural language description."""
    try:
        # TODO: Phase 5 — use Gemini to enhance text
        return {
            "enhanced_text": body.text,
            "suggestions": [],
        }
    except Exception as e:
        logger.exception("enhance_text failed")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Upload Screenshot ───────────────────────────────────────────
@app.post("/api/upload-screenshot")
@limiter.limit("10/minute")
async def upload_screenshot(request: Request, file: UploadFile = File(...)):
    """Upload a screenshot to Cloud Storage."""
    try:
        # TODO: Phase 5 — upload to GCS
        filename = f"screenshots/{uuid.uuid4()}.png"
        return {
            "url": f"gs://user-echo-ui-navigator.appspot.com/{filename}",
            "filename": filename,
        }
    except Exception as e:
        logger.exception("upload_screenshot failed")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Send to IDE ─────────────────────────────────────────────────
MCP_BRIDGE_URL = os.getenv("MCP_BRIDGE_URL", "http://localhost:3939")

@app.post("/api/send-to-ide")
@limiter.limit("20/minute")
async def send_to_ide(request: Request, body: SendToIdeRequest):
    """Forward confirmed prompt to MCP bridge."""
    try:
        payload = {
            "prompt_text": body.prompt.prompt_text,
            "feature_name": body.prompt.feature_name,
            "selector": body.prompt.selector,
            "action_type": body.prompt.action_type,
            "ide_target": body.ide_target,
            "metadata": body.prompt.metadata if hasattr(body.prompt, "metadata") else None,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{MCP_BRIDGE_URL}/prompt", json=payload)
            resp.raise_for_status()
            bridge_result = resp.json()
        return {
            "sent": bridge_result.get("accepted", False),
            "prompt_id": bridge_result.get("prompt_id"),
            "ide_target": bridge_result.get("ide_target"),
            "format": bridge_result.get("format"),
        }
    except httpx.HTTPStatusError as e:
        logger.exception("MCP bridge returned error")
        raise HTTPException(status_code=502, detail="MCP bridge error")
    except httpx.ConnectError:
        logger.warning("MCP bridge unreachable at %s", MCP_BRIDGE_URL)
        raise HTTPException(status_code=503, detail="MCP bridge unavailable")
    except Exception as e:
        logger.exception("send_to_ide failed")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Export CSV ──────────────────────────────────────────────────
@app.get("/api/export/csv")
async def export_csv(session_id: str | None = None):
    """Export request history as CSV."""
    try:
        # TODO: Phase 9 — implement Firestore query + CSV generation
        return {"download_url": "", "count": 0}
    except Exception as e:
        logger.exception("export_csv failed")
        raise HTTPException(status_code=500, detail="Internal server error")
