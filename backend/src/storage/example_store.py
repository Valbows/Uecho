"""
U:Echo — Example Store
Seed examples for vector retrieval. These represent previously-seen
gesture→prompt pairs that the system can reference.
Phase 9 will load these from Firestore instead.
"""

from __future__ import annotations

from ..embedding.embedder import embed_text
from ..embedding.vector_store import VectorStore

# Seed examples — representative gesture descriptions and their prompt snippets
SEED_EXAMPLES: list[dict[str, str]] = [
    {
        "id": "ex-resize-btn",
        "text": "Resize a button element wider by 20px to improve touch target size",
        "category": "resize",
    },
    {
        "id": "ex-resize-card",
        "text": "Resize a card component taller by 40px to accommodate additional content",
        "category": "resize",
    },
    {
        "id": "ex-move-nav",
        "text": "Move navigation bar 50px down to make room for announcement banner",
        "category": "move",
    },
    {
        "id": "ex-move-sidebar",
        "text": "Reposition sidebar element 200px to the right for wider main content area",
        "category": "move",
    },
    {
        "id": "ex-color-header",
        "text": "Change header background color from blue to a darker shade for better contrast",
        "category": "color",
    },
    {
        "id": "ex-text-heading",
        "text": "Edit heading text content to update the page title for the new feature",
        "category": "text",
    },
    {
        "id": "ex-spacing-grid",
        "text": "Increase grid gap spacing by 8px for better visual separation between items",
        "category": "spacing",
    },
    {
        "id": "ex-resize-hero",
        "text": "Resize hero section to full viewport width and increase height by 100px",
        "category": "resize",
    },
    {
        "id": "ex-move-modal",
        "text": "Center modal dialog by adjusting position to viewport center coordinates",
        "category": "move",
    },
    {
        "id": "ex-visibility-tooltip",
        "text": "Toggle tooltip visibility on hover for the settings icon element",
        "category": "visibility",
    },
]


def create_seeded_store() -> VectorStore:
    """Create a VectorStore pre-loaded with seed examples."""
    store = VectorStore()
    for example in SEED_EXAMPLES:
        vector = embed_text(example["text"])
        store.add(
            entry_id=example["id"],
            text=example["text"],
            vector=vector,
            metadata={"category": example["category"]},
        )
    return store
