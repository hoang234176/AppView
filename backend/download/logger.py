"""Clean human-readable stdout/stderr logger shared by Download service code."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Any


_LEVELS = {"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}


def _enabled(level: str) -> bool:
    configured = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    return _LEVELS.get(level.upper(), 1) >= _LEVELS.get(configured, 1)


def _pad_level(level: str) -> str:
    lvl = level.strip().upper()
    if lvl in {"WARN", "WARNING"}:
        return "WARN "
    if len(lvl) < 5:
        return lvl.ljust(5)
    return lvl


def _normalize_module(module: str) -> str:
    mod = module.strip().upper()
    if mod in {"", "DOWNLOAD", "DOWNLOAD SERVICE", "DOWNLOAD_SERVICE"}:
        return ""
    if mod.startswith("[") and mod.endswith("]"):
        mod = mod[1:-1].strip()
    if mod in {"DOWNLOAD", "DOWNLOAD SERVICE"}:
        return ""
    if mod == "COORDINATOR WORKER":
        return "[COORDINATOR]"
    return f"[{mod}]"


def _format_fields(fields: dict[str, Any]) -> str:
    if not fields:
        return ""

    error_code = fields.get("errorCode")
    error_msg = fields.get("error") or fields.get("message")
    has_error_code = bool(error_code and isinstance(error_code, str))

    skip_keys = set()
    if has_error_code:
        skip_keys.add("errorCode")
        if "error" in fields:
            skip_keys.add("error")
        if "message" in fields:
            skip_keys.add("message")

    parts: list[str] = []
    if has_error_code:
        if error_msg and isinstance(error_msg, str) and error_msg != error_code:
            parts.append(f"[{error_code}] {error_msg}")
        else:
            parts.append(f"[{error_code}]")

    for key in sorted(fields.keys()):
        if key in skip_keys:
            continue
        val = fields[key]
        if val is None:
            continue
        if isinstance(val, (list, tuple)):
            items_str = ", ".join(str(item) for item in val)
            parts.append(f"{key}=[{items_str}]")
        else:
            parts.append(f"{key}={val}")

    return " ".join(parts)


def _format_event(level: str, message: str, module: str = "DOWNLOAD SERVICE", **fields: Any) -> str:
    now = datetime.now().strftime("%H:%M:%S")
    lvl = _pad_level(level)

    msg = message.strip()
    # Strip redundant download service prefixes in msg
    upper_msg = msg.upper()
    if upper_msg.startswith("[DOWNLOAD SERVICE]"):
        msg = msg[len("[DOWNLOAD SERVICE]"):].strip()
    elif upper_msg.startswith("[DOWNLOAD]"):
        msg = msg[len("[DOWNLOAD]"):].strip()

    mod_tag = _normalize_module(module)
    if mod_tag:
        formatted_msg = f"{mod_tag} {msg}"
    else:
        formatted_msg = msg

    formatted_fields = _format_fields(fields)
    if formatted_fields:
        return f"{now} {lvl} [DOWNLOAD] {formatted_msg} | {formatted_fields}"
    return f"{now} {lvl} [DOWNLOAD] {formatted_msg}"


def log_event(level: str, message: str, module: str = "DOWNLOAD SERVICE", **fields: Any) -> None:
    """Emit one clean human-readable log line. Never pass passwords, headers, tokens or URLs."""
    if not _enabled(level):
        return
    line = _format_event(level, message, module, **fields)
    stream = sys.stderr if level.upper() in {"WARN", "WARNING", "ERROR"} else sys.stdout
    print(line, file=stream, flush=True)


def log_info(module: str, message: str) -> None:
    log_event("INFO", message, module)


def log_warning(module: str, message: str) -> None:
    log_event("WARN", message, module)


def log_error(module: str, message: str) -> None:
    log_event("ERROR", message, module)


def log_http(status: int, latency_ms: float, client_ip: str, method: str, path: str, query: str = "") -> None:
    # Do not log query strings: download URLs can contain short-lived tokens.
    log_event("INFO", "http request", "HTTP", status=status, latencyMs=round(latency_ms, 2), clientIp=client_ip, method=method, path=path)
