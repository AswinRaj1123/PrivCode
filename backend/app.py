"""PrivCode FastAPI entrypoint (Next.js compatible)."""

import asyncio
import os
import time
import json
import psutil
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.privcode import rag_query, general_query, auto_query
from services.indexer import incremental_index, REPO_PATH
from core.logger import setup_logger
from core.auth import (
    authenticate_user,
    create_token,
    verify_token,
    check_role,
    USERS,
    hash_password,
    ROLES,
)

# 🔹 NEW: Action Logger Import
from utils.logger import log_action, read_audit_logs

# 🔹 Activity Tracker
from core.activity import (
    record_login,
    record_logout,
    record_query,
    record_index,
    record_heartbeat,
    get_all_activity,
    get_user_activity,
    get_developers_activity,
    get_developer_query_history,
    get_usage_analytics,
)

# 🔹 Security Policies (in-memory store, persists until restart)
_security_policies = {
    "max_session_hours": 24,
    "enforce_mfa": False,
    "min_password_length": 8,
    "max_failed_logins": 5,
    "ip_whitelist_enabled": False,
    "ip_whitelist": [],
    "audit_log_retention_days": 90,
    "allow_public_repos": True,
}

# 🔹 Server boot time for uptime tracking
_server_start_time = time.time()


ROOT_DIR = Path(__file__).resolve().parent.parent

logger = setup_logger()


# =========================================================
# ⏳ BACKGROUND: Git Watcher
# =========================================================

async def _git_watcher(interval: int = 30):
    """Periodically check the repo for new commits and re-index."""
    while True:
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            logger.info("Git watcher stopped")
            return
        try:
            logger.debug("Git watcher: checking for changes...")
            incremental_index(REPO_PATH)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Git watcher error: %s", exc)


