# privcode.py - PrivCode Local RAG Engine
import os
import json
import faiss
import numpy as np
import pickle
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from llama_cpp import Llama

# --------------------- CONFIG ---------------------
INDEX_DIR = "index"
MODEL_PATH = "models/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"  # Update if different
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
TOP_K_RETRIEVAL = 5
MAX_CONTEXT_TOKENS = 3000  # Safe limit for 8B model
TEMPERATURE = 0.3
# --------------------------------------------------

print("Loading embedding model and indexes...")
embedder = SentenceTransformer(EMBEDDING_MODEL)

with open(os.path.join(INDEX_DIR, "documents.json"), "r") as f:
    documents = json.load(f)
with open(os.path.join(INDEX_DIR, "metadatas.json"), "r") as f:
    metadatas = json.load(f)

faiss_index = faiss.read_index(os.path.join(INDEX_DIR, "faiss.index"))
with open(os.path.join(INDEX_DIR, "bm25.pkl"), "rb") as f:
    bm25 = pickle.load(f)

# Load quantized LLM (this takes 10-30 sec first time)
print("Loading 4-bit Llama-3-8B (this may take a minute)...")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,          # Context window
    n_threads=8,         # Adjust to your CPU
    n_gpu_layers=35 if os.getenv("USE_GPU") else 0,  # Set USE_GPU=1 if you have CUDA
    verbose=False
)

print("PrivCode is ALIVE! 🚀")

def hybrid_retrieval(query: str, top_k: int = TOP_K_RETRIEVAL):
    # Same hybrid logic from retriever.py (reciprocal rank fusion)
    query_emb = embedder.encode([query], normalize_embeddings=True)
    D_sem, I_sem = faiss_index.search(query_emb, top_k * 2)
    semantic_indices = I_sem[0]

    tokenized_query = query.split()
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_top_indices = np.argsort(bm25_scores)[::-1][:top_k * 2]

    fused_scores = np.zeros(len(documents))
    alpha = 0.5
    for rank, idx in enumerate(semantic_indices):
        fused_scores[idx] += (1 - alpha) * (1 / (rank + 60))
    for rank, idx in enumerate(bm25_top_indices):
        fused_scores[idx] += alpha * (1 / (rank + 60))

    final_indices = np.argsort(fused_scores)[::-1][:top_k]
    context_chunks = []
    sources = []
    for idx in final_indices:
        if fused_scores[idx] > 0:
            context_chunks.append(documents[idx])
            sources.append(metadatas[idx]["source"])
    return "\n\n".join(context_chunks), list(set(sources))

def generate_answer(query: str):
    context, sources = hybrid_retrieval(query)
    
    system_prompt = """You are PrivCode, an expert code analyst for a private codebase.
Answer ONLY based on the provided context. Be precise, technical, and helpful.
Output strictly in JSON format with these keys:
{
  "answer": "your explanation",
  "sources": ["list of file paths"],
  "potential_issues": ["list of bugs/performance issues if any, else empty"],
  "suggestions": ["list of improvements, else empty"]
}"""

    user_prompt = f"""Context from codebase:
{context}

Question: {query}

Respond in valid JSON only. No extra text."""

    response = llm(
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n{system_prompt}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n{user_prompt}<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>",
        max_tokens=1024,
        temperature=TEMPERATURE,
        stop=["<|eot_id|>"],
        echo=False
    )
    
    raw_output = response["choices"][0]["text"].strip()
    
    # Basic cleanup in case JSON is malformed
    try:
        return json.loads(raw_output)
    except:
        return {
            "answer": raw_output,
            "sources": sources,
            "potential_issues": [],
            "suggestions": [],
            "note": "Raw output (JSON parse failed)"
        }

# Interactive loop
if __name__ == "__main__":
    print("\n" + "="*70)
    print("PrivCode Ready — Ask anything about your codebase!")
    print("="*70)
    while True:
        query = input("\n🔍 Your question: ").strip()
        if query.lower() in ["exit", "q", "quit"]:
            print("Great work today, bro! See you on Day 4 for UI + security. 🚀")
            break
        if not query:
            continue
        
        print("\nThinking...\n")
        result = generate_answer(query)
        
        print("Answer:")
        print(result.get("answer", "No answer generated"))
        print("\nSources:", ", ".join(result.get("sources", [])))
        if result.get("potential_issues"):
            print("\nPotential Issues:", "\n- " + "\n- ".join(result["potential_issues"]))
        if result.get("suggestions"):
            print("\nSuggestions:", "\n- " + "\n- ".join(result["suggestions"]))
        print("\n" + "-"*70)