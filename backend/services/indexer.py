# indexer.py - PrivCode Incremental Indexing with AST Metadata (Encrypted)

import json
import os
import pickle
from pathlib import Path

from git import Repo
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
import faiss
from tqdm import tqdm

from backend.core.logger import setup_logger
from backend.services.crypto_utils import encrypt_file

logger = setup_logger()

ROOT_DIR = Path(__file__).resolve().parents[2]
REPO_PATH = ROOT_DIR / "test_repo"
INDEX_DIR = ROOT_DIR / "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
METADATA_FILE = ".privcode_metadata.json"

CODE_EXTENSIONS = {".py", ".js", ".java", ".ts", ".cpp", ".c", ".go", ".jsx", ".tsx"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "build"}

os.makedirs(INDEX_DIR, exist_ok=True)


def load_metadata(repo_path):
    path = Path(repo_path) / METADATA_FILE
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {"last_commit": None}


def save_metadata(repo_path, data):
    path = Path(repo_path) / METADATA_FILE
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


AST_ENABLED = False
try:
    from tree_sitter_languages import get_parser

    parser = get_parser("python")
    AST_ENABLED = True
    print("✅ Tree-sitter enabled for AST metadata extraction")
except ImportError:
    print("⚠️ Tree-sitter not available — AST metadata disabled")


def extract_functions_classes(code: str):
    if not AST_ENABLED:
        return []
    try:
        tree = parser.parse(bytes(code, "utf-8"))
        results = []

        def walk(node):
            if node.type in ("function_definition", "class_definition"):
                name = node.child_by_field_name("name")
                if name:
                    results.append(name.text.decode("utf-8"))
            for child in node.children:
                walk(child)

        walk(tree.root_node)
        return results
    except Exception:  # noqa: BLE001
        return []


print("🔄 Loading embedding model...")
embedder = SentenceTransformer(EMBEDDING_MODEL)


def encrypt_and_cleanup(index_dir: Path):
    files = [
        "faiss.index",
        "bm25.pkl",
        "documents.json",
        "metadatas.json",
    ]

    for fname in files:
        path = index_dir / fname
        if path.exists():
            encrypt_file(path)
            path.unlink(missing_ok=True)
            logger.info("🔐 Encrypted & removed plaintext: %s", fname)

    logger.info("✅ Index fully encrypted.")


def build_full_index(repo_path, index_path):
    repo_path = Path(repo_path)
    index_path = Path(index_path)

    documents = []
    metadatas = []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""],
    )

    for root, _, files in os.walk(repo_path):
        if any(skip in root for skip in SKIP_DIRS):
            continue

        for file in files:
            suffix = Path(file).suffix.lower()
            if suffix not in CODE_EXTENSIONS:
                continue

            file_path = Path(root) / file
            rel_path = file_path.relative_to(repo_path)

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                funcs = extract_functions_classes(content) if suffix == ".py" else []

                base_meta = {
                    "source": str(rel_path),
                    "language": suffix[1:],
                    "functions_classes": funcs,
                }

                chunks = splitter.split_text(content)
                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        **base_meta,
                        "chunk_id": i,
                        "total_chunks": len(chunks),
                    })

            except Exception as exc:  # noqa: BLE001
                logger.warning("⚠️ Skipped %s: %s", file_path, exc)

    logger.info("📦 Indexed %s chunks", len(documents))

    logger.info("🧠 Generating embeddings...")
    embeddings = embedder.encode(
        documents,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=32,
    )

    dim = embeddings.shape[1]
    faiss_index = faiss.IndexFlatIP(dim)
    faiss_index.add(embeddings)
    faiss.write_index(faiss_index, str(index_path / "faiss.index"))

    tokenized = [doc.split() for doc in documents]
    bm25 = BM25Okapi(tokenized)

    with (index_path / "bm25.pkl").open("wb") as f:
        pickle.dump(bm25, f)

    (index_path / "documents.json").write_text(
        json.dumps(documents), encoding="utf-8"
    )
    (index_path / "metadatas.json").write_text(
        json.dumps(metadatas), encoding="utf-8"
    )


def incremental_index(repo_path, index_path):
    try:
        repo = Repo(repo_path)
        current_commit = repo.head.commit.hexsha
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ Git error (%s) — forcing full rebuild", exc)
        build_full_index(repo_path, index_path)
        encrypt_and_cleanup(Path(index_path))
        return

    metadata = load_metadata(repo_path)
    last_commit = metadata.get("last_commit")

    if last_commit == current_commit:
        logger.info("✅ Index already up to date.")
        return

    logger.info("🔍 Detecting repository changes...")
    build_full_index(repo_path, index_path)

    save_metadata(repo_path, {"last_commit": current_commit})
    encrypt_and_cleanup(Path(index_path))


if __name__ == "__main__":
    incremental_index(REPO_PATH, INDEX_DIR)