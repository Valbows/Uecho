"""
U:Echo — Pytest Configuration & Fixtures
"""

import os
import pytest
from fastapi.testclient import TestClient

from src.api.routes import app


@pytest.fixture(scope="session", autouse=True)
def _disable_external_services():
    """Prevent tests from hitting real Gemini API and Firestore."""
    # Disable Gemini embeddings — use hash fallback
    old_key = os.environ.pop("GEMINI_API_KEY", None)
    from src.embedding import embedder
    embedder._genai_client = None

    # Force Firestore into in-memory fallback
    from src.storage import firestore_client
    firestore_client.reset_for_tests()

    # Disable Firebase Auth — allow unauthenticated test requests
    from src.auth import firebase_auth
    firebase_auth.disable_auth_for_tests()

    yield

    if old_key is not None:
        os.environ["GEMINI_API_KEY"] = old_key
        embedder._genai_client = None


@pytest.fixture
def client():
    """Reusable FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def sample_gesture():
    """Sample gesture event for testing."""
    return {
        "type": "resize",
        "selector": ".test-element",
        "before_bbox": {"x": 0, "y": 0, "width": 200, "height": 40},
        "after_bbox": {"x": 0, "y": 0, "width": 240, "height": 48},
        "delta": {"resize_right": 40, "resize_bottom": 8},
        "timestamp": 1709000000000,
    }


@pytest.fixture
def sample_metadata_payload(sample_gesture):
    """Sample metadata payload with gesture."""
    return {
        "gesture": sample_gesture,
        "screenshot_url": "",
        "tab_id": 1,
        "page_url": "http://localhost:3000",
        "scroll_x": 0,
        "scroll_y": 0,
        "viewport_width": 1280,
        "viewport_height": 720,
        "extension_session_id": "sess-test-001",
    }
