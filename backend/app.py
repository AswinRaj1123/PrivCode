"""PrivCode FastAPI entrypoint (Next.js compatible)."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

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
)

# 🔹 NEW: Action Logger Import
from utils.logger import log_action

# 🔹 Activity Tracker
from core.activity import (
    record_login,
    record_logout,
    record_query,
    record_index,
    record_heartbeat,
    get_all_activity,
    get_user_activity,
)


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

        # Track query
        record_query(current_user["username"], req.question, mode, "SUCCESS")

        return {"response": response}

    except Exception as e:  # noqa: BLE001
        logger.exception("Query failed")

        record_query(current_user["username"], req.question, (req.mode or "auto"), "ERROR")

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
