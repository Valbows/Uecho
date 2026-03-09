"""
U:Echo — Pytest Configuration & Fixtures
"""

import pytest
from fastapi.testclient import TestClient

from src.api.routes import app


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
