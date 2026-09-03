"""Maps coordinator assignments to existing Download business logic."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Optional

from archive.contracts import DownloadResolver, ResolvedDownload
from archive.service import archive_service
from logger import log_error, log_event, log_warning
from worker.protocol import (
    RESOLVE_DOWNLOAD,
    TASK_ACCEPTED,
    TASK_COMPLETED,
    TASK_FAILED,
    TASK_ASSIGN,
    message,
)

SendMessage = Callable[[dict[str, Any]], Awaitable[None]]


class DownloadWorkerHandler:
    """Validate coordinator tasks and delegate URL resolution to the resolver.

    This adapter intentionally has no access to task-manager or Go archive
    orchestration. A ``resolve_download`` coordinator task is just URL
    resolution, so it can safely be retried by the coordinator.
    """

    def __init__(self, resolver: Optional[DownloadResolver] = None):
        self._resolver = resolver or archive_service.resolver

    async def handle(self, envelope: dict[str, Any], send: SendMessage) -> None:
        if envelope.get("type") != TASK_ASSIGN:
            return

        task_id = envelope.get("taskId")
        if not isinstance(task_id, str) or not task_id.strip():
            # A failure cannot be correlated without taskId. Keep the worker
            # connection healthy and let the coordinator retain its task state.
            log_warning("COORDINATOR WORKER", "Bỏ qua task.assign thiếu taskId.")
            return

        action = envelope.get("action")
        if action != RESOLVE_DOWNLOAD:
            await self._fail(send, task_id, "UNSUPPORTED_ACTION", "Worker không hỗ trợ action được giao.")
            return

        log_event("INFO", "resolve assignment received", "COORDINATOR WORKER", taskId=task_id, action=action)

        payload = envelope.get("payload")
        url = payload.get("url") if isinstance(payload, dict) else None
        if not isinstance(url, str) or not url.strip():
            await self._fail(send, task_id, "INVALID_PAYLOAD", "payload.url phải là URL không rỗng.")
            return

        await send(message(TASK_ACCEPTED, taskId=task_id))
        log_event("INFO", "resolve task accepted", "COORDINATOR WORKER", taskId=task_id)
        try:
            log_event("INFO", "resolver started", "COORDINATOR WORKER", taskId=task_id)
            resolved = await self._resolver.resolve(url.strip())
        except Exception as error:
            # Provider errors are logged locally. The coordinator gets a
            # useful but non-sensitive response without a traceback/URL.
            log_error("COORDINATOR WORKER", f"Không thể resolve task [{task_id}]: {error}")
            await self._fail(send, task_id, "RESOLVE_FAILED", "Không thể phân tích liên kết tải.")
            return

        await send(message(TASK_COMPLETED, taskId=task_id, result=self._result(resolved)))
        log_event("INFO", "resolver completed", "COORDINATOR WORKER", taskId=task_id, filename=resolved.filename)

    @staticmethod
    def _result(resolved: ResolvedDownload) -> dict[str, Any]:
        return {
            "originalUrl": resolved.original_url,
            "downloadUrl": resolved.download_url,
            "filename": resolved.filename,
            "extension": resolved.extension,
            "estimatedSize": resolved.estimated_size,
        }

    @staticmethod
    async def _fail(send: SendMessage, task_id: str, code: str, description: str) -> None:
        log_event("ERROR", "resolve task failed", "COORDINATOR WORKER", taskId=task_id, errorCode=code)
        await send(message(TASK_FAILED, taskId=task_id, error={"code": code, "message": description}))
