import json
import numpy as np

from redisvl.query import VectorQuery
from sentence_transformers import SentenceTransformer

from ..utils.redis_utils import get_index
from ..core.logger import setup_logger

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

logger = setup_logger()

TOP_K = 5
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

embedder = SentenceTransformer(EMBEDDING_MODEL)
index = get_index()

# -----------------------------------------------------------------------------
# Hybrid Retrieval (Redis-native)
# -----------------------------------------------------------------------------

def hybrid_retrieve(
    query: str,
    top_k: int = TOP_K,
    language_filter: str | None = None,
):
    """
    Perform hybrid retrieval using Redis:
    - Vector similarity (HNSW)
    - Keyword matching (RediSearch)
    - Optional tag filters (language, file_path later)
    """

    # Encode query -> float32 bytes (MUST match indexer)
    query_vector = np.array(
        embedder.encode(query),
        dtype=np.float32
    ).tobytes()

    # Base vector query
    vq = VectorQuery(
        vector=query_vector,
        vector_field_name="vector",
        num_results=top_k,
        return_fields=[
            "content",
            "metadata",
            "file_path",
            "language",
        ],
        return_score=True,
    )

    # Optional language filter
    if language_filter:
        vq.set_filter("language", language_filter)

    # Execute Redis query
    results = index.query(vq)

    formatted = []
    for r in results:
        formatted.append({
            "score": float(r["vector_distance"]),
            "content": r["content"],
            "metadata": json.loads(r["metadata"]),
            "file_path": r["file_path"],
            "language": r["language"],
        })

    # Lower distance = better similarity
    formatted.sort(key=lambda x: x["score"])

    return formatted[:top_k]

# -----------------------------------------------------------------------------
# CLI test (dev only)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("PrivCode Redis Retriever Ready")
    print("=" * 60)

    while True:
        q = input("\n🔍 Ask about your codebase (or 'exit'): ").strip()
        if q.lower() in {"exit", "quit", "q"}:
            break

        results = hybrid_retrieve(q)

        if not results:
            print("❌ No results found.")
            continue

        for i, res in enumerate(results, 1):
            print(
                f"\n{i}. Score: {res['score']:.4f} | "
                f"{res['file_path']} ({res['language']})"
            )
            print("-" * 60)
            print(res["content"].strip())
            print("-" * 60)
