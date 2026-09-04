"""HTTP boundary for the Go-owned archive filesystem job.

This module deliberately accepts only a relative destination. It never builds,
opens or inspects a storage path in Python.
"""

import asyncio
from typing import Awaitable, Callable, Optional

import httpx

from config import Config
from logger import log_error


JobCallback = Callable[[dict], Awaitable[None]]


class GoStorageUnavailableError(RuntimeError):
    """Go đã dừng hoặc không còn phản hồi; file .part vẫn nằm bên Go."""


class GoArchiveJobMissingError(RuntimeError):
    """Go đã khởi động lại nên không còn trạng thái job trong bộ nhớ."""


class GoArchiveClient:
    def __init__(self, base_url: str = Config.GO_STORAGE_BASE_URL):
        self.base_url = base_url

    async def start(self, *, task_id: str, url: str, filename: str, destination: str, password: Optional[str]) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self.base_url}/api/v1/jobs/archive", json={
                "task_id": task_id, "url": url, "filename": filename,
                "destination": destination, "password": password or "",
            })
        if response.status_code not in (200, 202):
            raise RuntimeError(f"Go archive job trả HTTP {response.status_code}")

    async def retry_extraction(self, task_id: str, password: str) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self.base_url}/api/v1/jobs/archive/{task_id}/extract", json={"password": password})
        if response.status_code not in (200, 202):
            raise RuntimeError(f"Go không thể giải nén lại (HTTP {response.status_code})")

    async def retry(self, task_id: str, password: Optional[str] = None) -> None:
        """Resume the furthest durable Storage stage without re-resolving URL.

        Storage owns the local workspace and decides whether that means a
        ranged download continuation, extraction, video scan, or conversion.
        The password is sent for this one request only.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/jobs/archive/{task_id}/retry",
                json={"password": password or ""},
            )
        if response.status_code not in (200, 202):
            raise RuntimeError(f"Go không thể tải tiếp (HTTP {response.status_code})")

    async def cancel(self, task_id: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{self.base_url}/api/v1/jobs/archive/{task_id}/cancel")

    async def delete(self, task_id: str) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(f"{self.base_url}/api/v1/jobs/archive/{task_id}")

    async def list_jobs(self) -> list[dict]:
        """Đọc snapshot Go để Python khôi phục sau khi hot-reload/restart."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/api/v1/jobs/archive")
        if response.status_code != 200:
            raise RuntimeError(f"Go không thể trả danh sách archive job (HTTP {response.status_code})")
        jobs = response.json().get("jobs", [])
        return jobs if isinstance(jobs, list) else []

    async def monitor(self, task_id: str, on_update: JobCallback) -> None:
        """Poll Go once a second and surface a Go process crash to Python.

        Go cannot notify anybody after it is killed. Python owns the visible
        task state, so two failed health polls turn the existing task red while
        deliberately leaving Go's .part file untouched for a later retry.
        """
        failures = 0
        timeout = httpx.Timeout(timeout=4.0, connect=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            while True:
                try:
                    response = await client.get(f"{self.base_url}/api/v1/jobs/archive/{task_id}")
                except httpx.HTTPError as error:
                    failures += 1
                    if failures >= 2:
                        log_error("DOWNLOAD SERVICE", f"Go storage không phản hồi cho task [{task_id}]: {error}")
                        raise GoStorageUnavailableError(
                            "Go storage backend đã dừng hoặc bị ngắt. File tải tạm vẫn được giữ; "
                            "khởi động lại Go rồi bấm tải tiếp."
                        ) from error
                    await asyncio.sleep(1.0)
                    continue

                if response.status_code == 404:
                    raise GoArchiveJobMissingError(
                        "Go storage backend đã khởi động lại và không còn trạng thái job. "
                        "File tải tạm vẫn được giữ; bấm tải tiếp để nối lại."
                    )
                if response.status_code != 200:
                    raise GoStorageUnavailableError(
                        f"Go storage backend không phản hồi bình thường (HTTP {response.status_code}). "
                        "File tải tạm vẫn được giữ; bấm tải tiếp sau khi Go hoạt động lại."
                    )
                
                failures = 0
                job = response.json().get("job", {})
                await on_update(job)
                if job.get("state") in {"completed", "cancelled", "error", "password_required"}:
                    return
                # Một lần/giây đủ mượt cho tốc độ tải và tránh làm terminal
                # Go đầy các dòng GET trạng thái.
                await asyncio.sleep(1.0)
go_archive_client = GoArchiveClient()
