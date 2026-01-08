import os
import json
from datetime import datetime
from cryptography.fernet import Fernet
import gradio as gr

def show_logs():
    if os.path.exists("query_log.txt"):
        with open("query_log.txt", "r") as f:
            return f.read()
    return "No logs yet."

gr.Interface(fn=show_logs, inputs=None, outputs="text").launch(server_port=7861)