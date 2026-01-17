# api.py - PrivCode Backend API (Next.js compatible)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from privcode import query_rag
from indexer import incremental_index
from logger import setup_logger

app = FastAPI(
    title="PrivCode API",
    version="1.0",
    description="Private offline RAG backend for code intelligence"
)

logger = setup_logger()

# ---------- Models ----------

class QueryRequest(BaseModel):
    question: str
    repo_path: str

class IndexRequest(BaseModel):
    repo_path: str
    index_path: str

# ---------- Routes ----------

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/index")
def index_repo(req: IndexRequest):
    try:
        incremental_index(req.repo_path, req.index_path)
        return {"status": "indexed"}
    except Exception as e:
        logger.exception("Indexing failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
def query(req: QueryRequest):
    try:
        response = query_rag(req.question, req.repo_path)
        return {"response": response}
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail="Internal error")