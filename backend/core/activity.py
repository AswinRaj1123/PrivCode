# backend/core/activity.py — In-memory developer activity tracker
"""
Tracks per-user sessions, login/logout, repo usage, and query stats.
Data lives in memory (resets on server restart). For production, swap
the dict with Redis or a database.
"""

from datetime import datetime
from typing import Dict, List, Optional
import threading

_lock = threading.Lock()

# ── Schema ──
# _users[username] = {
#   "role": str,
#   "status": "online" | "offline",
#   "last_login": ISO str | None,
#   "last_logout": ISO str | None,
#   "last_active": ISO str | None,
#   "current_repo": str | None,
#   "total_queries": int,
#   "total_indexing": int,
#   "recent_queries": [{"query": str, "mode": str, "status": str, "timestamp": str}, ...],
#   "sessions": [{"login": str, "logout": str | None}, ...],
# }

_users: Dict[str, dict] = {}
MAX_RECENT = 20  # keep last N queries per user


def _ensure(username: str, role: str = "developer") -> dict:
    """Get or create user record."""
    if username not in _users:
        _users[username] = {
            "role": role,
            "status": "offline",
            "last_login": None,
            "last_logout": None,
            "last_active": None,
            "current_repo": None,
            "total_queries": 0,
            "total_indexing": 0,
            "recent_queries": [],
            "sessions": [],
        }
    return _users[username]


def record_login(username: str, role: str):
    """Call when user logs in."""
    with _lock:
        u = _ensure(username, role)
        now = datetime.utcnow().isoformat()
        u["role"] = role
        u["status"] = "online"
        u["last_login"] = now
        u["last_active"] = now
        u["sessions"].append({"login": now, "logout": None})


def record_logout(username: str):
    """Call when user logs out."""
    with _lock:
        u = _ensure(username)
        now = datetime.utcnow().isoformat()
        u["status"] = "offline"
        u["last_logout"] = now
        u["last_active"] = now
        # Close the open session
        for s in reversed(u["sessions"]):
            if s["logout"] is None:
                s["logout"] = now
                break


def record_query(username: str, query: str, mode: str, status: str):
    """Call after each query."""
    with _lock:
        u = _ensure(username)
        now = datetime.utcnow().isoformat()
        u["total_queries"] += 1
        u["last_active"] = now
        u["recent_queries"].append({
            "query": query[:100],
            "mode": mode,
            "status": status,
            "timestamp": now,
        })
        # Trim history
        if len(u["recent_queries"]) > MAX_RECENT:
            u["recent_queries"] = u["recent_queries"][-MAX_RECENT:]


def record_index(username: str, repo_path: str):
    """Call when a user indexes a repo."""
    with _lock:
        u = _ensure(username)
        now = datetime.utcnow().isoformat()
        u["total_indexing"] += 1
        u["current_repo"] = repo_path
        u["last_active"] = now


def record_heartbeat(username: str):
    """Lightweight touch to keep online status fresh."""
    with _lock:
        u = _ensure(username)
        u["last_active"] = datetime.utcnow().isoformat()
        u["status"] = "online"


def get_all_activity() -> List[dict]:
    """Return a snapshot of all user activity (admin use)."""
    with _lock:
        result = []
        for username, data in _users.items():
            result.append({"username": username, **data})
        return result


def get_user_activity(username: str) -> Optional[dict]:
    """Return activity for one user."""
    with _lock:
        data = _users.get(username)
        if data:
            return {"username": username, **data}
        return None
