# backend/utils/logger.py (full file)
import os
import json
import time
from datetime import datetime
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import Request  # for dependency injection later

load_dotenv()

# Load encryption key from .env (same as REDIS_ENCRYPTION_KEY or separate)
AUDIT_KEY = os.getenv("AUDIT_ENCRYPTION_KEY")
if not AUDIT_KEY:
    raise ValueError("Set AUDIT_ENCRYPTION_KEY in .env (Fernet base64 key)")

fernet = Fernet(AUDIT_KEY.encode())

AUDIT_LOG_FILE = "query_log.enc"  # in repo root or backend/logs/

def log_action(
    user_email: str,
    role: str,
    action: str,
    query: str = None,
    status: str = "SUCCESS",
    details: dict = None,
    response_summary: str = None
):
    """Append encrypted JSON line to audit log"""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "user": user_email,
        "role": role,
        "action": action,
        "query": query,
        "status": status,
        "details": details or {},
        "response_summary": response_summary[:200] if response_summary else None
    }

    json_line = json.dumps(entry) + "\n"
    encrypted_line = fernet.encrypt(json_line.encode())

    # Append mode - safe for concurrent writes (though FastAPI is usually single-threaded per request)
    with open(AUDIT_LOG_FILE, "ab") as f:
        f.write(encrypted_line + b"\n")

    print(f"[AUDIT] Logged: {action} by {user_email} ({role}) - {status}")

def view_logs():
    """Decrypt and print all log entries (for admin script)"""
    if not os.path.exists(AUDIT_LOG_FILE):
        print("No audit log found.")
        return

    with open(AUDIT_LOG_FILE, "rb") as f:
        encrypted_content = f.read().split(b"\n")[:-1]  # remove last empty

    for line in encrypted_content:
        try:
            decrypted = fernet.decrypt(line).decode()
            entry = json.loads(decrypted.strip())
            print(json.dumps(entry, indent=2))
            print("-" * 60)
        except InvalidToken:
            print("Decryption failed - wrong key or corrupted entry")
            return

if __name__ == "__main__":
    # Test logging
    log_action(
        user_email="aswin@startup.in",
        role="admin",
        action="query",
        query="Where is the payment handler?",
        status="SUCCESS",
        response_summary="Found in payment.py:45-78"
    )
    # Test view
    print("\nViewing logs:")
    view_logs()