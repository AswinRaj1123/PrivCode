# backend/utils/redis_encryption.py
# Redis Encryption at Rest — Docker-safe (Day 3)

import os
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------

ENCRYPTION_KEY = os.getenv("REDIS_ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    raise ValueError("Set REDIS_ENCRYPTION_KEY in .env")

fernet = Fernet(ENCRYPTION_KEY.encode())

# Local secure directory (gitignored)
SECURE_DIR = Path("redis_secure")
SECURE_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def encrypt_file(file_path: Path):
    data = file_path.read_bytes()
    encrypted = fernet.encrypt(data)
    enc_path = SECURE_DIR / f"{file_path.name}.enc"
    enc_path.write_bytes(encrypted)
    print(f"🔒 Encrypted {file_path.name} → {enc_path.name}")

def decrypt_file(enc_path: Path):
    try:
        encrypted = enc_path.read_bytes()
        decrypted = fernet.decrypt(encrypted)
        orig_path = SECURE_DIR / enc_path.stem
        orig_path.write_bytes(decrypted)
        print(f"🔓 Decrypted {enc_path.name} → {orig_path.name}")
    except InvalidToken:
        print(f"❌ Invalid encryption key for {enc_path.name}")

# ---------------------------------------------------------------------
# Demo / Proof
# ---------------------------------------------------------------------

if __name__ == "__main__":
    # Simulate Redis persistence file
    dummy_redis_file = SECURE_DIR / "dump.rdb"
    dummy_redis_file.write_bytes(b"SIMULATED REDIS DATA")

    encrypt_file(dummy_redis_file)
    decrypt_file(SECURE_DIR / "dump.rdb.enc")