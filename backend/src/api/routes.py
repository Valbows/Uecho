"""
U:Echo — FastAPI Backend Routes
REST API endpoints for the agent pipeline.
"""

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(
    title="U:Echo Backend",
    version="0.1.0",
    description="Agent pipeline backend for the U:Echo Chrome extension",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost:*",
        "http://127.0.0.1:*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ───────────────────────────────────
class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class GestureDelta(BaseModel):
    resize_right: float | None = None
    resize_bottom: float | None = None
    resize_left: float | None = None
    resize_top: float | None = None
    move_x: float | None = None
    move_y: float | None = None


class GestureEvent(BaseModel):
    type: str
    selector: str
    before_bbox: BoundingBox
    after_bbox: BoundingBox
    delta: GestureDelta
    grid_cell: dict | None = None
    timestamp: float


class MetadataPayload(BaseModel):
    gesture: GestureEvent
    screenshot_url: str = ""
    tab_id: int
    page_url: str
    scroll_x: float = 0
    scroll_y: float = 0
    viewport_width: float = 0
    viewport_height: float = 0
    extension_session_id: str = ""


class PromptSchema(BaseModel):
    feature_name: str
    selector: str
    component_path: str | None = None
    action_type: str
    current_dimensions: BoundingBox
    target_dimensions: dict
    gesture_delta: GestureDelta | None = None
    visual_change_description: str
    non_visual_changes: str | None = None
    screenshots: list[str] = []
    retrieved_examples_used: list[str] = []
    risk_notes: str | None = None
    open_questions: str | None = None
    tab_url: str = ""
    route_path: str | None = None
    scroll_position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    extension_session_id: str = ""
    prompt_text: str = ""


class VerificationResult(BaseModel):
    schema_valid: bool
    safety_passed: bool
    consistency_passed: bool
    semantic_drift_score: float
    drift_warning: bool
    errors: list[str] = []
    warnings: list[str] = []


class AgentResponse(BaseModel):
    interpreted_intent: str = ""
    prompt: PromptSchema | None = None
    verification: VerificationResult | None = None
    status: str = "success"
    error_message: str | None = None


class TextEnhanceRequest(BaseModel):
    text: str
    metadata: dict | None = None


class SendToIdeRequest(BaseModel):
    prompt: PromptSchema
    ide_target: str = "windsurf"


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
async def process_gesture(payload: MetadataPayload):
    """
    Main agent pipeline entry point.
    1. Action Recorder → interpret gesture
    2. Embedding → multimodal vector
    3. Vector Search → retrieve examples
    4. Prompt Builder → structured prompt
    5. Verification → schema + safety + drift check
    """
    try:
        # TODO: Phase 5 — implement full ADK agent pipeline
        # For now, return a stub response
        gesture = payload.gesture
        intent = (
            f"{gesture.type} the element '{gesture.selector}' — "
            f"moved from ({gesture.before_bbox.x:.0f}, {gesture.before_bbox.y:.0f}) "
            f"to ({gesture.after_bbox.x:.0f}, {gesture.after_bbox.y:.0f})"
        )

        return AgentResponse(
            interpreted_intent=intent,
            status="success",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Enhance Text ────────────────────────────────────────────────
@app.post("/api/enhance-text")
async def enhance_text(request: TextEnhanceRequest):
    """Use LLM to enhance user's natural language description."""
    try:
        # TODO: Phase 5 — use Gemini to enhance text
        return {
            "enhanced_text": request.text,
            "suggestions": [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Upload Screenshot ───────────────────────────────────────────
@app.post("/api/upload-screenshot")
async def upload_screenshot(file: UploadFile = File(...)):
    """Upload a screenshot to Cloud Storage."""
    try:
        # TODO: Phase 5 — upload to GCS
        filename = f"screenshots/{uuid.uuid4()}.png"
        return {
            "url": f"gs://user-echo-ui-navigator.appspot.com/{filename}",
            "filename": filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Send to IDE ─────────────────────────────────────────────────
@app.post("/api/send-to-ide")
async def send_to_ide(request: SendToIdeRequest):
    """Forward confirmed prompt to MCP bridge."""
    try:
        # TODO: Phase 7 — forward to MCP bridge at localhost:3939
        return {
            "sent": False,
            "reason": "MCP bridge integration not yet implemented",
            "prompt_id": str(uuid.uuid4()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Export CSV ──────────────────────────────────────────────────
@app.get("/api/export/csv")
async def export_csv(session_id: str | None = None):
    """Export request history as CSV."""
    try:
        # TODO: Phase 9 — implement Firestore query + CSV generation
        return {"download_url": "", "count": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
