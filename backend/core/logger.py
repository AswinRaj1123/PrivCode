# logger.py - Centralized logger for PrivCode

import io
import logging
import sys
from pathlib import Path


def setup_logger(name: str = "PrivCode", log_file: str = "privcode.log"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if logger.handlers:
        return logger

    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    # Force UTF-8 on the console stream so emoji/unicode don't crash on Windows cp1252
    utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    console_handler = logging.StreamHandler(utf8_stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    log_path = Path(log_file)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger