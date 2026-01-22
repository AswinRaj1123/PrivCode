from pathlib import Path

from cryptography.fernet import Fernet

ROOT_DIR = Path(__file__).resolve().parents[2]
KEY_FILE = ROOT_DIR / "secret.key"

with KEY_FILE.open("rb") as f:
    key = f.read()

cipher = Fernet(key)

for file_name in ["faiss.index", "documents.json", "metadatas.json", "bm25.pkl"]:
    path = ROOT_DIR / "index" / file_name
    if path.exists():
        data = path.read_bytes()
        encrypted = cipher.encrypt(data)
        (path.with_suffix(path.suffix + ".enc")).write_bytes(encrypted)
        print(f"Encrypted {file_name}")