"""
U:Echo — Intent Interpreter Agent
Translates raw gesture metadata into a human-readable design intent.
"""

from __future__ import annotations

from ..api.models import MetadataPayload, GestureEvent


def interpret_intent(payload: MetadataPayload) -> str:
    """
    Produce a concise, human-readable design intent from gesture metadata.
    Phase 8 will swap this for a Gemini-backed LLM call.
    """
    gesture = payload.gesture
    action = _describe_action(gesture)
    target = _describe_target(gesture.selector, payload.page_url)
    magnitude = _describe_magnitude(gesture)

    parts = [action, target]
    if magnitude:
        parts.append(magnitude)

    return " — ".join(parts)


def _describe_action(gesture: GestureEvent) -> str:
    """Map gesture type to a descriptive verb phrase."""
    verbs = {
        "resize": "Resize",
        "move": "Move",
        "color": "Change color of",
        "text": "Edit text content of",
        "spacing": "Adjust spacing of",
        "visibility": "Toggle visibility of",
    }
    return verbs.get(gesture.type, f"Modify ({gesture.type})")


def _describe_target(selector: str, page_url: str) -> str:
    """Build a human-readable target description from the CSS selector."""
    # Extract meaningful name from selector
    name = selector
    if "." in selector:
        name = selector.split(".")[-1].replace("-", " ").replace("_", " ")
    elif "#" in selector:
        name = selector.split("#")[-1].replace("-", " ").replace("_", " ")

    route = ""
    if page_url:
        # Extract pathname
        try:
            from urllib.parse import urlparse
            path = urlparse(page_url).path
            if path and path != "/":
                route = f" on {path}"
        except Exception:
            pass

    return f"'{name}' ({selector}){route}"


def _describe_magnitude(gesture: GestureEvent) -> str:
    """Describe the magnitude of change in px."""
    delta = gesture.delta
    parts: list[str] = []

    if delta.resize_right:
        parts.append(f"width {delta.resize_right:+.0f}px")
    if delta.resize_left:
        parts.append(f"width {delta.resize_left:+.0f}px (left)")
    if delta.resize_bottom:
        parts.append(f"height {delta.resize_bottom:+.0f}px")
    if delta.resize_top:
        parts.append(f"height {delta.resize_top:+.0f}px (top)")
    if delta.move_x:
        parts.append(f"x {delta.move_x:+.0f}px")
    if delta.move_y:
        parts.append(f"y {delta.move_y:+.0f}px")

    if not parts:
        dx = gesture.after_bbox.x - gesture.before_bbox.x
        dy = gesture.after_bbox.y - gesture.before_bbox.y
        dw = gesture.after_bbox.width - gesture.before_bbox.width
        dh = gesture.after_bbox.height - gesture.before_bbox.height

        if abs(dw) > 0.5 or abs(dh) > 0.5:
            parts.append(f"Δsize {dw:+.0f}×{dh:+.0f}px")
        if abs(dx) > 0.5 or abs(dy) > 0.5:
            parts.append(f"Δposition {dx:+.0f},{dy:+.0f}px")

    return ", ".join(parts)
