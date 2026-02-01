import os
from dotenv import load_dotenv
from redis import Redis
from redisvl.index import SearchIndex
from redisvl.schema import IndexSchema
from sentence_transformers import SentenceTransformer

load_dotenv()

# Redis connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = Redis.from_url(REDIS_URL, decode_responses=False)

# Embedding model (offline, small)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
embedder = SentenceTransformer(EMBEDDING_MODEL)
VECTOR_DIMS = embedder.get_sentence_embedding_dimension()  # 384

# Redis index schema (matches architecture doc)
schema = IndexSchema.from_dict({
    "index": {
        "name": "privcode_index",
        "prefix": "code:",
        "storage_type": "hash"
    },
    "fields": [
        {"name": "content", "type": "text"},
        {
            "name": "vector",
            "type": "vector",
            "attrs": {
                "dims": VECTOR_DIMS,
                "algorithm": "hnsw",
                "distance_metric": "cosine",
                "datatype": "float32"
            }
        },
        {"name": "metadata", "type": "text"},
        {"name": "file_path", "type": "tag"},
        {"name": "language", "type": "tag"}
    ]
})

index = SearchIndex(schema, redis_client, validate=False)

if not index.exists():
    index.create()
    print("✅ Created Redis index: privcode_index")
else:
    print("✅ Connected to existing Redis index")

def get_index():
    return index

def test_redis():
    assert redis_client.ping()
    print("✅ Redis ping OK")
    print(index.info())

if __name__ == "__main__":
    test_redis()