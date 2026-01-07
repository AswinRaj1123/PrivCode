import numpy as np
import os
import json
import pickle
import faiss
from cryptography.fernet import Fernet
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from config import PRESETS, ACTIVE_PRESET

# Load performance configuration
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
# Load Llama model (OPTIMIZED FOR SPEED)
# -----------------------------
print(f"🚀 Loading model with preset: {ACTIVE_PRESET}")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=CONFIG["n_ctx"],
    n_batch=CONFIG["n_batch"],
    n_threads=CONFIG["n_threads"],
    n_gpu_layers=CONFIG["n_gpu_layers"],
    verbose=False,
    use_mlock=True,      # Lock model in RAM for faster access
    use_mmap=True        # Memory-mapped files for efficiency
)

# -----------------------------
# Hybrid Retrieval (Enhanced & Optimized)
# -----------------------------
def retrieve(query, k=None):
    """Retrieve top-k relevant chunks using hybrid search"""
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

    # Merge and deduplicate results
    ids = list(dict.fromkeys(dense_ids[0].tolist() + bm25_ids))
    
    # Return both document chunks and their indices for metadata access
    return [(documents[i], i) for i in ids[:k]]

# -----------------------------
# Generate Answer (RAG with AST Metadata) - OPTIMIZED
# -----------------------------
def generate_answer(query):
    """Generate answer using retrieved context with function/class metadata"""
    results = retrieve(query)
    
    # Build compact context
    context_chunks = []
    for doc, idx in results:
        funcs_classes = metadatas[idx].get('functions_classes', [])
        max_funcs = CONFIG.get("max_functions_shown", 3)
        funcs_str = ', '.join(funcs_classes[:max_funcs]) if funcs_classes else 'N/A'
        
        # Truncate code based on config
        max_preview = CONFIG.get("max_code_preview", 400)
        code_preview = doc[:max_preview] + "..." if len(doc) > max_preview else doc
        
        chunk_info = f"""📄 {metadatas[idx]['source']}
🔧 {funcs_str}
{code_preview}"""
        context_chunks.append(chunk_info)
    
    context_text = "\n\n".join(context_chunks)

    # Shorter, more directive prompt for faster generation
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
        stop=["</s>", "\nQ:", "\n\n\n", "Question:"]  # Better stop sequences
    )

    return response["choices"][0]["text"].strip()

# -----------------------------
# CLI Interface (Optional)
# -----------------------------
if __name__ == "__main__":
    print("🔒 PrivCode - Secure Local Code Assistant")
    print("=" * 50)
    
    while True:
        query = input("\n🔍 Ask a question (or 'exit' to quit): ").strip()
        
        if query.lower() in ['exit', 'quit', 'q']:
            print("👋 Goodbye!")
            break
        
        if not query:
            continue
        
        try:
            print("\n💡 Generating answer...\n")
            answer = generate_answer(query)
            print(f"📝 Answer:\n{answer}\n")
        except Exception as e:
            print(f"❌ Error: {e}")