# =========================================================
# 🔄 LIFESPAN: Startup / Shutdown
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize every service in order, then tear down on exit."""
    logger.info("=" * 60)
    logger.info("🔒 PrivCode — Initializing backend services...")
    logger.info("=" * 60)

    from utils.redis_utils import get_redis_client, get_embedder, get_index

    # 1️⃣  Redis connection
    try:
        get_redis_client()
    except Exception as exc:
        logger.error("❌ Redis connection failed: %s", exc)
        raise

    # 2️⃣  Embedding model
    get_embedder()

    # 3️⃣  RediSearch index
    get_index()

    # 4️⃣  Verify repository connection
    try:
        from git import Repo as GitRepo
        repo = GitRepo(str(REPO_PATH))
        branch = repo.active_branch.name
        sha = repo.head.commit.hexsha[:8]
        logger.info("✅ Repository connected: %s (branch=%s, HEAD=%s)", REPO_PATH.name, branch, sha)
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ Repository check failed: %s — indexing may be limited", exc)

    # 5️⃣  Initial repository indexing
    try:
        incremental_index(REPO_PATH)
        logger.info("✅ Initial repository indexing complete")
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ Initial indexing skipped: %s", exc)

    # 6️⃣  Pre-warm local LLM (loads model into memory)
    try:
        from services.privcode import get_llm
        get_llm()
    except FileNotFoundError as exc:
        logger.warning("⚠️ LLM model not found — queries will fail until model is placed: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ LLM pre-warm failed: %s", exc)

    # 7️⃣  Background git watcher
    watcher_task = asyncio.create_task(_git_watcher())

    # 8️⃣  Launch Tauri agent in the background
    try:
        import importlib
        main_mod = importlib.import_module("__main__")
        if hasattr(main_mod, "start_agent"):
            main_mod.start_agent()
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ Could not launch Tauri agent: %s", exc)

    logger.info("=" * 60)
    logger.info("✅ All services ready — you may now open the frontend")
    logger.info("   Frontend: http://localhost:3000")
    logger.info("=" * 60)

    yield  # ── server is running ──

    # ── Shutdown ──
    logger.info("🛑 PrivCode shutting down...")
    watcher_task.cancel()
    try:
        await watcher_task
    except asyncio.CancelledError:
        pass

    # Stop Tauri agent if we started it
    try:
        import importlib
        main_mod = importlib.import_module("__main__")
        if hasattr(main_mod, "stop_agent"):
            main_mod.stop_agent()
    except Exception:  # noqa: BLE001
        pass

    logger.info("✅ Clean shutdown complete")

app = FastAPI(
    title="PrivCode API",
    version="1.0",
    description="Private offline RAG backend for code intelligence",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str


class QueryRequest(BaseModel):
    question: str
    repo_path: str
    mode: str = "auto"  # "repo", "general", or "auto"


class IndexRequest(BaseModel):
    repo_path: str
    index_path: str


# ---------- Authentication Dependency ----------
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = parts[1]
    payload = verify_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return payload


# ---------- Routes ----------
@app.get("/health")
def health():
    return {"status": "ok"}


# =========================================================
# 🔐 LOGIN ENDPOINT WITH LOGGING
# =========================================================
@app.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = authenticate_user(req.username, req.password)

    # ❌ Failed Login Logging
    if not user:
        log_action(
            user_email=req.username,  # using username as email identifier
            role="unknown",
            action="login",
            status="FAILED",
            details={"reason": "Invalid username or password"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # ✅ Success Login Logging
    token = create_token(user["username"], user["role"])

    log_action(
        user_email=user["username"],
        role=user["role"],
        action="login",
        status="SUCCESS",
    )

    # Track activity
    record_login(user["username"], user["role"])

    return LoginResponse(
        token=token,
        username=user["username"],
        role=user["role"],
    )


# =========================================================
# 📦 INDEX ENDPOINT WITH LOGGING
# =========================================================
@app.post("/index")
def index_repo(
    req: IndexRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        # Both admin and developer can change / re-index repositories
        incremental_index(req.repo_path)

        # Track repo change
        record_index(current_user["username"], req.repo_path)

        logger.info(
            "User %s indexed repository: %s",
            current_user["username"],
            req.repo_path,
        )

        # ✅ Success Log
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="index",
            status="SUCCESS",
            details={"repo": req.repo_path},
        )

        return {"status": "indexed"}

    except PermissionError as e:
        # ❌ Permission Failure Log
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="index",
            status="ERROR",
            details={"repo": req.repo_path, "error": str(e)},
        )
        raise HTTPException(status_code=403, detail=str(e))

    except Exception as e:  # noqa: BLE001
        logger.exception("Indexing failed")

        # ❌ System Failure Log
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="index",
            status="ERROR",
            details={"repo": req.repo_path, "error": str(e)},
        )

        raise HTTPException(status_code=500, detail=str(e))


# =========================================================
# 🔎 QUERY ENDPOINT WITH LOGGING
# =========================================================
@app.post("/query")
def query(
    req: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        # Route by mode
        mode = (req.mode or "auto").lower()
        if mode == "general":
            response = general_query(req.question)
        elif mode == "repo":
            response = rag_query(req.question)
        else:  # "auto" — try RAG first, fall back to general
            response = auto_query(req.question)

        logger.info(
            "User %s queried (%s): %s",
            current_user["username"],
            mode,
            req.question[:50],
        )

        # ✅ Success Log
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="query",
            query=req.question,
            status="SUCCESS",
            response_summary=str(response)[:200],
        )

        # Track query (with response for manager view)
        record_query(current_user["username"], req.question, mode, "SUCCESS",
                     response_summary=str(response)[:300])

        return {"response": response}

    except Exception as e:  # noqa: BLE001
        logger.exception("Query failed")

        record_query(current_user["username"], req.question, (req.mode or "auto"), "ERROR",
                     response_summary=None)

        # ❌ Failure Log
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="query",
            query=req.question,
            status="ERROR",
            details={"error": str(e)},
        )

        raise HTTPException(status_code=500, detail="Internal error")


# =========================================================
# 👤 CURRENT USER
# =========================================================
@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    # Keep user heartbeat alive
    record_heartbeat(current_user["username"])
    return {
        "username": current_user["username"],
        "role": current_user["role"],
    }


# =========================================================
# 🚪 LOGOUT ENDPOINT
# =========================================================
@app.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    record_logout(current_user["username"])
    log_action(
        user_email=current_user["username"],
        role=current_user["role"],
        action="logout",
        status="SUCCESS",
    )
    return {"status": "logged_out"}


# =========================================================
# 📊 ADMIN: Developer Activity Dashboard (admin-only)
# =========================================================
@app.get("/admin/activity")
def admin_activity(current_user: dict = Depends(get_current_user)):
    """Return activity data for all non-admin users."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    all_data = get_all_activity()
    # Filter to only show developer activity (not admin's own)
    developers = [u for u in all_data if u["role"] != "admin"]
    return {"developers": developers}


