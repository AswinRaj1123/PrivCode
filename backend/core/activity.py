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


def record_query(username: str, query: str, mode: str, status: str,
                  response_summary: str = None):
    """Call after each query."""
    with _lock:
        u = _ensure(username)
        now = datetime.utcnow().isoformat()
        u["total_queries"] += 1
        u["last_active"] = now
        entry = {
            "query": query[:100],
            "mode": mode,
            "status": status,
            "timestamp": now,
        }
        if response_summary:
            entry["response"] = response_summary[:300]
        u["recent_queries"].append(entry)
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


def get_developers_activity() -> List[dict]:
    """Return activity for all developer-role users (for manager view)."""
    with _lock:
        result = []
        for username, data in _users.items():
            if data.get("role") == "developer":
                result.append({"username": username, **data})
        return result


def get_developer_query_history(username: str = None,
                                 limit: int = 50) -> List[dict]:
    """Return query history for one or all developers, including responses."""
    with _lock:
        entries = []
        for uname, data in _users.items():
            if data.get("role") != "developer":
                continue
            if username and uname != username:
                continue
            for q in data.get("recent_queries", []):
                entries.append({"username": uname, **q})
        # Sort newest first
        entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return entries[:limit]


def get_usage_analytics() -> dict:
    """Return aggregated usage analytics across developers."""
    with _lock:
        total_devs = 0
        online_devs = 0
        total_queries = 0
        total_indexing = 0
        mode_counts = {}
        status_counts = {}
        hourly_distribution = {}
        top_users = []

        for username, data in _users.items():
            if data.get("role") != "developer":
                continue
            total_devs += 1
            if data.get("status") == "online":
                online_devs += 1
            total_queries += data.get("total_queries", 0)
            total_indexing += data.get("total_indexing", 0)

            top_users.append({
                "username": username,
                "total_queries": data.get("total_queries", 0),
                "status": data.get("status", "offline"),
            })

            for q in data.get("recent_queries", []):
                mode = q.get("mode", "unknown")
                mode_counts[mode] = mode_counts.get(mode, 0) + 1
                st = q.get("status", "unknown")
                status_counts[st] = status_counts.get(st, 0) + 1
                ts = q.get("timestamp", "")
                if len(ts) >= 13:
                    hour = ts[11:13]
                    hourly_distribution[hour] = hourly_distribution.get(hour, 0) + 1

        top_users.sort(key=lambda x: x["total_queries"], reverse=True)

        return {
            "total_developers": total_devs,
            "online_developers": online_devs,
            "total_queries": total_queries,
            "total_indexing": total_indexing,
            "mode_distribution": mode_counts,
            "status_distribution": status_counts,
            "hourly_distribution": dict(sorted(hourly_distribution.items())),
            "top_users": top_users[:10],
        }
