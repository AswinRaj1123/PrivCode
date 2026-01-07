# indexer.py - PrivCode Incremental Indexing with AST Metadata (Enhanced)

import os
from git import Repo
from pathlib import Path
import json
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
from rank_bm25 import BM25Okapi
import pickle
from tqdm import tqdm

# --------------------- CONFIG ---------------------
REPO_PATH = "test_repo"
INDEX_DIR = "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
COMMIT_FILE = os.path.join(INDEX_DIR, "last_commit.txt")
# --------------------------------------------------

os.makedirs(INDEX_DIR, exist_ok=True)

# --------------------- OPTIONAL AST (Python only) ---------------------
AST_ENABLED = False

try:
    from tree_sitter_languages import get_parser
    parser = get_parser("python")
    AST_ENABLED = True
    print("✅ Tree-sitter enabled for AST metadata extraction")
except ImportError:
    print("⚠️ Tree-sitter not available — AST metadata disabled (install: pip install tree-sitter-languages)")

def extract_functions_classes(code: str):
    """Extract function and class names from Python code using AST"""
    if not AST_ENABLED:
        return []
    try:
        tree = parser.parse(bytes(code, "utf-8"))
        funcs = []

        def walk(node):
            if node.type in ("function_definition", "class_definition"):
                name = node.child_by_field_name("name")
                if name:
                    funcs.append(name.text.decode("utf-8"))
            for c in node.children:
                walk(c)

        walk(tree.root_node)
        return funcs
    except Exception as e:
        return []

# --------------------------------------------------

# Load embedding model
print("🔄 Loading embedding model...")
embedder = SentenceTransformer(EMBEDDING_MODEL)

# --------------------- GIT CHANGE CHECK ---------------------
try:
    repo = Repo(REPO_PATH)
    current_commit = repo.head.commit.hexsha
except Exception as e:
    print(f"⚠️ Git repo error: {e}. Proceeding with full indexing...")
    current_commit = "no_git"

if os.path.exists(COMMIT_FILE):
    with open(COMMIT_FILE, "r") as f:
        last_commit = f.read().strip()
    if last_commit == current_commit:
        print("✅ No repo changes detected — index is up to date.")
        exit()

print("🔄 Repo changed — rebuilding index...")

# --------------------- FILE CRAWLING ---------------------
documents = []
metadatas = []

code_extensions = {".py", ".js", ".java", ".ts", ".cpp", ".c", ".go", ".jsx", ".tsx"}

for root, _, files in os.walk(REPO_PATH):
    # Skip hidden directories and common build directories
    if any(skip in root for skip in [".git", "node_modules", "__pycache__", "venv", ".venv", "build"]):
        continue
    
    for file in files:
        if Path(file).suffix.lower() in code_extensions:
            file_path = Path(root) / file
            rel_path = file_path.relative_to(REPO_PATH)

            try:
                content = file_path.read_text(encoding="utf-8")

                # Extract AST metadata for Python files only
                funcs = extract_functions_classes(content) if file_path.suffix == ".py" else []

                metadata_base = {
                    "source": str(rel_path),
                    "language": file_path.suffix[1:],
                    "functions_classes": funcs
                }

                # Smart code-aware splitting
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=CHUNK_SIZE,
                    chunk_overlap=CHUNK_OVERLAP,
                    separators=["\n\n", "\n", " ", ""]
                )

                chunks = splitter.split_text(content)

                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        **metadata_base,
                        "chunk_id": i,
                        "total_chunks": len(chunks)
                    })

            except Exception as e:
                print(f"⚠️ Skip {file_path}: {e}")

print(f"📦 Indexed {len(documents)} chunks from {len(set(m['source'] for m in metadatas))} files")

# --------------------- BUILD INDEXES ---------------------
print("🧠 Generating embeddings...")
embeddings = embedder.encode(
    documents,
    normalize_embeddings=True,
    show_progress_bar=True,
    batch_size=32
)

# FAISS vector index (semantic search)
dim = embeddings.shape[1]
faiss_index = faiss.IndexFlatIP(dim)
faiss_index.add(embeddings)
faiss.write_index(faiss_index, os.path.join(INDEX_DIR, "faiss.index"))

# BM25 keyword index (lexical search)
tokenized = [doc.split() for doc in documents]
bm25 = BM25Okapi(tokenized)

with open(os.path.join(INDEX_DIR, "bm25.pkl"), "wb") as f:
    pickle.dump(bm25, f)

# Save documents and metadata
with open(os.path.join(INDEX_DIR, "documents.json"), "w", encoding="utf-8") as f:
    json.dump(documents, f, indent=2)

with open(os.path.join(INDEX_DIR, "metadatas.json"), "w", encoding="utf-8") as f:
    json.dump(metadatas, f, indent=2)

# Save commit hash for incremental tracking
with open(COMMIT_FILE, "w") as f:
    f.write(current_commit)

print("✅ Incremental indexing complete — PrivCode brain upgraded!")
print(f"💾 Index saved to: {INDEX_DIR}/")