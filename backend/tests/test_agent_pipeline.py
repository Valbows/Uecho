"""
U:Echo — Unit Tests: Agent Pipeline (Phase 5)
Tests intent interpreter, prompt builder, verification engine,
embedding service, and vector store.
"""

import pytest
from src.api.models import (
    MetadataPayload,
    GestureEvent,
    GestureDelta,
    BoundingBox,
    PromptSchema,
)
from src.agents.intent_interpreter import interpret_intent
from src.agents.prompt_builder import build_prompt
from src.agents.verification import verify_prompt, BLOCKED_SELECTORS
from src.embedding.embedder import (
    embed_gesture,
    embed_text,
    cosine_similarity,
    EMBEDDING_DIMENSIONS,
)
from src.embedding.vector_store import VectorStore
from src.storage.example_store import create_seeded_store, SEED_EXAMPLES


# ─── Fixtures ─────────────────────────────────────────────────────
@pytest.fixture
def resize_payload():
    return MetadataPayload(
        gesture=GestureEvent(
            type="resize",
            selector=".hero-btn",
            before_bbox=BoundingBox(x=10, y=20, width=100, height=40),
            after_bbox=BoundingBox(x=10, y=20, width=140, height=40),
            delta=GestureDelta(resize_right=40),
            timestamp=1709000000000,
        ),
        tab_id=1,
        page_url="http://localhost:3000/home",
        viewport_width=1280,
        viewport_height=720,
        extension_session_id="test-session",
    )


@pytest.fixture
def move_payload():
    return MetadataPayload(
        gesture=GestureEvent(
            type="move",
            selector="#sidebar",
            before_bbox=BoundingBox(x=0, y=0, width=250, height=600),
            after_bbox=BoundingBox(x=50, y=0, width=250, height=600),
            delta=GestureDelta(move_x=50),
            timestamp=1709000000000,
        ),
        tab_id=2,
        page_url="http://localhost:3000/dashboard",
        viewport_width=1920,
        viewport_height=1080,
        extension_session_id="test-session-2",
    )


# ─── Intent Interpreter ──────────────────────────────────────────
class TestIntentInterpreter:
    def test_resize_intent_contains_action(self, resize_payload):
        intent = interpret_intent(resize_payload)
        assert "resize" in intent.lower()

    def test_resize_intent_contains_selector(self, resize_payload):
        intent = interpret_intent(resize_payload)
        assert ".hero-btn" in intent

    def test_resize_intent_contains_magnitude(self, resize_payload):
        intent = interpret_intent(resize_payload)
        assert "40px" in intent

    def test_move_intent_contains_action(self, move_payload):
        intent = interpret_intent(move_payload)
        assert "move" in intent.lower()

    def test_move_intent_contains_selector(self, move_payload):
        intent = interpret_intent(move_payload)
        assert "#sidebar" in intent

    def test_intent_includes_route(self, resize_payload):
        intent = interpret_intent(resize_payload)
        assert "/home" in intent

    def test_all_action_types_produce_intent(self):
        for action_type in ["resize", "move", "color", "text", "spacing", "visibility"]:
            payload = MetadataPayload(
                gesture=GestureEvent(
                    type=action_type,
                    selector=".test",
                    before_bbox=BoundingBox(x=0, y=0, width=100, height=100),
                    after_bbox=BoundingBox(x=0, y=0, width=100, height=100),
                    delta=GestureDelta(),
                    timestamp=1709000000000,
                ),
                tab_id=1,
                page_url="http://localhost:3000",
            )
            intent = interpret_intent(payload)
            assert len(intent) > 0


