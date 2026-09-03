"""Outbound, reconnecting Coordinator WebSocket client for Python Download."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import Any, Optional

import websockets

from config import Config
from logger import log_error, log_info, log_warning
from worker.handler import DownloadWorkerHandler
from worker.protocol import (
    ERROR,
    RESOLVE_DOWNLOAD,
    TASK_ASSIGN,
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

    def start(self) -> None:
        """Start in the background; coordinator failure cannot stop HTTP API."""
        if self._run_task is None or self._run_task.done():
            self._stop_event.clear()
            self._run_task = asyncio.create_task(self._run(), name="coordinator-download-worker")

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
            heartbeat = asyncio.create_task(self._heartbeat_loop(), name="coordinator-download-heartbeat")
            try:
                async for raw in websocket:
                    envelope = self._decode(raw)
                    if envelope.get("type") == TASK_ASSIGN:
                        self._start_assignment(envelope)
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
        assignment = asyncio.create_task(self._handler.handle(envelope, self.send))
        self._assignment_tasks.add(assignment)
        assignment.add_done_callback(self._assignment_done)

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

    @staticmethod
    def _decode(raw: str | bytes) -> dict[str, Any]:
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        decoded = json.loads(raw)
        if not isinstance(decoded, dict):
            raise ValueError("Coordinator gửi protocol envelope không hợp lệ.")
        return decoded


coordinator_worker_client = CoordinatorWorkerClient()
