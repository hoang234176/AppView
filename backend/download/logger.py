import sys
import time
from datetime import datetime

def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def log_info(module: str, message: str) -> None:
    print(f"[INFO] [{_timestamp()}] [{module}] {message}", flush=True)

def log_warning(module: str, message: str) -> None:
    print(f"[WARN] [{_timestamp()}] [{module}] {message}", file=sys.stderr, flush=True)

def log_error(module: str, message: str) -> None:
    print(f"[ERROR] [{_timestamp()}] [{module}] {message}", file=sys.stderr, flush=True)

def log_http(status: int, latency_ms: float, client_ip: str, method: str, path: str, query: str = "") -> None:
    q_str = f"?{query}" if query else ""
    print(f"[HTTP] {_timestamp()} | {status} | {latency_ms:.2f}ms | {client_ip} | {method} {path}{q_str}", flush=True)
