"""
U:Echo — Firebase Auth Middleware
Verifies Firebase ID tokens on protected API routes.
Falls back to no-auth mode when firebase-admin is not configured (tests, local dev).
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_firebase_app = None
_auth_disabled = False
_firebase_init_lock = threading.Lock()

security = HTTPBearer(auto_error=False)


def _auth_required() -> bool:
    return os.getenv("FIREBASE_AUTH_REQUIRED", "").lower() in {"1", "true", "yes", "on"}


def _init_firebase() -> bool:
    """Initialize Firebase Admin SDK once. Returns True if available."""
    global _firebase_app, _auth_disabled
    if _firebase_app is not None:
        return True
    if _auth_disabled:
        return False

    with _firebase_init_lock:
        # Re-check after acquiring lock
        if _firebase_app is not None:
            return True
        if _auth_disabled:
            return False
        if not _auth_required():
            _auth_disabled = True
            return False

        try:
            import firebase_admin
            from firebase_admin import credentials

            # Use ADC or explicit service account
            sa_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if sa_path and os.path.exists(sa_path):
                cred = credentials.Certificate(sa_path)
            else:
                cred = credentials.ApplicationDefault()

            _firebase_app = firebase_admin.initialize_app(cred, {
                "projectId": os.getenv("GOOGLE_CLOUD_PROJECT", "user-echo-ui-navigator"),
            })
            logger.info("Firebase Admin SDK initialized")
            return True
        except Exception as e:
            if _auth_required():
                raise RuntimeError(f"Firebase Auth is required but initialization failed: {e}") from e
            logger.warning("Firebase Auth unavailable: %s — auth disabled", e)
            _auth_disabled = True
            return False


async def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any] | None:
    """
    FastAPI dependency that verifies Firebase ID tokens.
    Returns decoded token claims or None if auth is disabled.
    Raises 401 if auth is enabled but token is invalid/missing.
    """
    if not _init_firebase():
        # Auth not configured — allow all requests (local dev / tests)
        return None

    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        from firebase_admin import auth
        decoded = await asyncio.to_thread(auth.verify_id_token, credentials.credentials)
        return decoded
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Expired Firebase ID token")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token")
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication failed")


def disable_auth_for_tests() -> None:
    """Force auth bypass for test environment."""
    global _firebase_app, _auth_disabled
    _firebase_app = None
    _auth_disabled = True
