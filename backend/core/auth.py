# auth.py - Role-based access control with authentication

import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict

# Import config from config.py - ENFORCES .env requirements
from core.config import (
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRATION_HOURS,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    VIEWER_USERNAME,
    VIEWER_PASSWORD,
)

import jwt

ROLES = {
    "developer": "view_only",
    "admin": "full_access",
}


def _initialize_users():
    """Initialize users from config (enforces .env)."""
    return {
        ADMIN_USERNAME: {
            "password_hash": hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest(),
            "role": "admin",
        },
        VIEWER_USERNAME: {
            "password_hash": hashlib.sha256(VIEWER_PASSWORD.encode()).hexdigest(),
            "role": "developer",
        },
    }


# In-memory user store (replace with database in production)
USERS = _initialize_users()


def hash_password(password: str) -> str:
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(password) == password_hash


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    """Authenticate a user with username and password."""

    user = USERS.get(username)
    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return {"username": username, "role": user["role"]}


def create_token(username: str, role: str) -> str:
    """Create a JWT token for authenticated user."""

    payload = {
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[Dict]:
    """Verify a JWT token and return the payload."""

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def check_role(user_role: str, required: str):
    """Raises PermissionError if role is insufficient."""

    actual = ROLES.get(user_role)
    if actual != required:
        raise PermissionError("Access denied: insufficient privileges")