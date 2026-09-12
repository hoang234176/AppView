"""Outbound, reconnecting Coordinator WebSocket client for Python Download."""

from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import suppress
from typing import Any, Optional

import websockets

from config import Config
from logger import log_error, log_event, log_info, log_warning
from worker.handler import DownloadWorkerHandler
from worker.protocol import (
    COOKIE_GET,
    COOKIE_VERIFY,
    ERROR,
    RESOLVE_DOWNLOAD,
    TASK_ASSIGN,
    TASK_CANCEL,
    TASK_FAILED,
    WORKER_HEARTBEAT,
    WORKER_REGISTER,
    WORKER_REGISTERED,
    message,
)


class CoordinatorWorkerClient:
    """Keep a single outbound worker session alive without blocking FastAPI."""

    def __init__(
        self,
        *,
        url: str = Config.COORDINATOR_WS_URL,
        worker_id: str = Config.COORDINATOR_WORKER_ID,
        handler: Optional[DownloadWorkerHandler] = None,
        heartbeat_interval: float = 10.0,
        reconnect_initial_delay: float = 1.0,
        reconnect_max_delay: float = 15.0,
    ) -> None:
        self._url = url
        self._worker_id = worker_id
        self._handler = handler or DownloadWorkerHandler()
        self._heartbeat_interval = heartbeat_interval
        self._reconnect_initial_delay = reconnect_initial_delay
        self._reconnect_max_delay = reconnect_max_delay
        self._stop_event = asyncio.Event()
        self._run_task: Optional[asyncio.Task[None]] = None
        self._websocket: Any = None
        self._send_lock = asyncio.Lock()
        self._assignment_tasks: set[asyncio.Task[None]] = set()
        self._assignments_by_id: dict[str, asyncio.Task[None]] = {}
        self._pending_rpc: dict[str, asyncio.Future[dict[str, Any]]] = {}

    def start(self) -> None:
        """Start in the background; coordinator failure cannot stop HTTP API."""
        if self._run_task is None or self._run_task.done():
            self._stop_event.clear()
            self._run_task = asyncio.create_task(self._run(), name="coordinator-download-worker")
            log_event("INFO", "coordinator worker starting", "COORDINATOR WORKER", workerId=self._worker_id)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._websocket is not None:
            with suppress(Exception):
                await self._websocket.close()
        if self._run_task is not None:
            self._run_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._run_task
        self._run_task = None
        await self._cancel_assignments()

    async def _run(self) -> None:
        delay = self._reconnect_initial_delay
        while not self._stop_event.is_set():
            try:
                await self._connect_once()
                if self._stop_event.is_set():
                    break
                # A clean socket close is still an unexpected loss of the
                # worker session. Delay it too, otherwise a coordinator
                # restart would create a tight reconnect loop.
                log_warning(
                    "COORDINATOR WORKER",
                    f"Mất kết nối coordinator; thử lại sau {delay:.0f}s.",
                )
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    delay = min(delay * 2, self._reconnect_max_delay)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                if not self._stop_event.is_set():
                    log_warning(
                        "COORDINATOR WORKER",
                        f"Không thể kết nối coordinator ({error}); thử lại sau {delay:.0f}s.",
                    )
                    try:
                        await asyncio.wait_for(self._stop_event.wait(), timeout=delay)
                    except asyncio.TimeoutError:
                        delay = min(delay * 2, self._reconnect_max_delay)

    async def _connect_once(self) -> None:
        async with websockets.connect(
            self._url,
            open_timeout=10,
            close_timeout=3,
            ping_interval=20,
            ping_timeout=10,
        ) as websocket:
            self._websocket = websocket
            await self.send(
                message(
                    WORKER_REGISTER,
                    workerId=self._worker_id,
                    capabilities=[RESOLVE_DOWNLOAD],
                )
            )

            raw = await asyncio.wait_for(websocket.recv(), timeout=10)
            registered = self._decode(raw)
            if registered.get("type") == ERROR:
                error = registered.get("error") or {}
                raise ConnectionError(error.get("message", "Coordinator từ chối đăng ký worker."))
            if registered.get("type") != WORKER_REGISTERED or registered.get("workerId") != self._worker_id:
                raise ConnectionError("Coordinator trả acknowledgement đăng ký không hợp lệ.")

            log_info("COORDINATOR WORKER", f"Đã kết nối coordinator: {self._url} ({self._worker_id})")
            log_event("INFO", "coordinator worker registered", "COORDINATOR WORKER", workerId=self._worker_id, capability=RESOLVE_DOWNLOAD)
            heartbeat = asyncio.create_task(self._heartbeat_loop(), name="coordinator-download-heartbeat")
            try:
                async for raw in websocket:
                    envelope = self._decode(raw)
                    if envelope.get("type") == TASK_ASSIGN:
                        self._start_assignment(envelope)
                    elif envelope.get("type") == TASK_CANCEL:
                        # Let a just-created coroutine enter its cleanup
                        # wrapper before cancellation. Repeated controls must
                        # not interrupt the extractor's cancellation cleanup.
                        asyncio.get_running_loop().call_soon(self._cancel_assignment, envelope.get("taskId"))
                    elif envelope.get("type") == COOKIE_VERIFY:
                        asyncio.create_task(self._handle_cookie_verify(envelope))
                    elif envelope.get("type") == COOKIE_GET:
                        task_id = envelope.get("taskId")
                        if task_id in self._pending_rpc:
                            future = self._pending_rpc.pop(task_id)
                            if not future.done():
                                future.set_result(envelope.get("result") or {})
                    elif envelope.get("type") == ERROR:
                        error = envelope.get("error") or {}
                        log_warning("COORDINATOR WORKER", f"Coordinator báo lỗi: {error.get('message', 'unknown')}")
            finally:
                heartbeat.cancel()
                with suppress(asyncio.CancelledError):
                    await heartbeat
                self._websocket = None
                await self._cancel_assignments()

    def _start_assignment(self, envelope: dict[str, Any]) -> None:
        log_event("INFO", "coordinator assignment received", "COORDINATOR WORKER", workerId=self._worker_id, taskId=envelope.get("taskId"), action=envelope.get("action"))
        task_id = envelope.get("taskId")
        assignment = asyncio.create_task(self._run_assignment(envelope))
        self._assignments_by_id[task_id] = assignment
        assignment.add_done_callback(lambda done: self._assignments_by_id.pop(task_id, None))
        self._assignment_tasks.add(assignment)
        assignment.add_done_callback(self._assignment_done)

    async def _run_assignment(self, envelope: dict[str, Any]) -> None:
        try:
            await self._handler.handle(envelope, self.send)
        except asyncio.CancelledError:
            # The extractor has finished its cancellation cleanup before we
            # acknowledge, so Coordinator cannot reuse this worker too early.
            if self._websocket is not None:
                with suppress(Exception):
                    await self.send(message(TASK_FAILED, taskId=envelope.get("taskId"),
                                            error={"code": "CANCELLED", "message": "Đã hủy phân tích liên kết."}))
            raise

    def _cancel_assignment(self, task_id: str) -> None:
        assignment = self._assignments_by_id.get(task_id)
        if assignment is not None and not assignment.done() and not assignment.cancelling():
            assignment.cancel()

    def _assignment_done(self, assignment: asyncio.Task[None]) -> None:
        self._assignment_tasks.discard(assignment)
        if assignment.cancelled():
            return
        error = assignment.exception()
        if error:
            log_error("COORDINATOR WORKER", f"Task handler gặp lỗi không mong muốn: {error}")

    async def _cancel_assignments(self) -> None:
        assignments = tuple(self._assignment_tasks)
        for assignment in assignments:
            if not assignment.cancelling():
                assignment.cancel()
        if assignments:
            await asyncio.gather(*assignments, return_exceptions=True)
        self._assignment_tasks.clear()

    async def _heartbeat_loop(self) -> None:
        while not self._stop_event.is_set() and self._websocket is not None:
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._heartbeat_interval)
                return
            except asyncio.TimeoutError:
                await self.send(message(WORKER_HEARTBEAT, workerId=self._worker_id))

    async def send(self, envelope: dict[str, Any]) -> None:
        websocket = self._websocket
        if websocket is None:
            raise ConnectionError("Coordinator worker chưa kết nối.")
        async with self._send_lock:
            await websocket.send(json.dumps(envelope, ensure_ascii=False))

    async def _handle_cookie_verify(self, envelope: dict[str, Any]) -> None:
        task_id = envelope.get("taskId")
        payload = envelope.get("payload") or {}
        platform = payload.get("platform")
        raw_cookies = payload.get("cookies") or ""

        valid, message_str = False, "Nền tảng không được hỗ trợ."
        if platform == "youtube":
            from services.youtube.auth import verify_youtube_cookies
            valid, message_str = await verify_youtube_cookies(raw_cookies)
        elif platform == "tiktok":
            from services.tiktok.auth import verify_tiktok_cookies
            valid, message_str = await verify_tiktok_cookies(raw_cookies)
        elif platform == "facebook":
            from services.facebook.auth import verify_facebook_cookies
            valid, message_str = await verify_facebook_cookies(raw_cookies)

        level = "INFO" if valid else "WARN"
        log_event(level, "cookie verification completed", "COOKIE_VERIFY", platform=platform, valid=valid, detail=message_str)

        with suppress(Exception):
            await self.send(message(COOKIE_VERIFY, taskId=task_id, result={"valid": valid, "message": message_str}))

    async def get_cookies(self, platform: str = "youtube", timeout: float = 5.0) -> Optional[str]:
        if self._websocket is None:
            return None
        task_id = f"cookie-get-{uuid.uuid4().hex[:12]}"
        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending_rpc[task_id] = future
        try:
            await self.send(message(COOKIE_GET, taskId=task_id, payload={"platform": platform}))
            result = await asyncio.wait_for(future, timeout=timeout)
            if result.get("exists") and isinstance(result.get("cookies"), str):
                return result.get("cookies")
            return None
        except Exception:
            return None
        finally:
            self._pending_rpc.pop(task_id, None)

    @staticmethod
    def _decode(raw: str | bytes) -> dict[str, Any]:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        decoded = json.loads(raw)
        if not isinstance(decoded, dict):
            raise ValueError("Coordinator gửi protocol envelope không hợp lệ.")
        return decoded


coordinator_worker_client = CoordinatorWorkerClient()
