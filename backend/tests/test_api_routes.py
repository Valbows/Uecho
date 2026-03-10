"""
U:Echo — Backend Unit & Integration Tests: API Routes
Tests all FastAPI endpoints for correct request/response contracts.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from src.api.routes import app


client = TestClient(app)


# ─── Unit Tests: Health Endpoint ─────────────────────────────────
class TestHealthEndpoint:
    def test_health_returns_200(self):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_returns_ok_status(self):
        data = client.get("/api/health").json()
        assert data["status"] == "ok"

    def test_health_includes_version(self):
        data = client.get("/api/health").json()
        assert "version" in data
        assert data["version"] == "0.1.0"

    def test_health_includes_project(self):
        data = client.get("/api/health").json()
        assert "project" in data

    def test_health_includes_timestamp(self):
        data = client.get("/api/health").json()
        assert "timestamp" in data
        assert len(data["timestamp"]) > 0


# ─── Unit Tests: Process Gesture Endpoint ────────────────────────
class TestProcessGestureEndpoint:
    @pytest.fixture
    def valid_gesture_payload(self):
        return {
            "gesture": {
                "type": "resize",
                "selector": ".hero-title",
                "before_bbox": {"x": 0, "y": 0, "width": 200, "height": 40},
                "after_bbox": {"x": 0, "y": 0, "width": 240, "height": 48},
                "delta": {"resize_right": 40, "resize_bottom": 8},
                "timestamp": 1709000000000,
            },
            "screenshot_url": "",
            "tab_id": 1,
            "page_url": "http://localhost:3000",
            "scroll_x": 0,
            "scroll_y": 100,
            "viewport_width": 1280,
            "viewport_height": 720,
            "extension_session_id": "sess-test-001",
        }

    def test_process_gesture_returns_200(self, valid_gesture_payload):
        response = client.post("/api/process-gesture", json=valid_gesture_payload)
        assert response.status_code == 200

    def test_process_gesture_returns_agent_response(self, valid_gesture_payload):
        data = client.post("/api/process-gesture", json=valid_gesture_payload).json()
        assert "interpreted_intent" in data
        assert "status" in data
        assert data["status"] in ("success", "needs_review")

    def test_process_gesture_includes_selector_in_intent(self, valid_gesture_payload):
        data = client.post("/api/process-gesture", json=valid_gesture_payload).json()
        assert ".hero-title" in data["interpreted_intent"]

    def test_process_gesture_includes_action_type_in_intent(self, valid_gesture_payload):
        data = client.post("/api/process-gesture", json=valid_gesture_payload).json()
        assert "resize" in data["interpreted_intent"].lower()

    def test_process_gesture_rejects_invalid_payload(self):
        response = client.post("/api/process-gesture", json={"invalid": True})
        assert response.status_code == 422

    def test_process_gesture_rejects_missing_gesture(self):
        response = client.post(
            "/api/process-gesture",
            json={"tab_id": 1, "page_url": "http://localhost:3000"},
        )
        assert response.status_code == 422

    def test_process_gesture_accepts_minimal_payload(self):
        payload = {
            "gesture": {
                "type": "move",
                "selector": "div#main",
                "before_bbox": {"x": 0, "y": 0, "width": 100, "height": 100},
                "after_bbox": {"x": 10, "y": 0, "width": 100, "height": 100},
                "delta": {"move_x": 10},
                "timestamp": 1709000000000,
            },
            "tab_id": 1,
            "page_url": "http://localhost:3000",
        }
        response = client.post("/api/process-gesture", json=payload)
        assert response.status_code == 200


# ─── Unit Tests: Enhance Text Endpoint ───────────────────────────
class TestEnhanceTextEndpoint:
    def test_enhance_text_returns_200(self):
        response = client.post(
            "/api/enhance-text", json={"text": "Make the button larger"}
        )
        assert response.status_code == 200

    def test_enhance_text_returns_enhanced_text(self):
        data = client.post(
            "/api/enhance-text", json={"text": "Make the button larger"}
        ).json()
        assert "enhanced_text" in data

    def test_enhance_text_returns_suggestions(self):
        data = client.post(
            "/api/enhance-text", json={"text": "Make the button larger"}
        ).json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)

    def test_enhance_text_rejects_missing_text(self):
        response = client.post("/api/enhance-text", json={})
        assert response.status_code == 422


# ─── Unit Tests: Send to IDE Endpoint ────────────────────────────
class TestSendToIdeEndpoint:
    @pytest.fixture
    def valid_prompt_payload(self):
        return {
            "prompt": {
                "feature_name": "Enlarge Hero Title",
                "selector": "h1.hero-title",
                "action_type": "resize",
                "current_dimensions": {"x": 0, "y": 0, "width": 200, "height": 40},
                "target_dimensions": {"x": 0, "y": 0, "width": 240, "height": 48},
                "visual_change_description": "Make 20% larger",
                "screenshots": [],
                "retrieved_examples_used": [],
                "tab_url": "http://localhost:3000",
                "scroll_position": {"x": 0, "y": 0},
                "extension_session_id": "sess-001",
                "prompt_text": "Resize h1 to 240x48",
            },
            "ide_target": "windsurf",
        }

    @staticmethod
    def _mock_bridge_response():
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "accepted": True,
            "delivered": False,
            "queued": True,
            "prompt_id": "bridge-test-001",
            "ide_target": "windsurf",
            "format": "markdown",
        }
        return mock_resp

    def test_send_to_ide_returns_200(self, valid_prompt_payload):
        mock_resp = self._mock_bridge_response()
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("httpx.AsyncClient", return_value=mock_client):
            response = client.post("/api/send-to-ide", json=valid_prompt_payload)
        assert response.status_code == 200

    def test_send_to_ide_returns_prompt_id(self, valid_prompt_payload):
        mock_resp = self._mock_bridge_response()
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("httpx.AsyncClient", return_value=mock_client):
            data = client.post("/api/send-to-ide", json=valid_prompt_payload).json()
        assert "prompt_id" in data
        assert data["prompt_id"] == "bridge-test-001"

    def test_send_to_ide_returns_503_when_bridge_down(self, valid_prompt_payload):
        """send-to-ide should return 503 when MCP bridge is unreachable."""
        import httpx as _httpx
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=_httpx.ConnectError("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("httpx.AsyncClient", return_value=mock_client):
            response = client.post("/api/send-to-ide", json=valid_prompt_payload)
        assert response.status_code == 503


# ─── Unit Tests: Export CSV Endpoint ─────────────────────────────
class TestExportCsvEndpoint:
    def test_export_csv_returns_200(self):
        response = client.get("/api/export/csv")
        assert response.status_code == 200

    def test_export_csv_returns_count(self):
        data = client.get("/api/export/csv").json()
        assert "count" in data
        assert isinstance(data["count"], int)

    def test_export_csv_accepts_session_id_param(self):
        response = client.get("/api/export/csv?session_id=sess-001")
        assert response.status_code == 200


# ─── Integration Tests: Request Pipeline ─────────────────────────
class TestRequestPipeline:
    """Tests the full request flow from gesture → intent → response."""

    def test_full_gesture_to_response_pipeline(self):
        payload = {
            "gesture": {
                "type": "resize",
                "selector": "#submit-btn",
                "before_bbox": {"x": 100, "y": 200, "width": 120, "height": 40},
                "after_bbox": {"x": 100, "y": 200, "width": 160, "height": 48},
                "delta": {"resize_right": 40, "resize_bottom": 8},
                "timestamp": 1709000000000,
            },
            "screenshot_url": "data:image/png;base64,mockdata",
            "tab_id": 1,
            "page_url": "http://localhost:3000/checkout",
            "scroll_x": 0,
            "scroll_y": 500,
            "viewport_width": 1920,
            "viewport_height": 1080,
            "extension_session_id": "sess-integration-001",
        }

        response = client.post("/api/process-gesture", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["status"] in ("success", "needs_review")
        assert len(data["interpreted_intent"]) > 0
        assert "#submit-btn" in data["interpreted_intent"]

    def test_multiple_action_types(self):
        """Ensure all action types are accepted."""
        action_types = ["resize", "move", "text", "color", "image", "code"]

        for action_type in action_types:
            payload = {
                "gesture": {
                    "type": action_type,
                    "selector": f".test-{action_type}",
                    "before_bbox": {"x": 0, "y": 0, "width": 100, "height": 50},
                    "after_bbox": {"x": 0, "y": 0, "width": 100, "height": 50},
                    "delta": {},
                    "timestamp": 1709000000000,
                },
                "tab_id": 1,
                "page_url": "http://localhost:3000",
            }
            response = client.post("/api/process-gesture", json=payload)
            assert response.status_code == 200, f"Failed for action_type={action_type}"


# ─── Performance Tests: Response Latency ─────────────────────────
class TestResponseLatency:
    """Validates API response times meet targets."""

    def test_health_responds_under_100ms(self):
        import time

        start = time.monotonic()
        client.get("/api/health")
        elapsed_ms = (time.monotonic() - start) * 1000
        assert elapsed_ms < 100, f"Health endpoint took {elapsed_ms:.1f}ms"

    def test_gesture_processing_under_500ms(self):
        import time

        payload = {
            "gesture": {
                "type": "resize",
                "selector": ".perf-test",
                "before_bbox": {"x": 0, "y": 0, "width": 100, "height": 50},
                "after_bbox": {"x": 0, "y": 0, "width": 120, "height": 60},
                "delta": {"resize_right": 20, "resize_bottom": 10},
                "timestamp": 1709000000000,
            },
            "tab_id": 1,
            "page_url": "http://localhost:3000",
        }

        start = time.monotonic()
        client.post("/api/process-gesture", json=payload)
        elapsed_ms = (time.monotonic() - start) * 1000
        assert elapsed_ms < 500, f"Gesture processing took {elapsed_ms:.1f}ms"
