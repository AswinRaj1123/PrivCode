# privcode.py — PrivCode Full RAG Engine (Day 3 FINAL, BULLETPROOF)

import json
import re
from typing import List, Dict

from llama_cpp import Llama

from .retriever import hybrid_retrieve
from ..core.logger import setup_logger

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

logger = setup_logger()

MODEL_PATH = "models/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"

logger.info("🧠 Loading local LLM...")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,          # reduced for speed
    n_threads=6,
    n_gpu_layers=0,      # CPU mode
    verbose=False,
)

# -----------------------------------------------------------------------------
# Prompt Augmentation
# -----------------------------------------------------------------------------

def build_augmented_prompt(query: str, contexts: List[Dict]) -> str:
    allowed_files = sorted({ctx["file_path"] for ctx in contexts})

    prompt = f"""
You are an expert software engineer analyzing a private startup codebase.

STRICT RULES (VERY IMPORTANT):
- Use ONLY the provided code context.
- Do NOT guess or hallucinate.
- If the answer is not in the context, say "Not found in the provided code."
- Do NOT use markdown.
- Output ONLY ONE JSON object.
- Output must start with '{{' and end with '}}'.

The ONLY files you are allowed to reference are:
{allowed_files}

Retrieved Code Context:
"""

    for i, ctx in enumerate(contexts, 1):
        prompt += f"""
--- Chunk {i} ---
File: {ctx["file_path"]}
Similarity Score: {ctx["score"]}

Code:
{ctx["content"]}

AST Metadata:
{json.dumps(ctx["metadata"], indent=2)}
"""

    prompt += f"""
User Question:
{query}

Respond ONLY in this exact JSON format:

{{
  "summary": "One-line concise answer",
  "explanation": "Detailed explanation grounded in the code",
  "bugs_found": [],
  "suggestions": [],
  "sources": ["file.py"]
}}
"""
    return prompt

# -----------------------------------------------------------------------------
# Robust JSON Extraction (PRODUCTION SAFE)
# -----------------------------------------------------------------------------

def extract_first_valid_json(text: str) -> Dict:
    """
    Extract the FIRST valid JSON object from messy LLM output.
    Handles:
    - multiple JSON blocks
    - markdown fences
    - extra text
    - partial generations
    """
    # Remove markdown fences
    text = re.sub(r"```(?:json)?", "", text)

    # Find all possible JSON blocks
    candidates = re.findall(r"\{[\s\S]*?\}", text)

    for block in candidates:
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            continue

    raise ValueError("No valid JSON object found")

# -----------------------------------------------------------------------------
# Full RAG Pipeline
# -----------------------------------------------------------------------------

def rag_query(query: str, top_k: int = 3) -> Dict:
    logger.info("🔍 Retrieving context for query: %s", query)
    contexts = hybrid_retrieve(query, top_k=top_k)

    if not contexts:
        return {"error": "No relevant code found"}

    prompt = build_augmented_prompt(query, contexts)

    logger.info("🧠 Generating response with LLM...")
    response = llm(
        prompt,
        max_tokens=256,   # FAST mode
        temperature=0.1,  # reduces hallucination
        top_p=0.9,
    )

    raw_text = response["choices"][0]["text"].strip()

    try:
        parsed = extract_first_valid_json(raw_text)

        # Enforce correct sources
        parsed["sources"] = list(
            sorted({ctx["file_path"] for ctx in contexts})
        )

        logger.info("✅ LLM response parsed successfully")
        return parsed

    except Exception as exc:
        logger.error("❌ Failed to parse LLM output: %s", exc)
        return {
            "error": "Failed to parse LLM output",
            "raw_output": raw_text,
        }

# -----------------------------------------------------------------------------
# CLI Entry
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n🔒 PrivCode — Secure Local Code Assistant")
    print("=" * 60)

    while True:
        query = input("\n🔍 Ask a question (or 'exit'): ").strip()
        if query.lower() in {"exit", "quit", "q"}:
            break

        result = rag_query(query)
        print("\n🧠 Answer:\n")
        print(json.dumps(result, indent=2))