import os
import socket
from pathlib import Path


# Preserve these before loading .env so an OS/Render PORT cannot be shadowed
# by a developer's local service-specific port value.
_PROCESS_DOWNLOAD_PORT = os.getenv("PYTHON_DOWNLOAD_PORT")
_PROCESS_PLATFORM_PORT = os.getenv("PORT")


def _load_local_env() -> None:
    """Load this service's optional .env without overriding OS/Render values."""
    candidates = [
        Path(__file__).resolve().with_name(".env"),
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for env_path in candidates:
        if not env_path.is_file():
            continue
        try:
            lines = env_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue

        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = (part.strip() for part in line.split("=", 1))
            if key and key not in os.environ:
                os.environ[key] = value.strip("\"'")


_load_local_env()

class Config:
    GO_STORAGE_BASE_URL: str = os.getenv("GO_STORAGE_BASE_URL", "http://localhost:8080").rstrip("/")
    # Render supplies PORT. A service-specific value remains higher priority
    # for local multi-service development.
    PORT: int = int(
        _PROCESS_DOWNLOAD_PORT
        or _PROCESS_PLATFORM_PORT
        or os.getenv("PYTHON_DOWNLOAD_PORT")
        or os.getenv("PORT")
        or "5002"
    )
    HOST: str = os.getenv("PYTHON_DOWNLOAD_HOST", "0.0.0.0")

    RESOLVE_TIMEOUT: float = 20.0

    # The coordinator interface is additive: failure to reach it must never
    # prevent the existing HTTP Download API from serving clients.
    COORDINATOR_WS_URL: str = os.getenv(
        "DOWNLOAD_COORDINATOR_WS_URL",
        os.getenv("COORDINATOR_WS_URL", "ws://localhost:8090/ws/workers"),
    )
    COORDINATOR_WORKER_ID: str = os.getenv(
        "DOWNLOAD_COORDINATOR_WORKER_ID",
        os.getenv("COORDINATOR_WORKER_ID", f"download-{socket.gethostname()}"),
    )
    TEST_X_URL: str = os.getenv(
        "TEST_X_URL",
        "https://x.com/Tiny_Asa/status/2098004129251725632?s=20",
    )
