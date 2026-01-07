# retriever.py - PrivCode Hybrid Retrieval Engine
import os
import json
import faiss
import numpy as np
import pickle
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

# --------------------- CONFIG ---------------------
INDEX_DIR = "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
TOP_K = 5                  # Number of results to return
ALPHA = 0.5                # Weight: semantic (1-alpha) + bm25 (alpha) — tune later
# --------------------------------------------------

# Load everything from Day 1
print("Loading indexes and model...")

# Embedding model
embedder = SentenceTransformer(EMBEDDING_MODEL)

# Documents & metadata
with open(os.path.join(INDEX_DIR, "documents.json"), "r") as f:
    documents = json.load(f)
with open(os.path.join(INDEX_DIR, "metadatas.json"), "r") as f:
    metadatas = json.load(f)

# FAISS
faiss_index = faiss.read_index(os.path.join(INDEX_DIR, "faiss.index"))

# BM25
with open(os.path.join(INDEX_DIR, "bm25.pkl"), "rb") as f:
    bm25 = pickle.load(f)

print(f"Loaded {len(documents)} chunks. Ready for queries!")

def hybrid_search(query: str, top_k: int = TOP_K, alpha: float = ALPHA):
    # 1. Semantic search
    query_emb = embedder.encode([query], normalize_embeddings=True)
    D_sem, I_sem = faiss_index.search(query_emb, top_k * 2)  # Get more for reranking
    semantic_scores = D_sem[0]  # Cosine similarity
    semantic_indices = I_sem[0]

    # 2. BM25 keyword search
    tokenized_query = query.split()
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_top_indices = np.argsort(bm25_scores)[::-1][:top_k * 2]
    bm25_top_scores = bm25_scores[bm25_top_indices]

    # 3. Reciprocal Rank Fusion (simple & effective)
    fused_scores = np.zeros(len(documents))
    
    # Add semantic contribution
    for rank, idx in enumerate(semantic_indices):
        if rank < len(semantic_indices):
            fused_scores[idx] += (1 - alpha) * (1 / (rank + 60))  # 60 to avoid division issues
    
    # Add BM25 contribution
    for rank, idx in enumerate(bm25_top_indices):
        if rank < len(bm25_top_indices):
            fused_scores[idx] += alpha * (1 / (rank + 60))

    # Final top-k
    final_indices = np.argsort(fused_scores)[::-1][:top_k]
    results = []
    
    for idx in final_indices:
        score = fused_scores[idx]
        if score == 0:
            continue
        results.append({
            "score": round(float(score), 4),
            "code": documents[idx],
            "metadata": metadatas[idx]
        })
    
    return results

# Interactive test loop
if __name__ == "__main__":
    print("\n" + "="*60)
    print("PrivCode Hybrid Retriever Ready! Type 'exit' to quit.")
    print("="*60)
    
    while True:
        query = input("\n🔍 Ask about your codebase: ").strip()
        if query.lower() in ["exit", "quit", "q"]:
            print("See you tomorrow for LLM integration! 🚀")
            break
        if not query:
            continue
        
        print("\nRetrieving top results...\n")
        results = hybrid_search(query)
        
        if not results:
            print("No relevant chunks found. Try different keywords.")
            continue
        
        for i, res in enumerate(results, 1):
            meta = res["metadata"]
            print(f"{i}. Score: {res['score']:.4f} | File: {meta['source']} (chunk {meta['chunk_id']+1}/{meta['total_chunks']})")
            print("-" * 50)
            print(res["code"].strip())
            print("-" * 50)