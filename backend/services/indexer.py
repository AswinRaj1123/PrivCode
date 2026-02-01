import json
import os
import hashlib
import numpy as np
from pathlib import Path

from git import Repo
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

from ..utils.redis_utils import get_index
from ..utils.ast_parser import extract_ast_metadata
from ..core.logger import setup_logger

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

logger = setup_logger()

ROOT_DIR = Path(__file__).resolve().parents[2]
REPO_PATH = ROOT_DIR / "test_repo"
METADATA_FILE = ".privcode_metadata.json"

CODE_EXTENSIONS = {".py", ".js", ".java", ".ts", ".cpp", ".c", ".go", ".jsx", ".tsx"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "build"}

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# Redis index
index = get_index()

# Embedding model (same one used in redis_utils)
logger.info("🧠 Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# -----------------------------------------------------------------------------
# Metadata helpers (Git incremental indexing)
# -----------------------------------------------------------------------------

def load_metadata(repo_path: Path):
    meta_path = repo_path / METADATA_FILE
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    return {"last_commit": None}


def save_metadata(repo_path: Path, data: dict):
    meta_path = repo_path / METADATA_FILE
    meta_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


# -----------------------------------------------------------------------------
# Chunking helper
# -----------------------------------------------------------------------------

def chunk_code(text: str):
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        start = end - CHUNK_OVERLAP
    return chunks


# -----------------------------------------------------------------------------
# Redis indexing logic
# -----------------------------------------------------------------------------

def index_file(file_path: Path, repo_root: Path):
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        logger.warning("⚠️ Failed to read %s: %s", file_path, exc)
        return

    rel_path = file_path.relative_to(repo_root)
    language = file_path.suffix.lstrip(".")

    chunks = chunk_code(content)

    for i, chunk in enumerate(chunks):
        vector = np.array(
            embedder.encode(chunk),
            dtype=np.float32
        ).tobytes()
        ast_metadata = extract_ast_metadata(chunk, str(rel_path))

        # Stable deterministic Redis key
        doc_id = "code:" + hashlib.sha256(
            f"{rel_path}-{i}".encode()
        ).hexdigest()[:16]

        payload = {
            "content": chunk,
            "vector": vector,
            "metadata": ast_metadata,
            "file_path": str(rel_path),
            "language": language,
        }

        index.load([payload], keys=[doc_id])

    logger.info("📄 Indexed %s (%d chunks)", rel_path, len(chunks))


# -----------------------------------------------------------------------------
# Full index build (Redis)
# -----------------------------------------------------------------------------

def build_full_index(repo_path: Path):
    logger.info("🔄 Building full Redis index...")

    for root, dirs, files in os.walk(repo_path):
        # Skip unwanted directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            file_path = Path(root) / file
            if file_path.suffix.lower() not in CODE_EXTENSIONS:
                continue

            index_file(file_path, repo_path)

    logger.info("✅ Full indexing completed.")


# -----------------------------------------------------------------------------
# Incremental indexing (Git-aware)
# -----------------------------------------------------------------------------

def incremental_index(repo_path: Path):
    try:
        repo = Repo(repo_path)
        current_commit = repo.head.commit.hexsha
    except Exception as exc:
        logger.warning("⚠️ Git error (%s). Running full index.", exc)
        build_full_index(repo_path)
        return

    metadata = load_metadata(repo_path)
    last_commit = metadata.get("last_commit")

    if last_commit == current_commit:
        logger.info("✅ Repository already indexed (no changes).")
        return

    logger.info("🔍 Repository changed — re-indexing...")
    build_full_index(repo_path)

    save_metadata(repo_path, {"last_commit": current_commit})
    logger.info("💾 Updated indexing metadata.")


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    incremental_index(REPO_PATH)