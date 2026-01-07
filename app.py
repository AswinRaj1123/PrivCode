# app.py - PrivCode Gradio UI + Encrypted Logging
import gradio as gr
import json
import os
from datetime import datetime
from cryptography.fernet import Fernet
from privcode import generate_answer  # Reuse your RAG function

# --------------------- SECURITY SETUP ---------------------
ENCRYPT_KEY_FILE = "secret.key"
LOG_FILE = "query_log.txt"

# Load encryption key
if not os.path.exists(ENCRYPT_KEY_FILE):
    key = Fernet.generate_key()
    with open(ENCRYPT_KEY_FILE, "wb") as f:
        f.write(key)
else:
    with open(ENCRYPT_KEY_FILE, "rb") as f:
        key = f.read()

cipher = Fernet(key)

# --------------------- ENCRYPTED LOGGING ---------------------
def log_query(query: str, response: str):
    """
    Encrypt and log the query and response to LOG_FILE.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = {
        "timestamp": timestamp,
        "query": query,
        "response": response
    }
    # Convert to JSON string
    json_entry = json.dumps(entry, indent=2)
    # Encrypt and append
    encrypted_entry = cipher.encrypt(json_entry.encode("utf-8"))
    with open(LOG_FILE, "ab") as f:
        f.write(encrypted_entry + b"\n")  # Separate entries by newline

def read_logs():
    """
    Decrypt and return all logs as a list of dicts.
    """
    logs = []
    if not os.path.exists(LOG_FILE):
        return logs
    with open(LOG_FILE, "rb") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    decrypted = cipher.decrypt(line)
                    logs.append(json.loads(decrypted.decode("utf-8")))
                except Exception:
                    continue
    return logs

# --------------------- WRAP GENERATE ANSWER ---------------------
def secure_generate(query: str):
    if not query.strip():
        return "⚠️ Please enter a question."

    result = generate_answer(query)  # this is a STRING
    log_query(query, result)

    return f"### ✅ Answer\n{result}"

# --------------------- GRADIO UI ---------------------
with gr.Blocks(title="PrivCode - Your Private Code Assistant") as demo:
    gr.Markdown("# PrivCode 🚀\nAsk anything about your private codebase — 100% offline & secure.")
    
    with gr.Row():
        with gr.Column(scale=4):
            query_box = gr.Textbox(
                label="Your Question",
                placeholder="e.g., How does authentication work? Find payment bugs?",
                lines=3
            )
        with gr.Column(scale=1):
            submit_btn = gr.Button("Ask", variant="primary")
    
    output_box = gr.Markdown(label="Answer")
    
    gr.Markdown("### Query History (encrypted in query_log.txt, cannot read directly)")

    submit_btn.click(
        fn=secure_generate,
        inputs=query_box,
        outputs=output_box
    )

    gr.Markdown("PrivCode by Aswin Raj — Fully local, no data leaks.")

if __name__ == "__main__":
    demo.launch(share=False, server_name="127.0.0.1", server_port=7860)