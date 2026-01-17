# crypto_utils.py
from cryptography.fernet import Fernet
import os

KEY_FILE = "secret.key"

if not os.path.exists(KEY_FILE):
    key = Fernet.generate_key()
    with open(KEY_FILE, "wb") as f:
        f.write(key)
with open(KEY_FILE, "rb") as f:
    key = f.read()

cipher = Fernet(key)

def encrypt_file(filepath):
    with open(filepath, "rb") as f:
        data = f.read()
    encrypted = cipher.encrypt(data)
    with open(filepath + ".enc", "wb") as f:
        f.write(encrypted)

def decrypt_file(enc_path, original_path):
    with open(enc_path, "rb") as f:
        data = f.read()
    decrypted = cipher.decrypt(data)
    with open(original_path, "wb") as f:
        f.write(decrypted)