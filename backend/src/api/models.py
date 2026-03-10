"""
U:Echo — Pydantic Request / Response Models
Shared across routes, agents, embedding, and storage modules.
"""

from pydantic import BaseModel, Field


# ─── Core Models ───────────────────────────────────────────────────
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


# ─── Prompt / Verification ────────────────────────────────────────
class PromptSchema(BaseModel):
    feature_name: str
    selector: str
    component_path: str | None = None
    action_type: str
    current_dimensions: BoundingBox
    target_dimensions: BoundingBox
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


# ─── Endpoint-specific Models ─────────────────────────────────────
class TextEnhanceRequest(BaseModel):
    text: str
    metadata: dict | None = None


class SendToIdeRequest(BaseModel):
    prompt: PromptSchema
    ide_target: str = "windsurf"
