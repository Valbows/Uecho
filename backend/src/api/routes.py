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
from pydantic import BaseModel, Field

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
        import google.generativeai as genai
        
        api_key = os.getenv('GEMINI_API_KEY')
        model_name = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite-preview')
        
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        prompt = f"""You are a UI/UX design assistant. The user has described a UI change they want to make:

"{body.text}"

Your task:
1. Clarify and enhance their description to be more specific and actionable
2. Identify the key UI elements involved
3. Suggest any accessibility or usability improvements

Respond with a concise, enhanced version of their request (2-3 sentences max) that a developer could act on immediately."""
        
        response = await model.generate_content_async(prompt)
        enhanced = response.text.strip() if response.text else body.text
        
        return {
            "enhanced_text": enhanced,
            "suggestions": [],
        }
    except Exception as e:
        logger.warning("enhance_text LLM failed, returning original text: %s", e)
        return {
            "enhanced_text": body.text,
            "suggestions": [],
        }


# ─── Generate Prompt from Text ───────────────────────────────────
class GeneratePromptRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    selector: str = Field(default="body", max_length=500)
    page_url: str = Field(default="", max_length=2000)
    action_type: str = Field(default="modify", max_length=50)


@app.post("/api/generate-prompt", response_model=AgentResponse)
@limiter.limit("20/minute")
async def generate_prompt(request: Request, body: GeneratePromptRequest):
    """
    Generate a structured PromptSchema from a natural language description.
    Uses Gemini LLM to interpret the user's intent and build an actionable prompt.
    """
    try:
        import google.generativeai as genai
        import json as _json

        api_key = os.getenv("GEMINI_API_KEY")
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")

        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)

        llm_prompt = f"""You are a UI/UX engineering assistant. Given a user's natural language description of a UI change, generate a structured JSON prompt that a developer can act on.

User's request: "{body.text}"
Target selector: "{body.selector}"
Page URL: "{body.page_url}"
Action type hint: "{body.action_type}"

Respond ONLY with valid JSON (no markdown, no explanation) matching this schema:
{{
  "feature_name": "short name for the change (3-5 words)",
  "visual_change_description": "detailed description of the visual change",
  "action_type": "one of: resize, move, color, text, layout, style, modify",
  "prompt_text": "A clear, developer-ready instruction paragraph describing exactly what to change and how"
}}"""

        response = await model.generate_content_async(llm_prompt)
        raw = response.text.strip() if response.text else ""

        # Parse LLM JSON response
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        try:
            parsed = _json.loads(raw)
        except _json.JSONDecodeError:
            parsed = {
                "feature_name": "UI Change",
                "visual_change_description": body.text,
                "action_type": body.action_type,
                "prompt_text": body.text,
            }

        prompt = PromptSchema(
            feature_name=parsed.get("feature_name", "UI Change"),
            selector=body.selector,
            action_type=parsed.get("action_type", body.action_type),
            current_dimensions=BoundingBox(x=0, y=0, width=0, height=0),
            target_dimensions=BoundingBox(x=0, y=0, width=0, height=0),
            visual_change_description=parsed.get("visual_change_description", body.text),
            tab_url=body.page_url,
            prompt_text=parsed.get("prompt_text", body.text),
            extension_session_id="",
        )

        verification = verify_prompt(prompt, body.text)

        status = "success"
        if not verification.schema_valid or not verification.safety_passed:
            status = "error"
        elif verification.drift_warning:
            status = "needs_review"

        return AgentResponse(
            interpreted_intent=body.text,
            prompt=prompt,
            verification=verification,
            status=status,
        )
    except Exception as e:
        logger.warning("generate_prompt failed, returning basic prompt: %s", e)
        # Graceful fallback: return a basic prompt without LLM
        prompt = PromptSchema(
            feature_name="UI Change",
            selector=body.selector,
            action_type=body.action_type,
            current_dimensions=BoundingBox(x=0, y=0, width=0, height=0),
            target_dimensions=BoundingBox(x=0, y=0, width=0, height=0),
            visual_change_description=body.text,
            tab_url=body.page_url,
            prompt_text=body.text,
            extension_session_id="",
        )
        return AgentResponse(
            interpreted_intent=body.text,
            prompt=prompt,
            verification=None,
            status="fallback",
        )


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
