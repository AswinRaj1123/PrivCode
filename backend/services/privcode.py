# privcode.py — PrivCode Full RAG Engine (Day 3 FINAL, BULLETPROOF)

import json
import os
import re
from pathlib import Path
from typing import List, Dict

from llama_cpp import Llama

from services.retriever import hybrid_retrieve
from core.logger import setup_logger

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------

logger = setup_logger()

# Get the project root (2 levels up from backend/services/)
ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT_DIR / "models" / "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"

# Lazy load LLM only when needed
llm = None

def get_llm():
    """Lazy load the LLM model"""
    global llm
    if llm is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"❌ LLM model not found at: {MODEL_PATH}\n"
                f"Please download the model and place it in the models/ directory.\n"
                f"Download from: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF"
            )
        
        logger.info("🧠 Loading local LLM from: %s", MODEL_PATH)

        # Detect available CPU threads (use all physical cores)
        cpu_threads = os.cpu_count() or 6

        llm = Llama(
            model_path=str(MODEL_PATH),
            n_ctx=2048,          # reduced for speed
            n_threads=cpu_threads,
            n_batch=512,         # larger batch = faster prompt processing
            n_gpu_layers=0,      # CPU mode
            verbose=False,
        )
        logger.info("✅ LLM loaded successfully (threads=%d)", cpu_threads)
    return llm

# -----------------------------------------------------------------------------
# Prompt Augmentation
# -----------------------------------------------------------------------------

def build_augmented_prompt(query: str, contexts: List[Dict]) -> str:
    allowed_files = sorted({ctx["file_path"] for ctx in contexts})

    # Truncate each code chunk to limit total prompt size (faster inference)
    MAX_CHUNK_CHARS = 800

    prompt = f"""You are an expert software engineer analyzing a codebase.
Rules: Use ONLY the code below. No guessing. Output ONE JSON object.

Files: {allowed_files}

Code Context:
"""

    for i, ctx in enumerate(contexts, 1):
        code = ctx["content"][:MAX_CHUNK_CHARS]
        prompt += f"""
--- Chunk {i} ---
File: {ctx["file_path"]}
{code}
"""

    prompt += f"""
Question: {query}

Respond in this JSON format:
{{
  "summary": "One-line answer",
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
    Extract the first valid JSON object from messy LLM output.
    More robust than regex-only extraction: supports nested braces,
    leading/trailing prose, and fenced code blocks.
    """
    # Remove markdown fences while keeping content
    cleaned = text.replace("```json", "").replace("```", "").strip()

    decoder = json.JSONDecoder()

    # Try decoding from every opening brace position.
    start_positions = [i for i, ch in enumerate(cleaned) if ch == "{"]
    for start in start_positions:
        try:
            obj, _ = decoder.raw_decode(cleaned[start:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue

    # Fallback: try strict parse if text itself is JSON.
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    raise ValueError("No valid JSON object found")

# -----------------------------------------------------------------------------
# Full RAG Pipeline
# -----------------------------------------------------------------------------

def rag_query(query: str, top_k: int = 3) -> Dict:
    logger.info("Retrieving context for query: %s", query)
    contexts = hybrid_retrieve(query, top_k=top_k)

    if not contexts:
        return {"error": "No relevant code found"}

    prompt = build_augmented_prompt(query, contexts)

    logger.info("Generating response with LLM...")
    
    try:
        model = get_llm()
    except FileNotFoundError as e:
        logger.error(str(e))
        return {
            "error": "LLM model not available",
            "message": str(e),
            "contexts": contexts  # Still return the retrieved context
        }
    
    response = model(
        prompt,
        max_tokens=320,
        temperature=0.1,  # reduces hallucination
        top_p=0.9,
        # Avoid stopping on '}' because it can truncate nested JSON.
        stop=["\n\n\n", "```"],
    )

    raw_text = response["choices"][0]["text"].strip()

    try:
        parsed = extract_first_valid_json(raw_text)

        # Enforce correct sources
        parsed["sources"] = list(
            sorted({ctx["file_path"] for ctx in contexts})
        )

        logger.info("RAG response parsed successfully")
        return parsed

    except Exception as exc:
        logger.error("Failed to parse LLM output: %s", exc)
        # Return a safe structured fallback so API clients don't break.
        return {
            "summary": "Unable to format model output as JSON",
            "explanation": raw_text or "Model returned an empty response.",
            "bugs_found": [],
            "suggestions": [],
            "sources": list(sorted({ctx["file_path"] for ctx in contexts})),
            "parse_error": "No valid JSON object found",
        }


# -----------------------------------------------------------------------------
# General Query (no RAG — direct LLM)
# -----------------------------------------------------------------------------

GENERAL_PROMPT_TEMPLATE = """You are an expert software engineer assistant.
Answer the developer's question clearly and concisely.
If they ask for code, provide working code with brief explanations.
Wrap all code snippets in triple-backtick fences with the language name, for example:
```python
print("hello")
```
Do NOT use any other markdown formatting (no headers, bold, italic, lists with *).
Keep responses focused and practical.

Developer Question:
{query}

Answer:
"""


def general_query(query: str) -> Dict:
    """Send query directly to LLM without RAG retrieval."""
    logger.info("General query (no RAG): %s", query)

    try:
        model = get_llm()
    except FileNotFoundError as e:
        logger.error(str(e))
        return {"error": "LLM model not available", "message": str(e)}

    prompt = GENERAL_PROMPT_TEMPLATE.format(query=query)

    response = model(
        prompt,
        max_tokens=256,
        temperature=0.3,
        top_p=0.9,
        stop=["\n\n\n"],  # stop early to avoid rambling
    )

    raw_text = response["choices"][0]["text"].strip()
    logger.info("General query response generated")

    return {
        "summary": "",
        "explanation": raw_text,
        "bugs_found": [],
        "suggestions": [],
        "sources": [],
    }


# -----------------------------------------------------------------------------
# Auto Query (try RAG first, fall back to general)
# -----------------------------------------------------------------------------

def auto_query(query: str, top_k: int = 3) -> Dict:
    """Try RAG first; if no relevant code found, fall back to general LLM."""
    logger.info("Auto query: %s", query)
    contexts = hybrid_retrieve(query, top_k=top_k)

    if contexts:
        # RAG path — we have relevant code
        logger.info("Auto mode: found %d code chunks, using RAG", len(contexts))
        prompt = build_augmented_prompt(query, contexts)

        try:
            model = get_llm()
        except FileNotFoundError as e:
            logger.error(str(e))
            return {"error": "LLM model not available", "message": str(e)}

        response = model(
            prompt,
            max_tokens=320,
            temperature=0.1,
            top_p=0.9,
            stop=["\n\n\n", "```"],
        )

        raw_text = response["choices"][0]["text"].strip()

        try:
            parsed = extract_first_valid_json(raw_text)
            parsed["sources"] = list(sorted({ctx["file_path"] for ctx in contexts}))
            parsed["mode"] = "repo"
            logger.info("Auto mode: RAG response parsed")
            return parsed
        except Exception as exc:
            logger.error("Failed to parse RAG output: %s", exc)
            return {
                "summary": "Unable to format model output as JSON",
                "explanation": raw_text or "Model returned an empty response.",
                "bugs_found": [],
                "suggestions": [],
                "sources": list(sorted({ctx["file_path"] for ctx in contexts})),
                "mode": "repo",
                "parse_error": "No valid JSON object found",
            }
    else:
        # General path — no relevant code
        logger.info("Auto mode: no relevant code, falling back to general")
        result = general_query(query)
        result["mode"] = "general"
        return result

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