"""
U:Echo — Embedding Service
Generates vector embeddings from gesture metadata for similarity search.
Phase 8 will swap the stub for Jina/Gemini multimodal embeddings.
"""

from __future__ import annotations

import hashlib
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..api.models import MetadataPayload

# Mirrors EMBEDDING_DIMENSIONS from extension shared/constants
EMBEDDING_DIMENSIONS = 1408


def embed_gesture(payload: "MetadataPayload") -> list[float]:
    """
    Generate a deterministic embedding vector from gesture metadata.
    Uses a hash-based approach for consistency in tests.
    Phase 8 replaces with real multimodal embeddings.
    """
    # Build a canonical string from the gesture fields
    g = payload.gesture
    canonical = (
        f"{g.type}|{g.selector}|"
        f"{g.before_bbox.x:.1f},{g.before_bbox.y:.1f},{g.before_bbox.width:.1f},{g.before_bbox.height:.1f}|"
        f"{g.after_bbox.x:.1f},{g.after_bbox.y:.1f},{g.after_bbox.width:.1f},{g.after_bbox.height:.1f}|"
        f"{payload.page_url}"
    )
    return _hash_to_vector(canonical, EMBEDDING_DIMENSIONS)


def embed_text(text: str) -> list[float]:
    """
    Generate a deterministic embedding from a text string.
    Used for intent/prompt embedding and similarity comparison.
    """
    return _hash_to_vector(text.lower().strip(), EMBEDDING_DIMENSIONS)


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


def _hash_to_vector(text: str, dims: int) -> list[float]:
    """
    Deterministic hash-based pseudo-embedding.
    Produces a normalized vector of the given dimensionality.
    """
    # Use SHA-512 iteratively to fill the vector
    vector: list[float] = []
    chunk_idx = 0
    while len(vector) < dims:
        seed = f"{text}:{chunk_idx}"
        digest = hashlib.sha512(seed.encode("utf-8")).hexdigest()
        # Each hex pair → a float in [-1, 1]
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
