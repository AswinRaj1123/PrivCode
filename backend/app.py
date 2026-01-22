"""PrivCode FastAPI entrypoint (Next.js compatible)."""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.services.privcode import query_rag
from backend.services.indexer import incremental_index
from backend.core.logger import setup_logger
from backend.core.auth import authenticate_user, create_token, verify_token, check_role

ROOT_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(
    title="PrivCode API",
    version="1.0",
    description="Private offline RAG backend for code intelligence",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = setup_logger()


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


@app.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = authenticate_user(req.username, req.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user["username"], user["role"])

    return LoginResponse(token=token, username=user["username"], role=user["role"])


@app.post("/index")
def index_repo(req: IndexRequest, current_user: dict = Depends(get_current_user)):
    try:
        check_role(current_user["role"], "full_access")
        incremental_index(req.repo_path, req.index_path)
        logger.info(
            "User %s indexed repository: %s",
            current_user["username"],
            req.repo_path,
        )
        return {"status": "indexed"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:  # noqa: BLE001
        logger.exception("Indexing failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
def query(req: QueryRequest, current_user: dict = Depends(get_current_user)):
    try:
        response = query_rag(req.question)
        logger.info(
            "User %s queried: %s", current_user["username"], req.question[:50]
        )
        return {"response": response}
    except Exception:  # noqa: BLE001
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail="Internal error")


@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)