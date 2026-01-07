# encrypt_index.py
from cryptography.fernet import Fernet
import os

# Load key from before
with open("secret.key", "rb") as f:
    key = f.read()
cipher = Fernet(key)

for file in ["faiss.index", "documents.json", "metadatas.json", "bm25.pkl"]:
    path = os.path.join("index", file)
    if os.path.exists(path):
        with open(path, "rb") as f:
            data = f.read()
        encrypted = cipher.encrypt(data)
        with open(path + ".enc", "wb") as f:
            f.write(encrypted)
        print(f"Encrypted {file}")