"""Clean human-readable stdout/stderr logger shared by Download service code."""

from __future__ import annotations

import os
import sys
import threading
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Any


_LEVELS = {"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}

# ANSI Colors
_COLOR_RESET = "\033[0m"
_COLOR_DIM = "\033[2m"
_COLOR_BOLD = "\033[1m"
_COLOR_GRAY = "\033[90m"
_COLOR_RED = "\033[31m"
_COLOR_BOLD_RED = "\033[1;31m"
_COLOR_GREEN = "\033[32m"
_COLOR_YELLOW = "\033[33m"
_COLOR_MAGENTA = "\033[35m"
_COLOR_BOLD_MAGENTA = "\033[1;35m"
_COLOR_CYAN = "\033[36m"

_use_colors = os.getenv("NO_COLOR") is None and os.getenv("TERM") != "dumb"
_file_lock = threading.Lock()
_log_file_handle = None
_current_log_date = None


def _get_log_file() -> Any:
    global _log_file_handle, _current_log_date
    today = datetime.now().strftime("%Y-%m-%d")
    if _log_file_handle is None or _current_log_date != today:
        if _log_file_handle is not None:
            try:
                _log_file_handle.close()
            except Exception:
                pass
            _log_file_handle = None
        home = Path.home()
        log_dir = home / ".tmp-appview" / "log" / "download"
        try:
            log_dir.mkdir(parents=True, exist_ok=True)
            _log_file_handle = open(log_dir / f"{today}.log", "a", encoding="utf-8")
            _current_log_date = today
        except Exception:
            _log_file_handle = None
    return _log_file_handle


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


def _format_colored_event(level: str, message: str, module: str = "DOWNLOAD SERVICE", **fields: Any) -> str:
    now = datetime.now().strftime("%H:%M:%S")
    time_str = f"{_COLOR_GRAY}{now}{_COLOR_RESET}"

    lvl_upper = level.strip().upper()
    if lvl_upper == "INFO":
        lvl_color = _COLOR_GREEN
    elif lvl_upper in {"WARN", "WARNING"}:
        lvl_color = _COLOR_YELLOW
    elif lvl_upper == "ERROR":
        lvl_color = _COLOR_BOLD_RED
    elif lvl_upper == "DEBUG":
        lvl_color = _COLOR_GRAY
    else:
        lvl_color = _COLOR_RESET

    lvl_str = f"{lvl_color}{_pad_level(level)}{_COLOR_RESET}"
    service_tag = f"{_COLOR_BOLD_MAGENTA}[DOWNLOAD]{_COLOR_RESET}"

    msg = message.strip()
    upper_msg = msg.upper()
    if upper_msg.startswith("[DOWNLOAD SERVICE]"):
        msg = msg[len("[DOWNLOAD SERVICE]"):].strip()
    elif upper_msg.startswith("[DOWNLOAD]"):
        msg = msg[len("[DOWNLOAD]"):].strip()

    mod_tag = _normalize_module(module)
    if mod_tag:
        formatted_msg = f"{_COLOR_CYAN}{mod_tag}{_COLOR_RESET} {msg}"
    else:
        formatted_msg = msg

    formatted_fields = _format_fields(fields)
    if formatted_fields:
        fields_str = f"{_COLOR_DIM}| {formatted_fields}{_COLOR_RESET}"
        return f"{time_str} {lvl_str} {service_tag} {formatted_msg} {fields_str}"
    return f"{time_str} {lvl_str} {service_tag} {formatted_msg}"


def log_event(level: str, message: str, module: str = "DOWNLOAD SERVICE", **fields: Any) -> None:
    """Emit one clean human-readable log line to stdout (colored) and ~/.tmp-appview/log/download/YYYY-MM-DD.log (plain)."""
    if not _enabled(level):
        return
    plain_line = _format_event(level, message, module, **fields)

    # 1. Output to stdout/stderr
    if _use_colors:
        colored_line = _format_colored_event(level, message, module, **fields)
        stream = sys.stderr if level.upper() in {"WARN", "WARNING", "ERROR"} else sys.stdout
        print(colored_line, file=stream, flush=True)
    else:
        stream = sys.stderr if level.upper() in {"WARN", "WARNING", "ERROR"} else sys.stdout
        print(plain_line, file=stream, flush=True)

    # 2. Append to ~/.tmp-appview/log/download/YYYY-MM-DD.log
    with _file_lock:
        f = _get_log_file()
        if f:
            try:
                now_full = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"{now_full} {plain_line[len('15:04:05 '):]}\n")
                f.flush()
            except Exception:
                pass


def log_info(module: str, message: str, **fields: Any) -> None:
    log_event("INFO", message, module, **fields)


def log_warning(module: str, message: str, **fields: Any) -> None:
    log_event("WARN", message, module, **fields)


def log_error(module: str, message: str, **fields: Any) -> None:
    log_event("ERROR", message, module, **fields)


def log_debug(module: str, message: str, **fields: Any) -> None:
    log_event("DEBUG", message, module, **fields)


def log_http(status: int, latency_ms: float, client_ip: str, method: str, path: str, query: str = "") -> None:
    # Do not log query strings: download URLs can contain short-lived tokens.
    log_event("INFO", f"[HTTP] {method} {path}", "HTTP", status=status, latencyMs=round(latency_ms, 2), clientIp=client_ip)


def safe_url(url: str) -> str:
    """Strip query parameters and credentials from URL to prevent token leakage in terminal logs."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlparse(str(url).strip())
        return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    except Exception:
        return str(url)


def log_cookie_update(platform: str, field_names: list[str] | set[str]) -> None:
    """Log updated cookie field names only, each on its own line without values."""
    clean_platform = (platform or "Unknown").capitalize()
    unique_names = sorted({str(f).strip() for f in field_names if str(f).strip()})
    if not unique_names:
        return
    log_info("COOKIE", f"Phát hiện cookie được cập nhật ({clean_platform}):")
    for field_name in unique_names:
        log_info("COOKIE", f"  • {field_name}")
