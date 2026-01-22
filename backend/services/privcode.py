import json
import logging
import os
import pickle
from pathlib import Path

import faiss
import numpy as np
from llama_cpp import Llama
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

from backend.core.config import PRESETS, ACTIVE_PRESET
from backend.services.crypto_utils import decrypt_file


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("PrivCode")

CONFIG = PRESETS[ACTIVE_PRESET]

ROOT_DIR = Path(__file__).resolve().parents[2]
INDEX_DIR = ROOT_DIR / "index"
MODEL_PATH = ROOT_DIR / "models" / "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"

INDEX_FILES = [
    "faiss.index",
    "bm25.pkl",
    "documents.json",
    "metadatas.json",
]

for fname in INDEX_FILES:
    enc_path = INDEX_DIR / f"{fname}.enc"
    orig_path = INDEX_DIR / fname

    if enc_path.exists():
        decrypt_file(enc_path, orig_path)
        logger.info("🔓 Decrypted %s", fname)

faiss_index = faiss.read_index(str(INDEX_DIR / "faiss.index"))

with open(INDEX_DIR / "documents.json", "r", encoding="utf-8") as f:
    documents = json.load(f)

with open(INDEX_DIR / "metadatas.json", "r", encoding="utf-8") as f:
    metadatas = json.load(f)

with open(INDEX_DIR / "bm25.pkl", "rb") as f:
    bm25 = pickle.load(f)

embedder = SentenceTransformer("BAAI/bge-small-en-v1.5")


def load_llm(model_path: Path):
    try:
        logger.info("🚀 Loading LLM with GPU acceleration...")
        return Llama(
            model_path=str(model_path),
            n_ctx=CONFIG["n_ctx"],
            n_batch=CONFIG["n_batch"],
            n_threads=CONFIG["n_threads"],
            n_gpu_layers=CONFIG["n_gpu_layers"],
            verbose=False,
            use_mlock=True,
            use_mmap=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("⚠️ GPU load failed: %s", e)
        logger.info("💻 Falling back to CPU mode...")
        return Llama(
            model_path=str(model_path),
            n_ctx=CONFIG["n_ctx"],
            n_batch=CONFIG["n_batch"],
            n_threads=CONFIG["n_threads"],
            n_gpu_layers=0,
            verbose=False,
            use_mlock=False,
            use_mmap=True,
        )


logger.info("🧠 Loading model with preset: %s", ACTIVE_PRESET)
llm = load_llm(MODEL_PATH)


def retrieve(query: str, k: int | None = None):
    if k is None:
        k = CONFIG["top_k"]

    q_emb = embedder.encode([query], normalize_embeddings=True).astype("float32")
    _, dense_ids = faiss_index.search(q_emb, k)

    tokenized_query = query.split()
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_ids = sorted(
        range(len(bm25_scores)),
        key=lambda i: bm25_scores[i],
        reverse=True,
    )[:k]

    ids = list(dict.fromkeys(dense_ids[0].tolist() + bm25_ids))
    return [(documents[i], i) for i in ids[:k]]


def run_rag_pipeline(query: str):
    results = retrieve(query)

    context_chunks = []
    for doc, idx in results:
        funcs = metadatas[idx].get("functions_classes", [])
        max_funcs = CONFIG.get("max_functions_shown", 3)

        funcs_str = ", ".join(funcs[:max_funcs]) if funcs else "N/A"

        max_preview = CONFIG.get("max_code_preview", 400)
        preview = doc[:max_preview] + "..." if len(doc) > max_preview else doc

        context_chunks.append(
            f"""📄 {metadatas[idx]['source']}
🔧 {funcs_str}
{preview}"""
        )

    context_text = "\n\n".join(context_chunks)

    prompt = f"""Code context:
{context_text}

Q: {query}
A:"""

    response = llm(
        prompt,
        max_tokens=CONFIG["max_tokens"],
        temperature=CONFIG["temperature"],
        top_p=0.9,
        repeat_penalty=1.1,
        stop=["</s>", "\nQ:", "\n\n\n", "Question:"],
    )

    return response["choices"][0]["text"].strip()


def query_rag(question: str):
    try:
        logger.info("🔍 Query received: %s", question)
        return run_rag_pipeline(question)
    except Exception as e:  # noqa: BLE001
        logger.error("❌ Query failed: %s", e, exc_info=True)
        return "Internal error. Check logs."


if __name__ == "__main__":
    print("🔒 PrivCode – Secure Local Code Assistant")
    print("=" * 50)

    while True:
        query = input("\n🔍 Ask a question (or 'exit'): ").strip()
        if query.lower() in ("exit", "quit", "q"):
            break

        answer = query_rag(query)
        print("\n🧠 Answer:\n" + answer + "\n")