@app.get("/admin/activity/{username}")
def admin_user_activity(username: str, current_user: dict = Depends(get_current_user)):
    """Return detailed activity for a specific user."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    data = get_user_activity(username)
    if not data:
        raise HTTPException(status_code=404, detail="User not found in activity log")
    return data


# =========================================================
# 👔 MANAGER: Team Dashboard Endpoints
# =========================================================

def _require_manager_or_admin(current_user: dict):
    """Helper: raise 403 if not manager or admin."""
    if current_user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager or admin access required")


@app.get("/manager/team/members")
def manager_team_members(current_user: dict = Depends(get_current_user)):
    """View team members (developers) and their activity summary."""
    _require_manager_or_admin(current_user)
    developers = get_developers_activity()
    return {"members": developers, "total": len(developers)}


@app.get("/manager/team/query-history")
def manager_query_history(
    username: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """View developers' query history with responses."""
    _require_manager_or_admin(current_user)
    history = get_developer_query_history(username=username, limit=limit)
    return {"history": history, "total": len(history)}


@app.get("/manager/team/analytics")
def manager_usage_analytics(current_user: dict = Depends(get_current_user)):
    """Get developer usage analytics (mode distribution, top users, etc.)."""
    _require_manager_or_admin(current_user)
    analytics = get_usage_analytics()
    return analytics


@app.get("/manager/team/activity-report")
def manager_activity_report(current_user: dict = Depends(get_current_user)):
    """Comprehensive activity report for all developers."""
    _require_manager_or_admin(current_user)
    developers = get_developers_activity()

    report = {
        "generated_at": datetime.utcnow().isoformat() if True else "",
        "summary": {
            "total_developers": len(developers),
            "online": sum(1 for d in developers if d.get("status") == "online"),
            "offline": sum(1 for d in developers if d.get("status") != "online"),
            "total_queries": sum(d.get("total_queries", 0) for d in developers),
            "total_indexing": sum(d.get("total_indexing", 0) for d in developers),
        },
        "developers": [],
    }

    for dev in developers:
        recent = dev.get("recent_queries", [])
        success_count = sum(1 for q in recent if q.get("status") == "SUCCESS")
        error_count = sum(1 for q in recent if q.get("status") != "SUCCESS")
        modes_used = list(set(q.get("mode", "") for q in recent))

        report["developers"].append({
            "username": dev["username"],
            "status": dev.get("status", "offline"),
            "total_queries": dev.get("total_queries", 0),
            "total_indexing": dev.get("total_indexing", 0),
            "success_rate": round(success_count / len(recent) * 100, 1) if recent else 0,
            "error_count": error_count,
            "modes_used": modes_used,
            "last_active": dev.get("last_active"),
            "last_login": dev.get("last_login"),
            "current_repo": dev.get("current_repo"),
        })

    return report


@app.get("/manager/docs/project")
def manager_project_docs(current_user: dict = Depends(get_current_user)):
    """Access project documentation files from the indexed repository."""
    _require_manager_or_admin(current_user)

    docs = []
    doc_extensions = {".md", ".rst", ".txt", ".adoc"}
    doc_names = {"readme", "contributing", "changelog", "license", "authors",
                 "docs", "documentation", "guide", "api", "todo", "notes"}

    try:
        from git import Repo as GitRepo
        repo = GitRepo(str(REPO_PATH))
        tree = repo.head.commit.tree

        def _walk_tree(tree_obj, prefix=""):
            for blob in tree_obj.blobs:
                name_lower = blob.name.lower()
                stem = name_lower.rsplit(".", 1)[0] if "." in name_lower else name_lower
                ext = ("." + name_lower.rsplit(".", 1)[1]) if "." in name_lower else ""
                if ext in doc_extensions or stem in doc_names:
                    try:
                        content = blob.data_stream.read().decode("utf-8", errors="replace")
                    except Exception:
                        content = "(binary or unreadable)"
                    docs.append({
                        "path": f"{prefix}{blob.name}",
                        "size": blob.size,
                        "content": content[:5000],  # cap at 5 KB
                    })
            for subtree in tree_obj.trees:
                _walk_tree(subtree, prefix=f"{prefix}{subtree.name}/")

        _walk_tree(tree)
    except Exception as exc:
        return {"docs": [], "error": str(exc)}

    return {"docs": docs, "total": len(docs)}


