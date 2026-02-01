import os
from dotenv import load_dotenv
from redis import Redis
from redisvl.index import SearchIndex
from redisvl.schema import IndexSchema
from sentence_transformers import SentenceTransformer

load_dotenv()  # Load .env vars

# Connect to Redis (using REDIS_URL from .env)
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_client = Redis.from_url(REDIS_URL)

# Offline embedding model (downloads on first run, ~100MB)
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
embedder = SentenceTransformer(EMBEDDING_MODEL)

# Define schema for PrivCode index (unified: vectors + text + metadata)
# This matches doc: HNSW vectors, full-text, JSON metadata, tags for filters
schema = IndexSchema.from_dict({
    'index': {
        'name': 'privcode_index',  # Index name
        'prefix': 'code:',  # Key prefix for docs (e.g., code:123)
    },
    'fields': [
        # For keyword/full-text search (RediSearch)
        {'name': 'content', 'type': 'text', 'attrs': {'weight': 1.0}},
        # For semantic search (HNSW vector index, dim from model)
        {'name': 'vector', 'type': 'vector', 'attrs': {
            'algorithm': 'hnsw',  # Fast approximate nearest neighbors
            'distance_metric': 'cosine',  # Good for text
            'dims': embedder.get_sentence_embedding_dimension(),  # 384 for MiniLM
            'm': 16,  # HNSW params (default balance speed/accuracy)
            'ef_construction': 200
        }},
        # For AST metadata (JSON string)
        {'name': 'metadata', 'type': 'text'},  # Or use RedisJSON if needed
        # Tags for filters (e.g., query only Python files)
        {'name': 'file_path', 'type': 'tag', 'attrs': {'separator': '|'}},
        {'name': 'language', 'type': 'tag', 'attrs': {'separator': '|'}}
    ]
})

# Create or connect to index
index = SearchIndex(schema, redis_client)
if not index.exists():
    index.create()
    print("Created new PrivCode index in Redis.")

def test_connection():
    """Simple test: Ping Redis and check index info."""
    if redis_client.ping():
        print("Redis connected successfully!")
        # Check index stats
        info = index.info()
        print(f"Index stats: {info}")
    else:
        raise ConnectionError("Failed to connect to Redis.")

if __name__ == "__main__":
    test_connection()