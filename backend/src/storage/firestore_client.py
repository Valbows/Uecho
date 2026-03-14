"""
U:Echo — Firestore Client
Persistent storage for sessions, request history, and prompt records.
Uses Google Cloud Firestore (Native mode).
Falls back to in-memory dicts when Firestore is unavailable (tests, offline dev).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ─── Firestore initialization ────────────────────────────────────

_db = None
_fallback_mode = False


def _get_db():
    """Lazy-init Firestore client. Returns None if unavailable."""
    global _db, _fallback_mode
    if _db is not None:
        return _db
    if _fallback_mode:
        return None

    try:
        from google.cloud import firestore
        _db = firestore.AsyncClient(
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "user-echo-ui-navigator"),
        )
        logger.info("Firestore client initialized (project=%s)", _db.project)
        return _db
    except Exception as e:
        logger.warning("Firestore unavailable, using in-memory fallback: %s", e)
        _fallback_mode = True
        return None


# ─── In-memory fallback stores ───────────────────────────────────

_mem_sessions: dict[str, dict] = {}
_mem_requests: dict[str, dict] = {}


# ─── Collections ─────────────────────────────────────────────────

SESSIONS_COLLECTION = "sessions"
REQUESTS_COLLECTION = "requests"


# ─── Session Operations ─────────────────────────────────────────

async def create_session(session_id: str, data: dict[str, Any]) -> dict:
    """Create or update a session document."""
    doc = {
        **data,
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db = _get_db()
    if db:
        await db.collection(SESSIONS_COLLECTION).document(session_id).set(doc, merge=True)
    else:
        _mem_sessions[session_id] = doc
    return doc


async def get_session(session_id: str) -> dict | None:
    """Retrieve a session by ID."""
    db = _get_db()
    if db:
        snap = await db.collection(SESSIONS_COLLECTION).document(session_id).get()
        return snap.to_dict() if snap.exists else None
    return _mem_sessions.get(session_id)


async def update_session(session_id: str, updates: dict[str, Any]) -> None:
    """Merge updates into an existing session."""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    db = _get_db()
    if db:
        await db.collection(SESSIONS_COLLECTION).document(session_id).set(updates, merge=True)
    else:
        if session_id in _mem_sessions:
            _mem_sessions[session_id].update(updates)
        else:
            _mem_sessions[session_id] = {"session_id": session_id, "created_at": updates["updated_at"], **updates}


# ─── Request / Prompt History ────────────────────────────────────

async def save_request(request_id: str, data: dict[str, Any]) -> dict:
    """Save a processed request (gesture → prompt) to history."""
    doc = {
        **data,
        "request_id": request_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db = _get_db()
    if db:
        await db.collection(REQUESTS_COLLECTION).document(request_id).set(doc)
    else:
        _mem_requests[request_id] = doc
    return doc


async def get_request(request_id: str) -> dict | None:
    """Retrieve a single request by ID."""
    db = _get_db()
    if db:
        snap = await db.collection(REQUESTS_COLLECTION).document(request_id).get()
        return snap.to_dict() if snap.exists else None
    return _mem_requests.get(request_id)


async def list_requests(
    session_id: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """List request history, optionally filtered by session."""
    db = _get_db()
    if db:
        query = db.collection(REQUESTS_COLLECTION).order_by(
            "created_at", direction="DESCENDING"
        ).limit(limit)
        if session_id:
            from google.cloud.firestore_v1.base_query import FieldFilter
            query = query.where(filter=FieldFilter("session_id", "==", session_id))
        docs = []
        async for snap in query.stream():
            docs.append(snap.to_dict())
        return docs
    else:
        items = list(_mem_requests.values())
        if session_id:
            items = [r for r in items if r.get("session_id") == session_id]
        items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return items[:limit]


async def count_requests(session_id: str | None = None) -> int:
    """Count requests, optionally filtered by session."""
    db = _get_db()
    if db:
        query = db.collection(REQUESTS_COLLECTION)
        if session_id:
            from google.cloud.firestore_v1.base_query import FieldFilter
            query = query.where(filter=FieldFilter("session_id", "==", session_id))
        # Use count aggregation
        result = await query.count().get()
        return result[0][0].value if result and result[0] else 0
    else:
        if session_id:
            return sum(1 for r in _mem_requests.values() if r.get("session_id") == session_id)
        return len(_mem_requests)


# ─── Test helpers ────────────────────────────────────────────────

def reset_for_tests() -> None:
    """Reset state for test isolation."""
    global _db, _fallback_mode
    _db = None
    _fallback_mode = True  # Force in-memory mode
    _mem_sessions.clear()
    _mem_requests.clear()
