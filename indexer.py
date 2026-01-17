# indexer.py - PrivCode Incremental Indexing with AST Metadata (Enhanced)

import os
import json
from git import Repo
from pathlib import Path
import pickle
from tqdm import tqdm

import faiss
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from logger import setup_logger
logger = setup_logger()

# --------------------- CONFIG ---------------------
REPO_PATH = "test_repo"
INDEX_DIR = "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

METADATA_FILE = ".privcode_metadata.json"

CODE_EXTENSIONS = {
    ".py", ".js", ".java", ".ts", ".cpp", ".c", ".go", ".jsx", ".tsx"
}

SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "build"}
# --------------------------------------------------

os.makedirs(INDEX_DIR, exist_ok=True)

# --------------------- METADATA HELPERS ---------------------
def load_metadata(repo_path):
    path = os.path.join(repo_path, METADATA_FILE)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"last_commit": None}

def save_metadata(repo_path, data):
    path = os.path.join(repo_path, METADATA_FILE)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
# -----------------------------------------------------------

# --------------------- OPTIONAL AST (Python only) ---------------------
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
            for c in node.children:
                walk(c)

        walk(tree.root_node)
        return results
    except Exception:
        return []
# ---------------------------------------------------------------------

print("🔄 Loading embedding model...")
embedder = SentenceTransformer(EMBEDDING_MODEL)

# --------------------- FULL INDEX BUILD ---------------------
def build_full_index(repo_path, index_path):
    documents = []
    metadatas = []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", " ", ""]
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
                    "functions_classes": funcs
                }

                chunks = splitter.split_text(content)
                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        **base_meta,
                        "chunk_id": i,
                        "total_chunks": len(chunks)
                    })

            except Exception as e:
                print(f"⚠️ Skipped {file_path}: {e}")

    print(f"📦 Indexed {len(documents)} chunks from {len(set(m['source'] for m in metadatas))} files")

    print("🧠 Generating embeddings...")
    embeddings = embedder.encode(
        documents,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=32
    )

    dim = embeddings.shape[1]
    faiss_index = faiss.IndexFlatIP(dim)
    faiss_index.add(embeddings)
    faiss.write_index(faiss_index, os.path.join(index_path, "faiss.index"))

    tokenized = [doc.split() for doc in documents]
    bm25 = BM25Okapi(tokenized)

    with open(os.path.join(index_path, "bm25.pkl"), "wb") as f:
        pickle.dump(bm25, f)

    with open(os.path.join(index_path, "documents.json"), "w", encoding="utf-8") as f:
        json.dump(documents, f, indent=2)

    with open(os.path.join(index_path, "metadatas.json"), "w", encoding="utf-8") as f:
        json.dump(metadatas, f, indent=2)

# --------------------- INCREMENTAL INDEX ---------------------
def incremental_index(repo_path, index_path):
    try:
        repo = Repo(repo_path)
        current_commit = repo.head.commit.hexsha
    except Exception as e:
        print(f"⚠️ Git error ({e}) — forcing full rebuild")
        build_full_index(repo_path, index_path)
        return

    metadata = load_metadata(repo_path)
    last_commit = metadata.get("last_commit")

    if last_commit == current_commit:
        print("✅ Index already up to date.")
        return

    print("🔍 Detecting repository changes...")

    if last_commit:
        diffs = repo.commit(last_commit).diff(current_commit)
        changed = [d.b_path for d in diffs if d.change_type in ("A", "M")]
        deleted = [d.a_path for d in diffs if d.change_type == "D"]
        print(f"📝 Changed files: {len(changed)}, Deleted files: {len(deleted)}")
    else:
        print("🆕 First-time indexing detected")

    print("🔄 Rebuilding index safely (chunk-based store)...")
    build_full_index(repo_path, index_path)

    save_metadata(repo_path, {"last_commit": current_commit})
    print("✅ Incremental index updated.")

# --------------------- RUN ---------------------
incremental_index(REPO_PATH, INDEX_DIR)

# --------------------- ENCRYPT ---------------------
from crypto_utils import encrypt_file

for f in ["faiss.index", "documents.json", "metadatas.json", "bm25.pkl"]:
    encrypt_file(os.path.join(INDEX_DIR, f))

print("🔐 Index encrypted!")
print("🚀 PrivCode brain upgraded!")