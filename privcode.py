import numpy as np
import os
import json
import pickle
import faiss
from cryptography.fernet import Fernet
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

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
# Load encrypted FAISS index (FIXED)
# -----------------------------
faiss_bytes = decrypt_file(os.path.join(INDEX_DIR, "faiss.index.enc"))

# Convert bytes → numpy uint8 array (REQUIRED)
faiss_array = np.frombuffer(faiss_bytes, dtype=np.uint8)

# Deserialize correctly
faiss_index = faiss.deserialize_index(faiss_array)

# -----------------------------
# Load encrypted documents
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
# Load Llama model
# -----------------------------
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=8,
    n_gpu_layers=0,  # set >0 if GPU available
    verbose=False
)

# -----------------------------
# Hybrid Retrieval
# -----------------------------
def retrieve(query, k=5):
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

    # Merge results
    ids = list(dict.fromkeys(dense_ids[0].tolist() + bm25_ids))
    return [documents[i] for i in ids[:k]]

# -----------------------------
# Generate Answer (RAG)
# -----------------------------
def generate_answer(query):
    contexts = retrieve(query)

    context_text = "\n\n".join(contexts)

    prompt = f"""
You are PrivCode, a secure AI assistant.
Answer strictly based on the provided code context.

Context:
{context_text}

Question:
{query}

Answer:
"""

    response = llm(
        prompt,
        max_tokens=512,
        temperature=0.2,
        stop=["</s>"]
    )

    return response["choices"][0]["text"].strip()