# ─── Prompt Builder ───────────────────────────────────────────────
class TestPromptBuilder:
    def test_builds_prompt_schema(self, resize_payload):
        intent = interpret_intent(resize_payload)
        prompt = build_prompt(resize_payload, intent)
        assert isinstance(prompt, PromptSchema)

    def test_prompt_has_feature_name(self, resize_payload):
        prompt = build_prompt(resize_payload, "Resize hero button")
        assert len(prompt.feature_name) > 0

    def test_prompt_has_selector(self, resize_payload):
        prompt = build_prompt(resize_payload, "test")
        assert prompt.selector == ".hero-btn"

    def test_prompt_has_action_type(self, resize_payload):
        prompt = build_prompt(resize_payload, "test")
        assert prompt.action_type == "resize"

    def test_prompt_has_visual_description(self, resize_payload):
        prompt = build_prompt(resize_payload, "Resize the button")
        assert len(prompt.visual_change_description) > 0

    def test_prompt_has_prompt_text(self, resize_payload):
        prompt = build_prompt(resize_payload, "Resize hero button wider")
        assert "## Design Change Request" in prompt.prompt_text
        assert ".hero-btn" in prompt.prompt_text

    def test_prompt_includes_retrieved_examples(self, resize_payload):
        examples = ["Example 1: resize button", "Example 2: widen card"]
        prompt = build_prompt(resize_payload, "test", examples)
        assert prompt.retrieved_examples_used == examples

    def test_prompt_includes_screenshot(self):
        payload = MetadataPayload(
            gesture=GestureEvent(
                type="resize",
                selector=".card",
                before_bbox=BoundingBox(x=0, y=0, width=200, height=100),
                after_bbox=BoundingBox(x=0, y=0, width=300, height=100),
                delta=GestureDelta(resize_right=100),
                timestamp=1709000000000,
            ),
            screenshot_url="data:image/png;base64,abc123",
            tab_id=1,
            page_url="http://localhost:3000",
        )
        prompt = build_prompt(payload, "test")
        assert "data:image/png;base64,abc123" in prompt.screenshots

    def test_prompt_dimensions(self, resize_payload):
        prompt = build_prompt(resize_payload, "test")
        assert prompt.current_dimensions.width == 100
        assert prompt.target_dimensions.width == 140


# ─── Verification Engine ─────────────────────────────────────────
class TestVerificationEngine:
    def test_valid_prompt_passes_schema(self, resize_payload):
        intent = interpret_intent(resize_payload)
        prompt = build_prompt(resize_payload, intent)
        result = verify_prompt(prompt, intent)
        assert result.schema_valid is True

    def test_valid_prompt_passes_safety(self, resize_payload):
        intent = interpret_intent(resize_payload)
        prompt = build_prompt(resize_payload, intent)
        result = verify_prompt(prompt, intent)
        assert result.safety_passed is True

    def test_empty_feature_name_fails_schema(self):
        prompt = PromptSchema(
            feature_name="",
            selector=".btn",
            action_type="resize",
            current_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
            target_dimensions=BoundingBox(x=0, y=0, width=120, height=40),
            visual_change_description="test",
            prompt_text="test prompt",
        )
        result = verify_prompt(prompt, "test")
        assert result.schema_valid is False
        assert any("feature_name" in e for e in result.errors)

    def test_blocked_selector_fails_safety(self):
        prompt = PromptSchema(
            feature_name="Bad Target",
            selector="body",
            action_type="resize",
            current_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
            target_dimensions=BoundingBox(x=0, y=0, width=120, height=40),
            visual_change_description="test",
            prompt_text="test prompt",
        )
        result = verify_prompt(prompt, "test")
        assert result.safety_passed is False
        assert any("blocked" in e.lower() for e in result.errors)

    def test_universal_selector_fails_safety(self):
        prompt = PromptSchema(
            feature_name="All Elements",
            selector="*",
            action_type="resize",
            current_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
            target_dimensions=BoundingBox(x=0, y=0, width=120, height=40),
            visual_change_description="test",
            prompt_text="test prompt",
        )
        result = verify_prompt(prompt, "test")
        assert result.safety_passed is False

    def test_drift_score_is_float(self, resize_payload):
        intent = interpret_intent(resize_payload)
        prompt = build_prompt(resize_payload, intent)
        result = verify_prompt(prompt, intent)
        assert isinstance(result.semantic_drift_score, float)
        assert 0.0 <= result.semantic_drift_score <= 1.0

    def test_blocked_keywords_fail_safety(self):
        prompt = PromptSchema(
            feature_name="Injection",
            selector=".safe",
            action_type="text",
            current_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
            target_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
            visual_change_description="test",
            prompt_text="exec( dangerous code )",
        )
        result = verify_prompt(prompt, "test")
        assert result.safety_passed is False

    def test_all_blocked_selectors_rejected(self):
        for sel in BLOCKED_SELECTORS:
            prompt = PromptSchema(
                feature_name="Test",
                selector=sel,
                action_type="resize",
                current_dimensions=BoundingBox(x=0, y=0, width=100, height=40),
                target_dimensions=BoundingBox(x=0, y=0, width=120, height=40),
                visual_change_description="test",
                prompt_text="test prompt",
            )
            result = verify_prompt(prompt, "test")
            assert result.safety_passed is False, f"Selector '{sel}' should be blocked"


