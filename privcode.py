import numpy as np
import os
import json
import pickle
import faiss
import logging
from cryptography.fernet import Fernet
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from config import PRESETS, ACTIVE_PRESET

# -----------------------------
# Logging
# -----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("PrivCode")

# -----------------------------
# Load performance configuration
# -----------------------------
CONFIG = PRESETS[ACTIVE_PRESET]

# -----------------------------
# Paths
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INDEX_DIR = os.path.join(BASE_DIR, "index")
MODEL_PATH = os.path.join(BASE_DIR, "models", "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf")
KEY_PATH = os.path.join(BASE_DIR, "secret.key")

# -----------------------------
# Load encryption key
# -----------------------------
with open(KEY_PATH, "rb") as f:
    key = f.read()

cipher = Fernet(key)

# -----------------------------
# Helper: decrypt file
# -----------------------------
def decrypt_file(path):
    with open(path, "rb") as f:
        encrypted = f.read()
    return cipher.decrypt(encrypted)

# -----------------------------
# Load encrypted FAISS index
# -----------------------------
faiss_bytes = decrypt_file(os.path.join(INDEX_DIR, "faiss.index.enc"))
faiss_array = np.frombuffer(faiss_bytes, dtype=np.uint8)
faiss_index = faiss.deserialize_index(faiss_array)

# -----------------------------
# Load encrypted documents & metadata
# -----------------------------
documents = json.loads(
    decrypt_file(os.path.join(INDEX_DIR, "documents.json.enc")).decode("utf-8")
)

metadatas = json.loads(
    decrypt_file(os.path.join(INDEX_DIR, "metadatas.json.enc")).decode("utf-8")
)

# -----------------------------
# Load encrypted BM25
# -----------------------------
bm25 = pickle.loads(
    decrypt_file(os.path.join(INDEX_DIR, "bm25.pkl.enc"))
)

# -----------------------------
# Load embedding model
# -----------------------------
embedder = SentenceTransformer("BAAI/bge-small-en-v1.5")

# -----------------------------
# Protected LLM Loading (GPU → CPU)
# -----------------------------
def load_llm(model_path):
    try:
        logger.info("🚀 Loading LLM with GPU acceleration...")
        return Llama(
            model_path=model_path,
            n_ctx=CONFIG["n_ctx"],
            n_batch=CONFIG["n_batch"],
            n_threads=CONFIG["n_threads"],
            n_gpu_layers=CONFIG["n_gpu_layers"],
            verbose=False,
            use_mlock=True,
            use_mmap=True
        )
    except Exception as e:
        logger.warning(f"⚠️ GPU load failed: {e}")
        logger.info("💻 Falling back to CPU mode...")
        return Llama(
            model_path=model_path,
            n_ctx=CONFIG["n_ctx"],
            n_batch=CONFIG["n_batch"],
            n_threads=CONFIG["n_threads"],
            n_gpu_layers=0,
            verbose=False,
            use_mlock=False,
            use_mmap=True
        )

logger.info(f"🧠 Loading model with preset: {ACTIVE_PRESET}")
llm = load_llm(MODEL_PATH)

# -----------------------------
# Hybrid Retrieval
# -----------------------------
def retrieve(query, k=None):
    if k is None:
        k = CONFIG["top_k"]

    # Dense search (FAISS)
    q_emb = embedder.encode([query]).astype("float32")
    _, dense_ids = faiss_index.search(q_emb, k)

    # BM25 search
    tokenized_query = query.split()
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_ids = sorted(
        range(len(bm25_scores)),
        key=lambda i: bm25_scores[i],
        reverse=True
    )[:k]

    # Merge + deduplicate
    ids = list(dict.fromkeys(dense_ids[0].tolist() + bm25_ids))
    return [(documents[i], i) for i in ids[:k]]

# -----------------------------
# RAG Core Logic
# -----------------------------
def run_rag_pipeline(query):
    results = retrieve(query)

    context_chunks = []
    for doc, idx in results:
        funcs_classes = metadatas[idx].get("functions_classes", [])
        max_funcs = CONFIG.get("max_functions_shown", 3)
        funcs_str = ", ".join(funcs_classes[:max_funcs]) if funcs_classes else "N/A"

        max_preview = CONFIG.get("max_code_preview", 400)
        code_preview = doc[:max_preview] + "..." if len(doc) > max_preview else doc

        context_chunks.append(
            f"""📄 {metadatas[idx]['source']}
🔧 {funcs_str}
{code_preview}"""
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
        stop=["</s>", "\nQ:", "\n\n\n", "Question:"]
    )

    return response["choices"][0]["text"].strip()

# -----------------------------
# Protected Query Pipeline (2.4)
# -----------------------------
def query_rag(question, repo_path=None):
    try:
        logger.info(f"🔍 Query received: {question}")
        return run_rag_pipeline(question)
    except Exception as e:
        logger.error(f"❌ Query failed: {e}", exc_info=True)
        return "Internal error. Check privcode.log"

# -----------------------------
# CLI Interface
# -----------------------------
if __name__ == "__main__":
    print("🔒 PrivCode - Secure Local Code Assistant")
    print("=" * 50)

    while True:
        query = input("\n🔍 Ask a question (or 'exit' to quit): ").strip()

        if query.lower() in ("exit", "quit", "q"):
            print("👋 Goodbye!")
            break

        if not query:
            continue

        print("\n💡 Generating answer...\n")
        answer = query_rag(query)
        print(f"📝 Answer:\n{answer}\n")