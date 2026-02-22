# config.py - PrivCode Configuration with strict .env validation
"""
Configuration management with strict .env validation.
All critical secrets MUST be in .env - no fallbacks!
"""

import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()


class ConfigError(Exception):
    """Raised when required config is missing."""
    pass


def _get_required_env(key: str, description: str = "") -> str:
    """Get a required environment variable or raise ConfigError."""
    value = os.getenv(key)
    if not value:
        desc = f" ({description})" if description else ""
        raise ConfigError(
            f"❌ FATAL: Missing required environment variable: {key}{desc}\n"
            f"   Please add it to your .env file.\n"
            f"   See .env.example for required variables."
        )
    return value


def _get_optional_env(key: str, default: str = None) -> str:
    """Get an optional environment variable with a default."""
    return os.getenv(key, default)


# =====================================================
# AUTHENTICATION & SECURITY
# =====================================================

JWT_SECRET = _get_required_env("JWT_SECRET", "Secret key for JWT token signing")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(_get_optional_env("JWT_EXPIRATION_HOURS", "24"))

# User Credentials - REQUIRED (no defaults!)
ADMIN_USERNAME = _get_required_env("ADMIN_USERNAME", "Admin username")
ADMIN_PASSWORD = _get_required_env("ADMIN_PASSWORD", "Admin password")

VIEWER_USERNAME = _get_required_env("VIEWER_USERNAME", "Developer username")
VIEWER_PASSWORD = _get_required_env("VIEWER_PASSWORD", "Developer password")

# =====================================================
# REDIS CONFIGURATION
# =====================================================

REDIS_URL = _get_required_env("REDIS_URL", "Redis connection URL")
REDIS_ENCRYPTION_KEY = _get_required_env("REDIS_ENCRYPTION_KEY", "Fernet key for Redis encryption")

# =====================================================
# AUDIT LOGGING
# =====================================================

AUDIT_ENCRYPTION_KEY = _get_required_env("AUDIT_ENCRYPTION_KEY", "Fernet key for audit logs")
AUDIT_LOG_FILE = _get_optional_env("AUDIT_LOG_FILE", "query_log.enc")

# =====================================================
# API CONFIGURATION
# =====================================================

API_HOST = _get_optional_env("API_HOST", "0.0.0.0")
API_PORT = int(_get_optional_env("API_PORT", "8000"))

# CORS - Restrict in production
ALLOWED_ORIGINS = _get_optional_env("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS_LIST = [origin.strip() for origin in ALLOWED_ORIGINS.split(",")]

# =====================================================
# LOGGING
# =====================================================

LOG_LEVEL = _get_optional_env("LOG_LEVEL", "INFO")

# =====================================================
# EMBEDDING MODEL
# =====================================================

EMBEDDING_MODEL = _get_optional_env("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# =====================================================
# LLM Settings
# =====================================================

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

# =====================================================
# SECURITY VALIDATION ON IMPORT
# =====================================================

def _validate_config():
    """Warn about weak/default credentials in development."""
    warnings = []
    
    if ADMIN_PASSWORD == "admin123":
        warnings.append("⚠️  ADMIN_PASSWORD is default - change in production!")
    
    if VIEWER_PASSWORD == "viewer123":
        warnings.append("⚠️  VIEWER_PASSWORD is default - change in production!")
    
    if JWT_SECRET == "your-secret-key-change-in-production":
        warnings.append("⚠️  JWT_SECRET is default - change in production!")
    
    if warnings:
        print("\n" + "="*60)
        print("SECURITY WARNINGS:")
        print("="*60)
        for w in warnings:
            print(f"  {w}")
        print("="*60 + "\n")


_validate_config()
