# auth.py - Role-based access control with authentication

import os
import jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict

ROLES = {
    "viewer": "view_only",
    "admin": "full_access",
}

# In-memory user store (replace with database in production)
USERS = {
    os.getenv("ADMIN_USERNAME", "admin"): {
        "password_hash": hashlib.sha256(
            os.getenv("ADMIN_PASSWORD", "admin123").encode()
        ).hexdigest(),
        "role": "admin",
    },
    os.getenv("VIEWER_USERNAME", "viewer"): {
        "password_hash": hashlib.sha256(
            os.getenv("VIEWER_PASSWORD", "viewer123").encode()
        ).hexdigest(),
        "role": "viewer",
    },
}

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


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