"""
U:Echo — Prompt Builder Agent
Assembles a structured PromptSchema from gesture metadata, interpreted intent,
and retrieved similar examples.
"""

from __future__ import annotations

from ..api.models import (
    MetadataPayload,
    PromptSchema,
    BoundingBox,
)


def build_prompt(
    payload: MetadataPayload,
    intent: str,
    retrieved_examples: list[str] | None = None,
) -> PromptSchema:
    """
    Assemble a PromptSchema ready for IDE delivery.
    Phase 8 will enhance this with Gemini-generated descriptions.
    """
    gesture = payload.gesture
    examples = retrieved_examples or []

    visual_desc = _build_visual_description(payload, intent)
    feature_name = _infer_feature_name(gesture.selector, gesture.type)

    return PromptSchema(
        feature_name=feature_name,
        selector=gesture.selector,
        action_type=gesture.type,
        current_dimensions=gesture.before_bbox,
        target_dimensions=gesture.after_bbox,
        gesture_delta=gesture.delta,
        visual_change_description=visual_desc,
        screenshots=[payload.screenshot_url] if payload.screenshot_url else [],
        retrieved_examples_used=examples,
        tab_url=payload.page_url,
        scroll_position={"x": payload.scroll_x, "y": payload.scroll_y},
        extension_session_id=payload.extension_session_id,
        prompt_text=_build_prompt_text(intent, gesture.selector, gesture.type, visual_desc),
    )


def _build_visual_description(payload: MetadataPayload, intent: str) -> str:
    """Generate a human-readable visual change description."""
    g = payload.gesture
    before = g.before_bbox
    after = g.after_bbox

    lines = [intent]

    dw = after.width - before.width
    dh = after.height - before.height
    dx = after.x - before.x
    dy = after.y - before.y

    if abs(dw) > 0.5 or abs(dh) > 0.5:
        lines.append(
            f"Size changed from {before.width:.0f}×{before.height:.0f} "
            f"to {after.width:.0f}×{after.height:.0f}"
        )

    if abs(dx) > 0.5 or abs(dy) > 0.5:
        lines.append(
            f"Position shifted from ({before.x:.0f},{before.y:.0f}) "
            f"to ({after.x:.0f},{after.y:.0f})"
        )

    if payload.viewport_width and payload.viewport_height:
        lines.append(
            f"Viewport: {payload.viewport_width:.0f}×{payload.viewport_height:.0f}"
        )

    return ". ".join(lines)


def _infer_feature_name(selector: str, action_type: str) -> str:
    """Derive a short feature name from selector and action."""
    # Strip CSS punctuation to get readable name
    name = selector.lstrip(".#").split(" ")[-1].split(":")[-1]
    name = name.replace("-", " ").replace("_", " ").title()

    action_labels = {
        "resize": "Resize",
        "move": "Reposition",
        "color": "Restyle",
        "text": "Edit",
        "spacing": "Respace",
        "visibility": "Toggle",
    }
    action_label = action_labels.get(action_type, "Modify")
    return f"{action_label} {name}"


def _build_prompt_text(
    intent: str,
    selector: str,
    action_type: str,
    visual_desc: str,
) -> str:
    """Build the final prompt text sent to the IDE."""
    return (
        f"## Design Change Request\n\n"
        f"**Intent:** {intent}\n\n"
        f"**Target:** `{selector}`\n"
        f"**Action:** {action_type}\n\n"
        f"**Visual Description:**\n{visual_desc}\n"
    )
