"""Small structured stdout/stderr logger shared by Download service code."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any


_LEVELS = {"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}


def _enabled(level: str) -> bool:
    configured = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    return _LEVELS.get(level.upper(), 1) >= _LEVELS.get(configured, 1)


def log_event(level: str, message: str, module: str = "DOWNLOAD SERVICE", **fields: Any) -> None:
    """Emit one JSON log line. Never pass passwords, headers, tokens or URLs."""
    if not _enabled(level):
        return
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level.upper(),
        "service": "download",
        "module": module,
        "message": message,
        **fields,
    }
    stream = sys.stderr if level.upper() in {"WARN", "WARNING", "ERROR"} else sys.stdout
    print(json.dumps(event, ensure_ascii=False, default=str), file=stream, flush=True)


def log_info(module: str, message: str) -> None:
    log_event("INFO", message, module)


def log_warning(module: str, message: str) -> None:
    log_event("WARN", message, module)


def log_error(module: str, message: str) -> None:
    log_event("ERROR", message, module)


def log_http(status: int, latency_ms: float, client_ip: str, method: str, path: str, query: str = "") -> None:
    # Do not log query strings: download URLs can contain short-lived tokens.
    log_event("INFO", "http request", "HTTP", status=status, latencyMs=round(latency_ms, 2), clientIp=client_ip, method=method, path=path)
