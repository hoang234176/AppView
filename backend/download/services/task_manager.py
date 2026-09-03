import asyncio
import time
import uuid
from typing import Dict, List, Optional
from datetime import datetime

from logger import log_info, log_warning, log_error
from models.download_task import DownloadTask, TaskStage
from services.websocket_manager import websocket_manager
from services.progress_manager import ProgressManager

class TaskManager:
    def __init__(self):
        self._tasks: Dict[str, DownloadTask] = {}
        self._async_tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        
        # Log throttling trackers
        self._last_logged_percent: Dict[str, float] = {}
        self._last_logged_time: Dict[str, float] = {}
        self._service_stopping = False

    def set_service_stopping(self, stopping: bool) -> None:
        """Phân biệt hot-reload của Python với thao tác Hủy từ người dùng."""
        self._service_stopping = stopping

    @property
    def service_stopping(self) -> bool:
        return self._service_stopping

    def save_tasks_to_disk(self):
        # Task state is orchestration state only. Storage files belong to Go.
        return None

    def load_tasks_from_disk(self):
        # Python intentionally has no storage-directory access. A future Go
        # task-list endpoint can restore jobs after service restart.
        return None

    def scan_and_restore_temp_files(self):
        return None

    async def create_task(self, url: str, destination: str, password: Optional[str] = None) -> DownloadTask:
        task_id = str(uuid.uuid4())
        task = DownloadTask(
            task_id=task_id,
            original_url=url,
            destination=destination,
            password=password,
            stage=TaskStage.QUEUED
        )
        async with self._lock:
            self._tasks[task_id] = task
            self.save_tasks_to_disk()

        log_info("DOWNLOAD SERVICE", f"Đã tạo task mới [{task_id}] cho URL: {url}")
        
        await websocket_manager.broadcast({
            "type": "task_created",
            "task_id": task_id,
            "task": task.model_dump()
        })
        await self._broadcast_summary()
        return task

    def register_async_task(self, task_id: str, async_task: asyncio.Task):
        self._async_tasks[task_id] = async_task

    def unregister_async_task(self, task_id: str):
        self._async_tasks.pop(task_id, None)

    async def get_task(self, task_id: str) -> Optional[DownloadTask]:
        async with self._lock:
            return self._tasks.get(task_id)

    async def list_tasks(self) -> List[DownloadTask]:
        async with self._lock:
            return list(self._tasks.values())

    async def restore_task_from_go_snapshot(self, job: dict) -> Optional[DownloadTask]:
        """Khôi phục task điều phối sau Python restart; Go vẫn sở hữu file/job."""
        task_id = str(job.get("id") or "")
        if not task_id:
            return None
        try:
            stage = TaskStage(job.get("state", TaskStage.ERROR.value))
        except ValueError:
            stage = TaskStage.ERROR
        conversion = job.get("conversion") or {}
        total = int(job.get("total_bytes") or 0)
        downloaded = int(job.get("downloaded_bytes") or 0)
        task = DownloadTask(
            task_id=task_id,
            original_url=str(job.get("url") or "go://archive-job/" + task_id),
            filename=job.get("filename") or None,
            destination=str(job.get("destination") or ""),
            stage=stage,
            downloaded_bytes=downloaded,
            download_total_bytes=total or None,
            download_percent=(downloaded / total * 100) if total else None,
            download_speed_bytes=int(job.get("speed_bytes") or 0),
            extracted_percent=job.get("extracted_percent"),
            convert_total=int(conversion.get("total") or 0),
            convert_current=int(conversion.get("current") or 0),
            error=job.get("error") or None,
            error_code=job.get("error_code") or None,
            password_required=bool(job.get("password_required")),
        )
        async with self._lock:
            self._tasks[task_id] = task
        log_info("DOWNLOAD SERVICE", f"Đã khôi phục task [{task_id}] từ Go ({stage.value})")
        return task

    async def update_stage(self, task_id: str, stage: TaskStage, filename: Optional[str] = None, error: Optional[str] = None, error_code: Optional[str] = None):
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            previous_stage = task.stage
            if stage == TaskStage.CANCELLED and previous_stage != TaskStage.CANCELLED:
                task.cancelled_from_stage = previous_stage.value
            elif stage != TaskStage.CANCELLED:
                # Một task được thử lại là một vòng xử lý mới, không giữ lý do
                # hủy của lần trước.
                task.cancelled_from_stage = None
            if stage != TaskStage.PASSWORD_REQUIRED:
                # Mật khẩu đúng có thể được gửi từ Web nhưng Mobile vẫn giữ
                # snapshot cũ. Xóa cờ tại nguồn ngay khi Go sang bước kế tiếp.
                task.password_required = False
                if task.error_code == "PASSWORD_REQUIRED":
                    task.error = None
                    task.error_code = None
            task.stage = stage
            if filename:
                task.filename = filename
            if error:
                task.error = error
            if error_code:
                task.error_code = error_code
            if stage == TaskStage.DOWNLOADING and not task.started_at:
                task.started_at = datetime.now().isoformat()
            elif stage in (TaskStage.COMPLETED, TaskStage.CANCELLED, TaskStage.ERROR):
                task.completed_at = datetime.now().isoformat()
            
            self.save_tasks_to_disk()

        log_info("DOWNLOAD SERVICE", f"Task [{task_id}] chuyển trạng thái -> {stage.value}")

        await websocket_manager.broadcast({
            "type": "task_stage_changed",
            "task_id": task_id,
            "stage": stage.value,
            "filename": task.filename,
            "error": task.error,
            "error_code": task.error_code,
            "password_required": task.password_required,
            "cancelled_from_stage": task.cancelled_from_stage,
            "conversion": {
                "current": task.convert_current,
                "total": task.convert_total,
            },
        })
        await self._broadcast_summary()

    async def update_download_progress(
        self,
        task_id: str,
        downloaded_bytes: int,
        total_bytes: Optional[int],
        percent: Optional[float],
        speed_bytes: int = 0
    ):
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task.downloaded_bytes = downloaded_bytes
            task.download_total_bytes = total_bytes
            task.download_percent = percent
            task.download_speed_bytes = speed_bytes

        # Python là nơi duy nhất ghi tiến độ tải. Go chỉ giữ byte/speed thật và
        # trả snapshot; nhờ đó terminal Go không bị xen kẽ với HTTP polling.
        log_key = f"download_{task_id}"
        now = time.monotonic()
        last_percent = self._last_logged_percent.get(log_key)
        last_time = self._last_logged_time.get(log_key, 0.0)
        current_percent = percent if percent is not None else -1.0
        should_log = (
            last_percent is None
            or (current_percent >= 0 and current_percent >= last_percent + 5.0)
            or now - last_time >= 3.0
        )
        if should_log:
            total_text = f"{total_bytes / (1024 * 1024):.1f} MB" if total_bytes else "không rõ"
            percent_text = f"{current_percent:.0f}%" if current_percent >= 0 else "?%"
            log_info(
                "DOWNLOAD SERVICE",
                f"Task [{task_id}] Tải {downloaded_bytes / (1024 * 1024):.1f} MB / {total_text} "
                f"({percent_text}) | Tốc độ: {speed_bytes / (1024 * 1024):.2f} MB/s",
            )
            self._last_logged_percent[log_key] = current_percent
            self._last_logged_time[log_key] = now

        await websocket_manager.broadcast({
            "type": "task_progress",
            "task_id": task_id,
            "stage": TaskStage.DOWNLOADING.value,
            "filename": task.filename,
            "downloaded_bytes": downloaded_bytes,
            "total_bytes": total_bytes,
            "percent": percent,
            "speed_bytes": speed_bytes
        })
        await self._broadcast_summary()

    async def update_extract_progress(self, task_id: str, percent: float):
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task.extracted_percent = percent

        last_pct = self._last_logged_percent.get(f"ext_{task_id}", -10.0)
        if percent != last_pct:
            log_info("ARCHIVE SERVICE", f"Task [{task_id}] Giải nén tiến độ: {percent:.1f}%")
            self._last_logged_percent[f"ext_{task_id}"] = percent

        await websocket_manager.broadcast({
            "type": "task_progress",
            "task_id": task_id,
            "stage": TaskStage.EXTRACTING.value,
            "filename": task.filename,
            "extracted_percent": percent
        })
        await self._broadcast_summary()

    async def update_convert_progress(self, task_id: str, current: int, total: int):
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task.convert_current = current
            task.convert_total = total
            self.save_tasks_to_disk()

        await websocket_manager.broadcast({
            "type": "task_progress",
            "task_id": task_id,
            "stage": TaskStage.CONVERTING.value,
            "conversion": {
                "current": current,
                "total": total,
            },
        })
        await self._broadcast_summary()

    async def set_password_required(self, task_id: str, error_message: str = "Mật khẩu không chính xác."):
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task.stage = TaskStage.PASSWORD_REQUIRED
            task.password_required = True
            task.error = error_message
            task.error_code = "PASSWORD_REQUIRED"
            self.save_tasks_to_disk()

        log_warning("ARCHIVE SERVICE", f"Task [{task_id}] yêu cầu mật khẩu giải nén: {error_message}")

        await websocket_manager.broadcast({
            "type": "task_password_required",
            "task_id": task_id,
            "error": error_message,
            "error_code": "PASSWORD_REQUIRED"
        })
        await self._broadcast_summary()

    async def cancel_task(self, task_id: str) -> bool:
        async_task = self._async_tasks.get(task_id)
        if async_task and not async_task.done():
            async_task.cancel()

        await self.update_stage(task_id, TaskStage.CANCELLED)
        log_info("DOWNLOAD SERVICE", f"Đã hủy bỏ task [{task_id}]")
        return True

    async def delete_task(self, task_id: str) -> bool:
        async with self._lock:
            task = self._tasks.get(task_id)
            if task and task.stage in (TaskStage.QUEUED, TaskStage.RESOLVING, TaskStage.DOWNLOADING, TaskStage.WAITING_EXTRACT, TaskStage.EXTRACTING):
                # Cancel running task if actively executing
                async_task = self._async_tasks.get(task_id)
                if async_task and not async_task.done():
                    async_task.cancel()

            task = self._tasks.pop(task_id, None)
            self.save_tasks_to_disk()

        if task:
            try:
                from archive.go_archive_client import go_archive_client
                await go_archive_client.delete(task_id)
            except Exception as e:
                log_warning("DOWNLOAD SERVICE", f"Không thể yêu cầu Go dọn task [{task_id}]: {e}")

        log_info("DOWNLOAD SERVICE", f"Đã xóa hoàn toàn task [{task_id}] khỏi danh sách")
        await self._broadcast_summary()
        return True

    async def _broadcast_summary(self):
        tasks = list(self._tasks.values())
        summary = ProgressManager.calculate_summary(tasks)
        await websocket_manager.broadcast({
            "type": "summary_updated",
            "downloading": summary["download"],
            "extracting": summary["extract"],
            "active_count": summary["active_count"],
            "downloading_count": summary["downloading_count"],
            "extracting_count": summary["extracting_count"]
        })

task_manager = TaskManager()
