# retriever.py - PrivCode Hybrid Retrieval Engine
import json
import os
import pickle
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

ROOT_DIR = Path(__file__).resolve().parents[2]
INDEX_DIR = ROOT_DIR / "index"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
TOP_K = 5
ALPHA = 0.5

embedder = SentenceTransformer(EMBEDDING_MODEL)

with open(INDEX_DIR / "documents.json", "r", encoding="utf-8") as f:
    documents = json.load(f)
with open(INDEX_DIR / "metadatas.json", "r", encoding="utf-8") as f:
    metadatas = json.load(f)

faiss_index = faiss.read_index(str(INDEX_DIR / "faiss.index"))

with open(INDEX_DIR / "bm25.pkl", "rb") as f:
    bm25 = pickle.load(f)


def hybrid_search(query: str, top_k: int = TOP_K, alpha: float = ALPHA):
    query_emb = embedder.encode([query], normalize_embeddings=True)
    D_sem, I_sem = faiss_index.search(query_emb, top_k * 2)
    semantic_indices = I_sem[0]

    tokenized_query = query.split()
    bm25_scores = bm25.get_scores(tokenized_query)
    bm25_top_indices = np.argsort(bm25_scores)[::-1][: top_k * 2]

    fused_scores = np.zeros(len(documents))

    for rank, idx in enumerate(semantic_indices):
        fused_scores[idx] += (1 - alpha) * (1 / (rank + 60))

    for rank, idx in enumerate(bm25_top_indices):
        fused_scores[idx] += alpha * (1 / (rank + 60))

    final_indices = np.argsort(fused_scores)[::-1][:top_k]
    results = []

    for idx in final_indices:
        score = fused_scores[idx]
        if score == 0:
            continue
        results.append({
            "score": round(float(score), 4),
            "code": documents[idx],
            "metadata": metadatas[idx],
        })

    return results


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("PrivCode Hybrid Retriever Ready! Type 'exit' to quit.")
    print("=" * 60)

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
            print(
                f"{i}. Score: {res['score']:.4f} | File: {meta['source']} "
                f"(chunk {meta['chunk_id']+1}/{meta['total_chunks']})"
            )
            print("-" * 50)
            print(res["code"].strip())
            print("-" * 50)