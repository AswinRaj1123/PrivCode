# config.py - PrivCode Performance Configuration

# LLM Settings
LLM_CONFIG = {
    # GPU Acceleration - CPU only (CUDA compilation failed)
    "n_gpu_layers": 0,
    
    # Context window (smaller = faster)
    "n_ctx": 2048,
    
    # Batch size (larger = faster inference, but more memory)
    "n_batch": 512,
    
    # Max tokens to generate (smaller = faster)
    "max_tokens": 256,
    
    # Temperature (lower = faster, more focused)
    "temperature": 0.1,
    
    # Threads for CPU inference
    "n_threads": 8,
}

# Retrieval Settings
RETRIEVAL_CONFIG = {
    # Number of chunks to retrieve (fewer = faster)
    "top_k": 3,
    
    # Max code preview length per chunk (shorter = faster)
    "max_code_preview": 400,
    
    # Max functions to show per chunk
    "max_functions_shown": 3,
}

# Quick preset configurations
PRESETS = {
    "ultra_fast": {
        **LLM_CONFIG,
        "n_gpu_layers": 0,
        "max_tokens": 150,
        "n_ctx": 1024,
        "n_batch": 1024,       # Max batch for CPU
        "n_threads": 12,        # All cores
        **RETRIEVAL_CONFIG,
        "top_k": 2,
        "max_code_preview": 250,
        "temperature": 0.05,    # Faster generation
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

# Select your preset here - CPU-OPTIMIZED (CUDA unavailable)
ACTIVE_PRESET = "ultra_fast"  # Target: 12-15 seconds per query
