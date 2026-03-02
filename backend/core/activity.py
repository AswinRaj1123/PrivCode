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


# ── Security Auditor Tracking ──
# In-memory stores for access attempts and policy violations

_access_attempts: List[dict] = []
_policy_violations: List[dict] = []
MAX_ACCESS_LOG = 500
MAX_VIOLATIONS = 500


def record_access_attempt(username: str, action: str, success: bool,
                          ip: str = "unknown", details: str = ""):
    """Record a login/access attempt for auditing."""
    with _lock:
        entry = {
            "username": username,
            "action": action,
            "success": success,
            "ip": ip,
            "details": details,
            "timestamp": datetime.utcnow().isoformat(),
        }
        _access_attempts.append(entry)
        if len(_access_attempts) > MAX_ACCESS_LOG:
            _access_attempts[:] = _access_attempts[-MAX_ACCESS_LOG:]


def record_policy_violation(username: str, violation_type: str,
                            endpoint: str = "", details: str = ""):
    """Record a policy violation (unauthorized access, etc.)."""
    with _lock:
        entry = {
            "username": username,
            "violation_type": violation_type,
            "endpoint": endpoint,
            "details": details,
            "severity": "high" if "admin" in endpoint else "medium",
            "timestamp": datetime.utcnow().isoformat(),
        }
        _policy_violations.append(entry)
        if len(_policy_violations) > MAX_VIOLATIONS:
            _policy_violations[:] = _policy_violations[-MAX_VIOLATIONS:]


def get_access_attempts(limit: int = 100) -> List[dict]:
    """Return recent access attempts, newest first."""
    with _lock:
        return list(reversed(_access_attempts[-limit:]))


def get_policy_violations(limit: int = 100) -> List[dict]:
    """Return recent policy violations, newest first."""
    with _lock:
        return list(reversed(_policy_violations[-limit:]))


def get_security_report() -> dict:
    """Generate an aggregated security report."""
    with _lock:
        total_attempts = len(_access_attempts)
        failed_attempts = sum(1 for a in _access_attempts if not a["success"])
        successful_attempts = total_attempts - failed_attempts
        total_violations = len(_policy_violations)

        # Failed logins by user
        failed_by_user: Dict[str, int] = {}
        for a in _access_attempts:
            if not a["success"]:
                failed_by_user[a["username"]] = failed_by_user.get(a["username"], 0) + 1

        # Violations by type
        violations_by_type: Dict[str, int] = {}
        for v in _policy_violations:
            vt = v["violation_type"]
            violations_by_type[vt] = violations_by_type.get(vt, 0) + 1

        # Violations by severity
        violations_by_severity: Dict[str, int] = {}
        for v in _policy_violations:
            sev = v["severity"]
            violations_by_severity[sev] = violations_by_severity.get(sev, 0) + 1

        # Hourly access pattern
        hourly_access: Dict[str, int] = {}
        for a in _access_attempts:
            ts = a.get("timestamp", "")
            if len(ts) >= 13:
                hour = ts[11:13]
                hourly_access[hour] = hourly_access.get(hour, 0) + 1

        # Active sessions count
        online_count = sum(1 for u in _users.values() if u.get("status") == "online")
        total_users_tracked = len(_users)

        # Top offenders (most failed attempts)
        top_offenders = sorted(failed_by_user.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "access_summary": {
                "total_attempts": total_attempts,
                "successful": successful_attempts,
                "failed": failed_attempts,
                "failure_rate": round(failed_attempts / total_attempts * 100, 1) if total_attempts else 0,
            },
            "violations_summary": {
                "total": total_violations,
                "by_type": violations_by_type,
                "by_severity": violations_by_severity,
            },
            "session_summary": {
                "online_users": online_count,
                "total_tracked_users": total_users_tracked,
            },
            "top_offenders": [{"username": u, "failed_attempts": c} for u, c in top_offenders],
            "hourly_access_pattern": dict(sorted(hourly_access.items())),
        }
