# view_logs.py (standalone admin tool)
from backend.utils.logger import view_logs

if __name__ == "__main__":
    print("=== PrivCode Audit Log (decrypted) ===")
    view_logs()
