"""
U:Echo — Vector Store
In-memory cosine similarity search over embedded gesture examples.
Phase 8 will swap for ChromaDB or Vertex AI Vector Search.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .embedder import cosine_similarity

# Mirrors VECTOR_SEARCH_TOP_K from extension constants
VECTOR_SEARCH_TOP_K = 3


@dataclass
class VectorEntry:
    """A stored vector with its associated text/metadata."""
    id: str
    text: str
    vector: list[float]
    metadata: dict = field(default_factory=dict)


class VectorStore:
    """In-memory vector store with cosine similarity search."""

    def __init__(self) -> None:
        self._entries: list[VectorEntry] = []

    @property
    def size(self) -> int:
        return len(self._entries)

    def add(self, entry_id: str, text: str, vector: list[float], metadata: dict | None = None) -> None:
        """Add a vector entry to the store."""
        self._entries.append(VectorEntry(
            id=entry_id,
            text=text,
            vector=vector,
            metadata=metadata or {},
        ))

    def search(self, query_vector: list[float], top_k: int = VECTOR_SEARCH_TOP_K) -> list[tuple[VectorEntry, float]]:
        """
        Find the top_k most similar entries to the query vector.
        Returns list of (entry, similarity_score) tuples, sorted descending.
        """
        if not self._entries:
            return []

        scored = [
            (entry, cosine_similarity(query_vector, entry.vector))
            for entry in self._entries
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def clear(self) -> None:
        """Remove all entries."""
        self._entries = []
