"""
U:Echo — Vector Store
ChromaDB-backed vector store with cosine similarity search.
Persists to disk at data/chroma/ by default; use ephemeral=True for tests.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

import chromadb

logger = logging.getLogger(__name__)

# Mirrors VECTOR_SEARCH_TOP_K from extension constants
VECTOR_SEARCH_TOP_K = 3

# Default persistent path (relative to backend root)
_DEFAULT_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "chroma"
)


@dataclass
class VectorEntry:
    """A stored vector with its associated text/metadata."""
    id: str
    text: str
    vector: list[float]
    metadata: dict = field(default_factory=dict)


class VectorStore:
    """ChromaDB-backed vector store with cosine similarity search."""

    def __init__(
        self,
        collection_name: str = "uecho_examples",
        persist_dir: str | None = None,
        ephemeral: bool = False,
    ) -> None:
        if ephemeral:
            self._client = chromadb.EphemeralClient()
        else:
            path = persist_dir or _DEFAULT_PERSIST_DIR
            os.makedirs(path, exist_ok=True)
            self._client = chromadb.PersistentClient(path=path)
            logger.info("ChromaDB persistent store at %s", path)

        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    @property
    def size(self) -> int:
        return self._collection.count()

    def add(self, entry_id: str, text: str, vector: list[float], metadata: dict | None = None) -> None:
        """Add a vector entry to the store (upsert to avoid duplicates on re-seed)."""
        kwargs: dict = dict(ids=[entry_id], documents=[text], embeddings=[vector])
        # ChromaDB rejects empty metadata dicts — only pass if non-empty
        if metadata:
            kwargs["metadatas"] = [metadata]
        self._collection.upsert(**kwargs)

    def search(self, query_vector: list[float], top_k: int = VECTOR_SEARCH_TOP_K) -> list[tuple[VectorEntry, float]]:
        """
        Find the top_k most similar entries to the query vector.
        Returns list of (entry, similarity_score) tuples, sorted descending.
        ChromaDB returns cosine *distance*; we convert to similarity = 1 - distance.
        """
        if self._collection.count() == 0:
            return []

        results = self._collection.query(
            query_embeddings=[query_vector],
            n_results=min(top_k, self._collection.count()),
            include=["documents", "embeddings", "metadatas", "distances"],
        )

        entries: list[tuple[VectorEntry, float]] = []
        ids = results["ids"][0] if results["ids"] else []
        docs = results["documents"][0] if results["documents"] else []
        embeds = results["embeddings"][0] if results["embeddings"] else []
        metas = results["metadatas"][0] if results["metadatas"] else []
        dists = results["distances"][0] if results["distances"] else []

        for i, eid in enumerate(ids):
            similarity = 1.0 - dists[i]  # cosine distance → cosine similarity
            entry = VectorEntry(
                id=eid,
                text=docs[i] if i < len(docs) else "",
                vector=list(embeds[i]) if i < len(embeds) else [],
                metadata=metas[i] if i < len(metas) else {},
            )
            entries.append((entry, similarity))

        return entries

    def clear(self) -> None:
        """Remove all entries from the collection."""
        if self._collection.count() > 0:
            all_ids = self._collection.get()["ids"]
            if all_ids:
                self._collection.delete(ids=all_ids)
