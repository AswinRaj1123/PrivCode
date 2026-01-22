# config.py - PrivCode Performance Configuration
import os

# Authentication Settings
AUTH_CONFIG = {
    "jwt_secret": os.getenv("JWT_SECRET", "your-secret-key-change-in-production"),
    "jwt_expiration_hours": int(os.getenv("JWT_EXPIRATION_HOURS", "24")),
    "admin_username": os.getenv("ADMIN_USERNAME", "admin"),
    "admin_password": os.getenv("ADMIN_PASSWORD", "admin123"),
    "viewer_username": os.getenv("VIEWER_USERNAME", "viewer"),
    "viewer_password": os.getenv("VIEWER_PASSWORD", "viewer123"),
}

# LLM Settings
LLM_CONFIG = {
    "n_gpu_layers": 0,
    "n_ctx": 2048,
    "n_batch": 512,
    "max_tokens": 256,
    "temperature": 0.1,
    "n_threads": 8,
}

# Retrieval Settings
RETRIEVAL_CONFIG = {
    "top_k": 3,
    "max_code_preview": 400,
    "max_functions_shown": 3,
}

# Quick preset configurations
PRESETS = {
    "ultra_fast": {
        **LLM_CONFIG,
        "n_gpu_layers": 0,
        "max_tokens": 150,
        "n_ctx": 1024,
        "n_batch": 1024,
        "n_threads": 12,
        **RETRIEVAL_CONFIG,
        "top_k": 2,
        "max_code_preview": 250,
        "temperature": 0.05,
    },
    "balanced": {
        **LLM_CONFIG,
        "n_gpu_layers": 0,
        "max_tokens": 180,
        "n_ctx": 1536,
        "n_batch": 1024,
        "n_threads": 12,
        **RETRIEVAL_CONFIG,
        "top_k": 3,
    },
    "quality": {
        **LLM_CONFIG,
        "n_gpu_layers": 0,
        "max_tokens": 250,
        "n_ctx": 2048,
        "n_batch": 512,
        "n_threads": 12,
        **RETRIEVAL_CONFIG,
        "top_k": 4,
        "max_code_preview": 400,
    },
}

ACTIVE_PRESET = "ultra_fast"