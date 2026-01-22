from pathlib import Path

from cryptography.fernet import Fernet

ROOT_DIR = Path(__file__).resolve().parents[2]
KEY_FILE = ROOT_DIR / "secret.key"

if not KEY_FILE.exists():
    key = Fernet.generate_key()
    with KEY_FILE.open("wb") as f:
        f.write(key)

with KEY_FILE.open("rb") as f:
    key = f.read()

cipher = Fernet(key)


def encrypt_file(filepath: Path):
    filepath = Path(filepath)
    with filepath.open("rb") as f:
        data = f.read()
    encrypted = cipher.encrypt(data)
    with (filepath.with_suffix(filepath.suffix + ".enc")).open("wb") as f:
        f.write(encrypted)


def decrypt_file(enc_path: Path, original_path: Path):
    enc_path = Path(enc_path)
    original_path = Path(original_path)
    with enc_path.open("rb") as f:
        data = f.read()
    decrypted = cipher.decrypt(data)
    with original_path.open("wb") as f:
        f.write(decrypted)