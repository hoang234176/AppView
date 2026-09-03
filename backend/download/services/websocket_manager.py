import asyncio
from typing import Set, Dict, Any
from fastapi import WebSocket
from logger import log_info, log_error

class WebSocketManager:
    def __init__(self):
        self._active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._active_connections.add(websocket)
        log_info("WEBSOCKET", f"Client kết nối mới. Tổng số kết nối: {len(self._active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self._active_connections.discard(websocket)
        log_info("WEBSOCKET", f"Client ngắt kết nối. Còn lại: {len(self._active_connections)}")

    async def broadcast(self, event: Dict[str, Any]):
        async with self._lock:
            connections = list(self._active_connections)

        if not connections:
            return

        # Make sure sensitive passwords are never sent in broadcast
        clean_event = self._sanitize_event(event)

        disconnected = set()
        for ws in connections:
            try:
                await ws.send_json(clean_event)
            except Exception as e:
                disconnected.add(ws)

        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self._active_connections.discard(ws)

    def _sanitize_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        event_copy = dict(event)
        if "password" in event_copy:
            del event_copy["password"]
        if "task" in event_copy and isinstance(event_copy["task"], dict):
            task_copy = dict(event_copy["task"])
            task_copy.pop("password", None)
            event_copy["task"] = task_copy
        return event_copy

websocket_manager = WebSocketManager()
