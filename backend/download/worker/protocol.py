"""Small Python helpers for the Coordinator worker protocol.

The Go coordinator's ``docs/PROTOCOL.md`` remains the source of truth. These
constants deliberately mirror it without introducing a Download-specific
protocol.
"""

from __future__ import annotations

from typing import Any


WORKER_REGISTER = "worker.register"
WORKER_REGISTERED = "worker.registered"
WORKER_HEARTBEAT = "worker.heartbeat"
TASK_ASSIGN = "task.assign"
TASK_CANCEL = "task.cancel"
TASK_ACCEPTED = "task.accepted"
TASK_COMPLETED = "task.completed"
TASK_FAILED = "task.failed"
ERROR = "error"

RESOLVE_DOWNLOAD = "resolve_download"


def message(message_type: str, **fields: Any) -> dict[str, Any]:
    """Build one shared-protocol envelope and omit unset optional fields."""
    return {"type": message_type, **{key: value for key, value in fields.items() if value is not None}}
