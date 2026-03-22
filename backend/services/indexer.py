import json
import os
import re
import hashlib
import shutil
import numpy as np
from pathlib import Path
from urllib.parse import urlparse

from git import Repo, GitCommandError
from tqdm import tqdm

from utils.redis_utils import get_index, get_embedder
from utils.ast_parser import extract_ast_metadata
from core.logger import setup_logger

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

logger = setup_logger()

ROOT_DIR = Path(__file__).resolve().parents[2]
REPO_PATH = ROOT_DIR / "test_repo"
REPOS_DIR = ROOT_DIR / "repos"          # cloned remote repos live here
METADATA_FILE = ".privcode_metadata.json"

CODE_EXTENSIONS = {".py", ".js", ".java", ".ts", ".cpp", ".c", ".go", ".jsx", ".tsx"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "build"}

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

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
        logger.warning("Failed to read %s: %s", file_path, exc)
        return

    rel_path = file_path.relative_to(repo_root)
    language = file_path.suffix.lstrip(".")

    chunks = chunk_code(content)

    for i, chunk in enumerate(chunks):
        vector = np.array(
            get_embedder().encode(chunk),
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

        get_index().load([payload], keys=[doc_id])

    logger.info("Indexed %s (%d chunks)", rel_path, len(chunks))


# -----------------------------------------------------------------------------
# Full index build (Redis)
# -----------------------------------------------------------------------------

def build_full_index(repo_path: Path):
    logger.info("Building full Redis index...")

    for root, dirs, files in os.walk(repo_path):
        # Skip unwanted directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            file_path = Path(root) / file
            if file_path.suffix.lower() not in CODE_EXTENSIONS:
                continue

            index_file(file_path, repo_path)

    logger.info("Full indexing completed.")


# -----------------------------------------------------------------------------
# Remote URL detection + clone / pull
# -----------------------------------------------------------------------------

_GIT_URL_RE = re.compile(
    r"^(https?://|git@|ssh://)",
    re.IGNORECASE,
)


def _is_git_url(path_or_url: str) -> bool:
    """Return True if the string looks like a remote Git URL."""
    return bool(_GIT_URL_RE.match(path_or_url.strip()))


def _repo_dir_name(url: str) -> str:
    """Derive a clean folder name from a Git URL."""
    parsed = urlparse(url.strip().rstrip("/"))
    # e.g. github.com/user/repo.git → user_repo
    path = parsed.path.lstrip("/").removesuffix(".git")
    return path.replace("/", "_").replace("\\", "_")


def resolve_repo_path(path_or_url: str) -> Path:
    """
    If *path_or_url* is a remote Git URL, clone it (or pull if already cloned)
    into REPOS_DIR and return the local path.  Otherwise treat it as a local
    path and return as-is.
    """
    if not _is_git_url(path_or_url):
        return Path(path_or_url).expanduser().resolve()

    url = path_or_url.strip()
    dest = REPOS_DIR / _repo_dir_name(url)
    REPOS_DIR.mkdir(parents=True, exist_ok=True)

    if dest.exists() and (dest / ".git").is_dir():
        # Already cloned — pull latest changes
        logger.info("Pulling latest from %s ...", url)
        try:
            repo = Repo(str(dest))
            origin = repo.remotes.origin
            origin.pull()
            logger.info("Pull complete for %s", dest.name)
        except GitCommandError as exc:
            logger.warning("Pull failed (%s). Using existing clone.", exc)
    else:
        # Fresh clone
        if dest.exists():
            shutil.rmtree(dest)          # remove stale non-git dir
        logger.info("Cloning %s -> %s ...", url, dest)
        Repo.clone_from(url, str(dest))
        logger.info("Clone complete: %s", dest.name)

    return dest


# -----------------------------------------------------------------------------
# Incremental indexing (Git-aware)
# -----------------------------------------------------------------------------

def incremental_index(repo_path_or_url):
    # Resolve remote URLs to local clones; local paths pass through unchanged
    repo_path = resolve_repo_path(str(repo_path_or_url))

    try:
        repo = Repo(str(repo_path))
        current_commit = repo.head.commit.hexsha
    except Exception as exc:
        logger.warning("Git error (%s). Running full index.", exc)
        build_full_index(repo_path)
        return

    metadata = load_metadata(repo_path)
    last_commit = metadata.get("last_commit")

    if last_commit == current_commit:
        logger.info("Repository already indexed (no changes).")
        return

    logger.info("Repository changed - re-indexing...")
    build_full_index(repo_path)

    save_metadata(repo_path, {"last_commit": current_commit})
    logger.info("Updated indexing metadata.")


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    incremental_index(REPO_PATH)