# =========================================================
# 👥 ADMIN: User Management
# =========================================================

class AddUserRequest(BaseModel):
    username: str
    password: str
    role: str = "developer"


class UpdateRoleRequest(BaseModel):
    role: str


@app.get("/admin/users")
def admin_list_users(current_user: dict = Depends(get_current_user)):
    """List all users (admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    users = []
    for uname, data in USERS.items():
        users.append({
            "username": uname,
            "role": data["role"],
        })
    return {"users": users}


@app.post("/admin/users")
def admin_add_user(req: AddUserRequest, current_user: dict = Depends(get_current_user)):
    """Add a new user (admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if req.username in USERS:
        raise HTTPException(status_code=409, detail="User already exists")

    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(ROLES.keys())}")

    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    USERS[req.username] = {
        "password_hash": hash_password(req.password),
        "role": req.role,
    }

    log_action(
        user_email=current_user["username"],
        role=current_user["role"],
        action="add_user",
        status="SUCCESS",
        details={"target_user": req.username, "assigned_role": req.role},
    )

    return {"status": "created", "username": req.username, "role": req.role}


@app.delete("/admin/users/{username}")
def admin_delete_user(username: str, current_user: dict = Depends(get_current_user)):
    """Remove a user (admin only). Cannot delete yourself."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    if username not in USERS:
        raise HTTPException(status_code=404, detail="User not found")

    del USERS[username]

    log_action(
        user_email=current_user["username"],
        role=current_user["role"],
        action="delete_user",
        status="SUCCESS",
        details={"target_user": username},
    )

    return {"status": "deleted", "username": username}


# =========================================================
# 🔑 ADMIN: Role Management (RBAC)
# =========================================================

@app.put("/admin/users/{username}/role")
def admin_update_role(username: str, req: UpdateRoleRequest, current_user: dict = Depends(get_current_user)):
    """Update a user's role (admin only)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if username not in USERS:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(ROLES.keys())}")

    old_role = USERS[username]["role"]
    USERS[username]["role"] = req.role

    log_action(
        user_email=current_user["username"],
        role=current_user["role"],
        action="update_role",
        status="SUCCESS",
        details={"target_user": username, "old_role": old_role, "new_role": req.role},
    )

    return {"status": "updated", "username": username, "old_role": old_role, "new_role": req.role}


