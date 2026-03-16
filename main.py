"""
PrivCode — Unified Backend Entry Point
=======================================

Start the entire backend with a single command:

    python main.py

Initialization order (handled by FastAPI lifespan in app.py):
  1. Redis connection
  2. Embedding model (all-MiniLM-L6-v2)
  3. RediSearch vector index
  4. Repository connection (git branch & HEAD check)
  5. Initial repository indexing (git-aware incremental)
  6. Local LLM loaded into memory (Meta-Llama-3-8B)
  7. Background git watcher (auto re-index on new commits)
  8. Tauri agent launched automatically in the background

Frontend (separate terminal):
    cd frontend && npm run dev
"""

import atexit
import subprocess
import sys
import os
import signal
from pathlib import Path

# ── Resolve project paths ────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

# Check release build first, then fall back to debug build
AGENT_EXE_RELEASE = ROOT_DIR / "agent" / "src-tauri" / "target" / "release" / "app.exe"
AGENT_EXE_DEBUG = ROOT_DIR / "agent" / "src-tauri" / "target" / "debug" / "app.exe"
AGENT_EXE = AGENT_EXE_RELEASE if AGENT_EXE_RELEASE.exists() else AGENT_EXE_DEBUG

# Add backend/ to the Python path so existing intra-backend imports
# (e.g. `from services.privcode import ...`) continue to work unchanged.
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Set working directory to backend/ so relative paths (log files, etc.) resolve correctly.
os.chdir(BACKEND_DIR)

# ── Imports (available only after path setup) ─────────────────────────
from backend.core.config import API_HOST, API_PORT, LOG_LEVEL  # noqa: E402
from backend.core.logger import setup_logger  # noqa: E402

logger = setup_logger()

# ── Agent process handle (module-level so lifespan can clean it up) ───
_agent_process = None


def start_agent():
    """Launch the Tauri agent executable in the background."""
    global _agent_process
    if not AGENT_EXE.exists():
        logger.warning(
            "⚠️ Tauri agent not found at %s — skipping agent launch. "
            "Build it with: cd agent/src-tauri && cargo tauri build",
            AGENT_EXE,
        )
        return

    try:
        agent_env = os.environ.copy()
        agent_env["PRIVCODE_MANAGED_BACKEND"] = "1"
        agent_env["PRIVCODE_BACKEND_PORT"] = str(API_PORT)

        _agent_process = subprocess.Popen(
            [str(AGENT_EXE)],
            cwd=str(AGENT_EXE.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            env=agent_env,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        logger.info("🖥️  Tauri agent started (PID %d)", _agent_process.pid)
    except Exception as exc:  # noqa: BLE001
        logger.warning("⚠️ Failed to start Tauri agent: %s", exc)


def stop_agent():
    """Terminate the Tauri agent if we started it."""
    global _agent_process
    if _agent_process is not None:
        try:
            _agent_process.terminate()
            _agent_process.wait(timeout=5)
            logger.info("🛑 Tauri agent stopped (PID %d)", _agent_process.pid)
        except Exception:  # noqa: BLE001
            _agent_process.kill()
            logger.info("🛑 Tauri agent killed")
        finally:
            _agent_process = None


# ── Graceful shutdown on Ctrl+C ──────────────────────────────────────
def _handle_signal(signum, frame):
    logger.info("🛑 Received signal %s — shutting down...", signum)
    sys.exit(0)


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)


# ── Main ──────────────────────────────────────────────────────────────
def main():
    """Launch the PrivCode FastAPI server via Uvicorn."""
    import uvicorn

    logger.info("=" * 60)
    logger.info("🔒 PrivCode — Secure Local Code Assistant")
    logger.info("=" * 60)
    logger.info("Backend  : http://%s:%s", API_HOST, API_PORT)
    logger.info("Docs     : http://%s:%s/docs", API_HOST, API_PORT)
    logger.info("Health   : http://%s:%s/health", API_HOST, API_PORT)
    logger.info("=" * 60)

    # Launch tray agent before uvicorn (agent health-checks port 8000
    # and skips starting its own backend if it's already running)
    start_agent()

    # Guarantee stop_agent() is called on every exit path:
    # Ctrl+C, SIGTERM, sys.exit(), or unhandled exception.
    atexit.register(stop_agent)

    try:
        uvicorn.run(
            "app:app",          # FastAPI app object in backend/app.py
            host=API_HOST,
            port=API_PORT,
            log_level=LOG_LEVEL.lower(),
            reload=False,
        )
    finally:
        # Belt-and-suspenders: kill agent the moment uvicorn returns.
        # atexit will also fire — stop_agent() is idempotent (safe to call twice).
        stop_agent()


if __name__ == "__main__":
    main()
