# redis_utils.py — Lazy-initialised Redis + Embedding singletons
"""
All heavy resources (Redis connection, embedding model, search index) are
created on first use, NOT at import time.  This lets a single orchestrator
(main.py / FastAPI lifespan) control initialization order.
"""

import os

from dotenv import load_dotenv
from redis import Redis
from redisvl.index import SearchIndex
from redisvl.schema import IndexSchema
from sentence_transformers import SentenceTransformer

from core.logger import setup_logger

load_dotenv()

logger = setup_logger()

# ── Configuration (read-only, no side effects) ──────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# ── Lazy singletons ─────────────────────────────────────────────────
_redis_client = None
_embedder = None
_vector_dims = None
_index = None


def get_redis_client():
    """Lazily connect to Redis (singleton)."""
    global _redis_client
    if _redis_client is None:
        logger.info("🔗 Connecting to Redis at %s ...", REDIS_URL)
        _redis_client = Redis.from_url(REDIS_URL, decode_responses=False)
        _redis_client.ping()
        logger.info("✅ Redis connection established")
    return _redis_client


def get_embedder():
    """Lazily load the SentenceTransformer embedding model (singleton)."""
    global _embedder, _vector_dims
    if _embedder is None:
        logger.info("🧠 Loading embedding model: %s ...", EMBEDDING_MODEL)
        _embedder = SentenceTransformer(EMBEDDING_MODEL)
        _vector_dims = _embedder.get_sentence_embedding_dimension()
        logger.info("✅ Embedding model loaded (dims=%d)", _vector_dims)
    return _embedder


def get_vector_dims():
    """Return embedding vector dimensions (loads model if needed)."""
    global _vector_dims
    if _vector_dims is None:
        get_embedder()
    return _vector_dims


def _build_schema():
    """Build the RediSearch index schema using current vector dims."""
    dims = get_vector_dims()
    return IndexSchema.from_dict({
        "index": {
            "name": "privcode_index",
            "prefix": "code:",
            "storage_type": "hash",
        },
        "fields": [
            {"name": "content", "type": "text"},
            {
                "name": "vector",
                "type": "vector",
                "attrs": {
                    "dims": dims,
                    "algorithm": "hnsw",
                    "distance_metric": "cosine",
                    "datatype": "float32",
                },
            },
            {"name": "metadata", "type": "text"},
            {"name": "file_path", "type": "tag"},
            {"name": "language", "type": "tag"},
        ],
    })


def get_index():
    """Lazily create / connect to the RediSearch index (singleton)."""
    global _index
    if _index is None:
        client = get_redis_client()
        schema = _build_schema()
        _index = SearchIndex(schema, client, validate=False)
        if not _index.exists():
            _index.create()
            logger.info("✅ Created Redis index: privcode_index")
        else:
            logger.info("✅ Connected to existing Redis index: privcode_index")
    return _index


# ── Convenience ──────────────────────────────────────────────────────

def test_redis():
    """Quick connectivity check (dev / debugging)."""
    client = get_redis_client()
    assert client.ping()
    print("✅ Redis ping OK")
    idx = get_index()
    print(idx.info())


if __name__ == "__main__":
    test_redis()