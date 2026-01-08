#app.py - PrivCode Pro Gradio UI with Encryption (Universal Gradio 6.x)
import gradio as gr
import json
import os
from datetime import datetime
from cryptography.fernet import Fernet
from privcode import generate_answer

# --------------------- SECURITY SETUP ---------------------
ENCRYPT_KEY_FILE = "secret.key"
LOG_FILE = "query_log.txt"

# Load or generate encryption key
if not os.path.exists(ENCRYPT_KEY_FILE):
    key = Fernet.generate_key()
    with open(ENCRYPT_KEY_FILE, "wb") as f:
        f.write(key)
else:
    with open(ENCRYPT_KEY_FILE, "rb") as f:
        key = f.read()

cipher = Fernet(key)

# --------------------- ENCRYPTED LOGGING ---------------------
def log_query(query: str, result: dict):
    """Encrypt and log the query and response to LOG_FILE."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = {
        "timestamp": timestamp,
        "query": query,
        "result": result
    }
    json_entry = json.dumps(entry, indent=2)
    encrypted_entry = cipher.encrypt(json_entry.encode("utf-8"))
    with open(LOG_FILE, "ab") as f:
        f.write(encrypted_entry + b"\n")

def read_logs():
    """Decrypt and return all logs as a list of dicts."""
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

# --------------------- CHAT INTERFACE ---------------------
def chat_response(message, history):
    """Process user message and return updated chat history."""
    if not message.strip():
        return history, ""

    result = generate_answer(message)
    log_query(message, result)

    # Parse result (handle both dict and string responses)
    if isinstance(result, dict):
        answer = result.get("answer", "No detailed answer generated.")
        sources = result.get("sources", [])
        issues = result.get("potential_issues", [])
        suggestions = result.get("suggestions", [])
    else:
        # Fallback if generate_answer returns a string
        answer = str(result)
        sources = []
        issues = []
        suggestions = []

    # Build formatted response
    response = f"**Answer:**\n{answer}\n\n"

    if sources:
        response += f"**Sources ({len(sources)} files):**\n" + "\n".join([f"- `{s}`" for s in sources]) + "\n\n"

    if issues:
        response += "**Potential Issues:**\n" + "\n".join([f"- {i}" for i in issues]) + "\n\n"

    if suggestions:
        response += "**Suggestions:**\n" + "\n".join([f"- {s}" for s in suggestions])

    # Append to history - using dict format for Gradio 6.x
    if history is None:
        history = []

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": response})

    return history, ""

def export_chat(history):
    """Export chat session to encrypted JSON file."""
    if not history:
        return None

    export_data = {
        "exported_on": datetime.now().isoformat(),
        "session": history
    }
    filename = f"privcode_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # Encrypt the export
    json_str = json.dumps(export_data, indent=2)
    encrypted_data = cipher.encrypt(json_str.encode("utf-8"))

    with open(filename, "wb") as f:
        f.write(encrypted_data)

    return filename

def view_history():
    """Decrypt and display query history."""
    logs = read_logs()
    if not logs:
        return "No query history available."

    history_text = "# Encrypted Query History\n\n"
    for idx, log in enumerate(logs[-10:], 1):  # Show last 10 entries
        history_text += f"**[{log['timestamp']}]**\n"
        history_text += f"**Q:** {log['query']}\n"
        result = log.get('result', {})
        if isinstance(result, dict):
            history_text += f"**A:** {result.get('answer', 'N/A')}\n"
        else:
            history_text += f"**A:** {str(result)}\n"
        history_text += "-" * 60 + "\n\n"

    return history_text

# --------------------- GRADIO UI ---------------------
with gr.Blocks(title="PrivCode Pro") as demo:
    gr.Markdown("# PrivCode 🚀\n**Your Private Offline Code Assistant** — 100% local, secure, encrypted.")

    with gr.Tabs():
        with gr.Tab("💬 Chat"):
            chatbot = gr.Chatbot(
                label="Chat with your codebase",
                height=600
            )
            msg = gr.Textbox(
                label="Ask about your code", 
                placeholder="e.g., Explain payment flow / Find security issues / How does auth work?", 
                lines=2
            )

            with gr.Row():
                clear = gr.Button("🗑️ Clear Chat")
                export = gr.Button("💾 Export Session (Encrypted)")

            file_output = gr.File(label="Downloaded Session")

            # Event handlers
            msg.submit(chat_response, [msg, chatbot], [chatbot, msg])
            clear.click(lambda: [], None, chatbot)
            export.click(export_chat, chatbot, file_output)

        with gr.Tab("📜 History"):
            gr.Markdown("### Recent Query History (Decrypted View)")
            history_btn = gr.Button("🔓 Load History")
            history_output = gr.Markdown()

            history_btn.click(view_history, None, history_output)

    gr.Markdown("""
    ### 🔒 Security Features
    - **Fully offline** • No data leaves your machine  
    - **End-to-end encryption** • All logs encrypted with Fernet  
    - **Hybrid retrieval** • Semantic + keyword search  
    - **Structured answers** • Sources, issues, and suggestions  
    - **Secure exports** • Encrypted session downloads  

    ---
    *PrivCode by Aswin Raj — Enterprise-grade privacy for your codebase*
    """)

if __name__ == "__main__":
    demo.launch(
        share=False, 
        server_name="127.0.0.1", 
        server_port=7860,
        theme=gr.themes.Soft()
    )