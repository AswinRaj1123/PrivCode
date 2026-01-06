# indexer.py - PrivCode Indexing Pipeline

import os
from git import Repo
from pathlib import Path
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
from rank_bm25 import BM25Okapi
import pickle
import json
from tqdm import tqdm

# ---------------- TREE-SITTER (PHASE 2 - COMMENTED) ----------------
# Tree-sitter requires native builds and vendor grammar repos.
# We keep this code commented for future enhancement (AST-aware indexing).

# import tree_sitter
# from tree_sitter import Language, Parser

# PY_PARSER = Parser()
# JS_PARSER = Parser()

# Language.build_library(
#     'build/my-languages.so',
#     [
#         'vendor/tree-sitter-python',
#         'vendor/tree-sitter-javascript'
#     ]
# )

# LANG = Language('build/my-languages.so', 'python')
# PY_PARSER.set_language(LANG)

# def extract_functions_classes(code: str, language: str = "python") -> list:
#     """AST-based extraction of functions and classes (Phase 2)."""
#     try:
#         parser = PY_PARSER if language == "python" else JS_PARSER
#         tree = parser.parse(bytes(code, "utf8"))
#         return []  # Placeholder for future AST logic
#     except Exception:
#         return []

# -------------------------------------------------------------------

# --------------------- CONFIG ---------------------
REPO_PATH = "test_repo"          # Local test repo
INDEX_DIR = "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
# --------------------------------------------------

os.makedirs(INDEX_DIR, exist_ok=True)

# Load embedding model
print("Loading embedding model...")
embedder = SentenceTransformer(EMBEDDING_MODEL)

# Crawl repo and load code files
print("Crawling repo and loading code files...")
repo = Repo(REPO_PATH)

code_extensions = {".py", ".js", ".java", ".ts", ".cpp", ".c", ".go"}
documents = []
metadatas = []

for root, _, files in os.walk(REPO_PATH):
    for file in files:
        if Path(file).suffix.lower() in code_extensions:
            file_path = Path(root) / file
            rel_path = file_path.relative_to(REPO_PATH)

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                metadata = {
                    "source": str(rel_path),
                    "file_path": str(file_path),
                    "language": file_path.suffix[1:],
                }

                # Text chunking (language-agnostic for Day 1)
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=CHUNK_SIZE,
                    chunk_overlap=CHUNK_OVERLAP,
                    separators=["\n\n", "\n", " ", ""]
                )

                chunks = splitter.split_text(content)

                for i, chunk in enumerate(chunks):
                    documents.append(chunk)
                    metadatas.append({
                        **metadata,
                        "chunk_id": i,
                        "total_chunks": len(chunks)
                    })

            except Exception as e:
                print(f"Error reading {file_path}: {e}")

print(
    f"Loaded {len(documents)} chunks from "
    f"{len(set(m['source'] for m in metadatas))} files"
)

# Generate embeddings
print("Generating embeddings...")
embeddings = embedder.encode(
    documents,
    normalize_embeddings=True,
    show_progress_bar=True
)

dimension = embeddings.shape[1]

# Build FAISS semantic index
print("Building FAISS index...")
faiss_index = faiss.IndexFlatIP(dimension)
faiss_index.add(embeddings)
faiss.write_index(faiss_index, os.path.join(INDEX_DIR, "faiss.index"))

# Build BM25 keyword index
print("Building BM25 index...")
tokenized_corpus = [doc.split() for doc in documents]
bm25 = BM25Okapi(tokenized_corpus)

with open(os.path.join(INDEX_DIR, "bm25.pkl"), "wb") as f:
    pickle.dump(bm25, f)

# Save documents and metadata
with open(os.path.join(INDEX_DIR, "documents.json"), "w", encoding="utf-8") as f:
    json.dump(documents, f, indent=2)

with open(os.path.join(INDEX_DIR, "metadatas.json"), "w", encoding="utf-8") as f:
    json.dump(metadatas, f, indent=2)

print("Indexing complete! PrivCode brain is ready.")
print(f"FAISS index saved at: {INDEX_DIR}/faiss.index")
print(f"BM25 index saved at: {INDEX_DIR}/bm25.pkl")
print(f"Total chunks indexed: {len(documents)}")