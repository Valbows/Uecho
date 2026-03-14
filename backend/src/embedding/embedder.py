"""
U:Echo — Embedding Service
Generates vector embeddings from gesture metadata for similarity search.
Uses gemini-embedding-2-preview (3072-dim) via Google AI Studio.
Falls back to deterministic hash-based embeddings when GEMINI_API_KEY is not set.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..api.models import MetadataPayload

logger = logging.getLogger(__name__)

# Mirrors EMBEDDING_DIMENSIONS from extension shared/constants
EMBEDDING_DIMENSIONS = 3072

# ─── Gemini configuration ────────────────────────────────────────

_genai_client = None


def _ensure_genai():
    """Create google.genai Client once. Returns the client or None."""
    global _genai_client
    if _genai_client is not None:
        return _genai_client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai
        _genai_client = genai.Client(api_key=api_key)
        logger.info("Gemini embedding client initialized (google.genai)")
        return _genai_client
    except Exception as e:
        logger.warning("Failed to create Gemini client: %s", e)
        return None


def _get_embedding_model() -> str:
    return os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2-preview")


# ─── Public API ──────────────────────────────────────────────────

async def embed_gesture(payload: "MetadataPayload") -> list[float]:
    """
    Generate an embedding vector from gesture metadata.
    Builds a text description from gesture fields and embeds it.
    """
    g = payload.gesture
    canonical = (
        f"{g.type}|{g.selector}|"
        f"{g.before_bbox.x:.1f},{g.before_bbox.y:.1f},{g.before_bbox.width:.1f},{g.before_bbox.height:.1f}|"
        f"{g.after_bbox.x:.1f},{g.after_bbox.y:.1f},{g.after_bbox.width:.1f},{g.after_bbox.height:.1f}|"
        f"{payload.page_url}"
    )
    return await _embed(canonical, task_type="RETRIEVAL_DOCUMENT")


async def embed_text(text: str) -> list[float]:
    """
    Generate an embedding from a text string.
    Used for intent/prompt embedding and similarity comparison.
    """
    return await _embed(text.lower().strip(), task_type="RETRIEVAL_DOCUMENT")


async def embed_query(text: str) -> list[float]:
    """
    Generate a query embedding (uses RETRIEVAL_QUERY task type for asymmetric search).
    """
    return await _embed(text.lower().strip(), task_type="RETRIEVAL_QUERY")


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b) or len(a) == 0:
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot / (norm_a * norm_b)


# ─── Internal ────────────────────────────────────────────────────

async def _embed(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Route to real Gemini embeddings or hash fallback."""
    client = _ensure_genai()
    if client is not None:
        return await _gemini_embed(client, text, task_type)
    return _hash_to_vector(text, EMBEDDING_DIMENSIONS)


async def _gemini_embed(client, text: str, task_type: str) -> list[float]:
    """Call Gemini embedding API via google.genai native async."""
    try:
        from google.genai import types

        model_name = _get_embedding_model()

        result = await client.aio.models.embed_content(
            model=model_name,
            contents=text,
            config=types.EmbedContentConfig(task_type=task_type),
        )
        if not result.embeddings:
            logger.warning("Gemini returned empty embeddings — using hash fallback")
            return _hash_to_vector(text, EMBEDDING_DIMENSIONS)
        return list(result.embeddings[0].values)
    except Exception as e:
        logger.warning("Gemini embedding failed: %s — using hash fallback", e)
        return _hash_to_vector(text, EMBEDDING_DIMENSIONS)


def _hash_to_vector(text: str, dims: int) -> list[float]:
    """
    Deterministic hash-based pseudo-embedding fallback.
    Used when GEMINI_API_KEY is not set (tests, offline dev).
    """
    vector: list[float] = []
    chunk_idx = 0
    while len(vector) < dims:
        seed = f"{text}:{chunk_idx}"
        digest = hashlib.sha512(seed.encode("utf-8")).hexdigest()
        for i in range(0, len(digest) - 1, 2):
            if len(vector) >= dims:
                break
            byte_val = int(digest[i : i + 2], 16)
            vector.append((byte_val / 127.5) - 1.0)
        chunk_idx += 1

    # L2-normalize
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]

    return vector