# ─── Embedding Service ───────────────────────────────────────────
class TestEmbeddingService:
    def test_embed_gesture_returns_correct_dims(self, resize_payload):
        vec = embed_gesture(resize_payload)
        assert len(vec) == EMBEDDING_DIMENSIONS

    def test_embed_text_returns_correct_dims(self):
        vec = embed_text("resize a button wider")
        assert len(vec) == EMBEDDING_DIMENSIONS

    def test_embedding_is_normalized(self, resize_payload):
        import math
        vec = embed_gesture(resize_payload)
        norm = math.sqrt(sum(x * x for x in vec))
        assert abs(norm - 1.0) < 0.01

    def test_same_input_same_output(self, resize_payload):
        v1 = embed_gesture(resize_payload)
        v2 = embed_gesture(resize_payload)
        assert v1 == v2

    def test_different_input_different_output(self, resize_payload, move_payload):
        v1 = embed_gesture(resize_payload)
        v2 = embed_gesture(move_payload)
        assert v1 != v2

    def test_cosine_similarity_identical(self):
        vec = embed_text("hello world")
        assert abs(cosine_similarity(vec, vec) - 1.0) < 0.001

    def test_cosine_similarity_range(self):
        v1 = embed_text("resize button")
        v2 = embed_text("move sidebar")
        sim = cosine_similarity(v1, v2)
        assert -1.0 <= sim <= 1.0


# ─── Vector Store ─────────────────────────────────────────────────
class TestVectorStore:
    def test_empty_store(self):
        store = VectorStore()
        assert store.size == 0
        assert store.search(embed_text("test")) == []

    def test_add_and_size(self):
        store = VectorStore()
        store.add("1", "test entry", embed_text("test entry"))
        assert store.size == 1

    def test_search_returns_results(self):
        store = VectorStore()
        store.add("1", "resize a button", embed_text("resize a button"))
        store.add("2", "move a sidebar", embed_text("move a sidebar"))
        results = store.search(embed_text("make button bigger"))
        assert len(results) > 0

    def test_search_respects_top_k(self):
        store = VectorStore()
        for i in range(10):
            store.add(str(i), f"entry {i}", embed_text(f"entry {i}"))
        results = store.search(embed_text("test"), top_k=3)
        assert len(results) == 3

    def test_search_returns_scores(self):
        store = VectorStore()
        store.add("1", "resize btn", embed_text("resize btn"))
        results = store.search(embed_text("resize btn"))
        entry, score = results[0]
        assert abs(score - 1.0) < 0.001  # identical text → perfect match

    def test_clear(self):
        store = VectorStore()
        store.add("1", "test", embed_text("test"))
        store.clear()
        assert store.size == 0


# ─── Seeded Example Store ────────────────────────────────────────
class TestExampleStore:
    def test_seeded_store_has_entries(self):
        store = create_seeded_store()
        assert store.size == len(SEED_EXAMPLES)

    def test_seeded_store_search_returns_results(self):
        store = create_seeded_store()
        results = store.search(embed_text("resize a button wider"))
        assert len(results) > 0

    def test_seeded_store_resize_query_matches_resize_examples(self):
        store = create_seeded_store()
        results = store.search(embed_text("resize a button wider"), top_k=3)
        categories = [entry.metadata.get("category") for entry, _ in results]
        assert "resize" in categories