@app.get("/admin/roles")
def admin_list_roles(current_user: dict = Depends(get_current_user)):
    """List all available roles."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"roles": [{"name": k, "access": v} for k, v in ROLES.items()]}


# =========================================================
# 🕷️ ADMIN: Git Crawler
# =========================================================

class CrawlRequest(BaseModel):
    repo_path: str


@app.post("/admin/crawler/trigger")
def admin_trigger_crawler(req: CrawlRequest, current_user: dict = Depends(get_current_user)):
    """Manually trigger Git crawler / re-indexing."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        incremental_index(req.repo_path)

        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="trigger_crawler",
            status="SUCCESS",
            details={"repo": req.repo_path},
        )

        return {"status": "success", "message": f"Crawler completed for: {req.repo_path}"}
    except Exception as exc:
        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="trigger_crawler",
            status="ERROR",
            details={"repo": req.repo_path, "error": str(exc)},
        )
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/admin/crawler/status")
def admin_crawler_status(current_user: dict = Depends(get_current_user)):
    """Get current Git crawler / repo status."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from git import Repo as GitRepo
        repo = GitRepo(str(REPO_PATH))
        branch = repo.active_branch.name
        sha = repo.head.commit.hexsha[:8]
        last_msg = repo.head.commit.message.strip()[:100]
        last_author = str(repo.head.commit.author)
        last_date = repo.head.commit.committed_datetime.isoformat()

        return {
            "repo_path": str(REPO_PATH),
            "branch": branch,
            "head_sha": sha,
            "last_commit_message": last_msg,
            "last_commit_author": last_author,
            "last_commit_date": last_date,
            "status": "connected",
        }
    except Exception as exc:
        return {
            "repo_path": str(REPO_PATH),
            "status": "error",
            "error": str(exc),
        }


# =========================================================
# 📚 ADMIN: Redis Knowledge Base Management
# =========================================================

@app.get("/admin/redis/stats")
def admin_redis_stats(current_user: dict = Depends(get_current_user)):
    """Get Redis knowledge base statistics."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from utils.redis_utils import get_redis_client, get_index
        client = get_redis_client()
        info = client.info()

        # Count indexed documents
        try:
            idx = get_index()
            idx_info = idx.info()
            num_docs = idx_info.get("num_docs", 0) if isinstance(idx_info, dict) else 0
        except Exception:
            num_docs = "unknown"

        return {
            "status": "connected",
            "used_memory_human": info.get("used_memory_human", "N/A"),
            "used_memory_bytes": info.get("used_memory", 0),
            "total_keys": client.dbsize(),
            "indexed_documents": num_docs,
            "connected_clients": info.get("connected_clients", 0),
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "redis_version": info.get("redis_version", "unknown"),
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


@app.post("/admin/redis/flush")
def admin_redis_flush(current_user: dict = Depends(get_current_user)):
    """Flush the Redis knowledge base (danger!)."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from utils.redis_utils import get_redis_client
        client = get_redis_client()
        client.flushdb()

        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="redis_flush",
            status="SUCCESS",
        )

        return {"status": "flushed", "message": "Knowledge base cleared. Re-index to rebuild."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/admin/redis/reindex")
def admin_redis_reindex(current_user: dict = Depends(get_current_user)):
    """Force full re-index into Redis."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from services.indexer import build_full_index
        build_full_index(REPO_PATH)

        log_action(
            user_email=current_user["username"],
            role=current_user["role"],
            action="redis_reindex",
            status="SUCCESS",
        )

        return {"status": "reindexed", "message": "Full re-index completed."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================
# 🛡️ ADMIN: Security Policies
# =========================================================

@app.get("/admin/security/policies")
def admin_get_policies(current_user: dict = Depends(get_current_user)):
    """Get current security policies."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"policies": _security_policies}


@app.put("/admin/security/policies")
def admin_update_policies(policies: dict, current_user: dict = Depends(get_current_user)):
    """Update security policies."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    allowed_keys = set(_security_policies.keys())
    for key, value in policies.items():
        if key in allowed_keys:
            _security_policies[key] = value

    log_action(
        user_email=current_user["username"],
        role=current_user["role"],
        action="update_security_policies",
        status="SUCCESS",
        details={"updated_keys": list(policies.keys())},
    )

    return {"status": "updated", "policies": _security_policies}


# =========================================================
# 📋 ADMIN: Audit Logs
# =========================================================

@app.get("/admin/audit-logs")
def admin_audit_logs(current_user: dict = Depends(get_current_user)):
    """Read and return decrypted audit logs."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        logs = read_audit_logs()
        return {"logs": logs, "total": len(logs)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# =========================================================
# 📈 ADMIN: System Performance Monitoring
# =========================================================

@app.get("/admin/system/performance")
def admin_system_performance(current_user: dict = Depends(get_current_user)):
    """Get real-time system performance metrics."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        cpu_percent = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        uptime = time.time() - _server_start_time

        # Activity stats
        all_activity = get_all_activity()
        online_count = sum(1 for u in all_activity if u.get("status") == "online")
        total_queries = sum(u.get("total_queries", 0) for u in all_activity)

        return {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_gb": round(mem.total / (1024**3), 2),
                "used_gb": round(mem.used / (1024**3), 2),
                "percent": mem.percent,
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "percent": round(disk.used / disk.total * 100, 1),
            },
            "server_uptime_seconds": round(uptime),
            "online_users": online_count,
            "total_users": len(all_activity),
            "total_queries": total_queries,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
