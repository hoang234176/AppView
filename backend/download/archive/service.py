"""MediaFire orchestration without filesystem access.

MediaFire resolution stays in Python. From the resolved direct URL onward Go
owns download, extraction, cleanup, scanning and conversion.
"""

import asyncio
from typing import Optional

from archive.contracts import DownloadResolver
from archive.go_archive_client import (
    GoArchiveJobMissingError,
    GoStorageUnavailableError,
    go_archive_client,
)
from archive.mediafire import MediaFireResolver
from logger import log_error, log_info, log_warning
from models.download_task import TaskStage
from services.task_manager import task_manager


class ArchiveService:
    def __init__(self, resolver: Optional[DownloadResolver] = None):
        self.resolver: DownloadResolver = resolver or MediaFireResolver()

    async def process_task(self, task_id: str):
        task = await task_manager.get_task(task_id)
        if not task:
            return
        try:
            await task_manager.update_stage(task_id, TaskStage.RESOLVING)
            resolved = await self.resolver.resolve(task.original_url)
            await task_manager.update_stage(task_id, TaskStage.DOWNLOADING, filename=resolved.filename)
            await go_archive_client.start(
                task_id=task_id,
                url=resolved.download_url,
                filename=resolved.filename,
                destination=task.destination,
                password=task.password,
            )
            await go_archive_client.monitor(task_id, self._apply_go_update)
        except asyncio.CancelledError:
            if task_manager.service_stopping:
                # Uvicorn --reload hủy coroutine cũ khi nạp code mới. Go là
                # owner của process/file nên không hủy job trong trường hợp này.
                log_info("DOWNLOAD SERVICE", f"Python đang restart; giữ Go archive job [{task_id}] tiếp tục chạy.")
            else:
                await go_archive_client.cancel(task_id)
                await task_manager.update_stage(task_id, TaskStage.CANCELLED)
        except ValueError as error:
            await task_manager.update_stage(task_id, TaskStage.ERROR, error=str(error), error_code="INVALID_REQUEST")
        except GoArchiveJobMissingError as error:
            log_error("DOWNLOAD SERVICE", f"Go mất trạng thái task [{task_id}]: {error}")
            await self._mark_go_interruption(task_id, "GO_ARCHIVE_JOB_MISSING")
        except GoStorageUnavailableError as error:
            log_error("DOWNLOAD SERVICE", f"Go bị dừng khi xử lý task [{task_id}]: {error}")
            await self._mark_go_interruption(task_id, "GO_STORAGE_UNAVAILABLE")
        except Exception as error:
            log_error("DOWNLOAD SERVICE", f"Không thể điều phối Go archive job [{task_id}]: {error}")
            await task_manager.update_stage(task_id, TaskStage.ERROR, error=str(error), error_code="ARCHIVE_JOB_UNAVAILABLE")

    async def restore_jobs_from_go(self) -> None:
        """Nối lại Python WebSocket orchestration sau hot-reload/restart.

        Go tiếp tục tải/giải nén/convert độc lập. Python chỉ dựng lại model và
        gắn lại polling cho job đang chạy, tuyệt đối không mở đường dẫn/file.
        """
        try:
            jobs = await go_archive_client.list_jobs()
        except Exception as error:
            log_warning("DOWNLOAD SERVICE", f"Chưa thể khôi phục archive job từ Go: {error}")
            return
        active_stages = {
            TaskStage.QUEUED.value, TaskStage.RESOLVING.value, TaskStage.DOWNLOADING.value,
            TaskStage.WAITING_EXTRACT.value, TaskStage.EXTRACTING.value,
            TaskStage.SCANNING.value, TaskStage.CONVERTING.value,
        }
        for job in jobs:
            task = await task_manager.restore_task_from_go_snapshot(job)
            if task and task.stage.value in active_stages:
                monitor = asyncio.create_task(go_archive_client.monitor(task.task_id, self._apply_go_update))
                task_manager.register_async_task(task.task_id, monitor)
        if jobs:
            log_info("DOWNLOAD SERVICE", f"Đã đồng bộ {len(jobs)} archive job từ Go sau khi Python khởi động lại.")

    async def retry_task(self, task_id: str):
        await self.process_task(task_id)

    async def _mark_go_interruption(self, task_id: str, error_code: str) -> None:
        """Keep the task visible and describe what Go could have left behind.

        The same archive-status polling loop covers downloading, extracting,
        scanning and converting. A killed Go process therefore lands here no
        matter which stage it was in; only the recovery guidance differs.
        """
        task = await task_manager.get_task(task_id)
        stage = task.stage if task else None
        recovery_message = {
            TaskStage.DOWNLOADING: (
                "Go storage backend đã dừng khi đang tải. File tải tạm (.part) vẫn được giữ; "
                "khởi động lại Go rồi bấm tải tiếp."
            ),
            TaskStage.WAITING_EXTRACT: (
                "Go storage backend đã dừng trước khi giải nén. File nén vẫn được giữ; "
                "khởi động lại Go rồi bấm tải tiếp."
            ),
            TaskStage.EXTRACTING: (
                "Go storage backend đã dừng khi đang giải nén. File nén và dữ liệu giải nén tạm vẫn được giữ; "
                "khởi động lại Go rồi bấm tải tiếp."
            ),
            TaskStage.SCANNING: (
                "Go storage backend đã dừng khi đang kiểm tra thư mục. Dữ liệu đã giải nén vẫn được giữ; "
                "khởi động lại Go rồi bấm tải tiếp."
            ),
            TaskStage.CONVERTING: (
                "Go storage backend đã dừng khi đang tối ưu video. Video gốc và thư mục .convert-video vẫn được giữ; "
                "khởi động lại Go rồi bấm tải tiếp."
            ),
        }.get(
            stage,
            "Go storage backend đã dừng hoặc khởi động lại. Dữ liệu tạm vẫn được giữ; "
            "khởi động lại Go rồi bấm tải tiếp.",
        )
        await task_manager.update_stage(
            task_id,
            TaskStage.ERROR,
            error=recovery_message,
            error_code=error_code,
        )

    async def retry_extraction(self, task_id: str, password: str):
        task = await task_manager.get_task(task_id)
        if not task:
            raise ValueError("Không tìm thấy task")
        task.password = password
        await go_archive_client.retry_extraction(task_id, password)
        async_task = asyncio.create_task(go_archive_client.monitor(task_id, self._apply_go_update))
        task_manager.register_async_task(task_id, async_task)

    async def _apply_go_update(self, job: dict) -> None:
        task_id = job.get("id", "")
        try:
            stage = TaskStage(job.get("state", "error"))
        except ValueError:
            stage = TaskStage.ERROR
        task = await task_manager.get_task(task_id)
        if not task:
            return

        if stage == TaskStage.DOWNLOADING:
            total = int(job.get("total_bytes", 0))
            downloaded = int(job.get("downloaded_bytes", 0))
            await task_manager.update_download_progress(
                task_id, downloaded, total or None,
                downloaded / total * 100 if total else None,
                int(job.get("speed_bytes", 0)),
            )
        elif stage == TaskStage.EXTRACTING:
            if task.stage != stage:
                await task_manager.update_stage(task_id, stage)
        elif stage == TaskStage.SCANNING:
            if task.stage != stage:
                await task_manager.update_stage(task_id, stage)
        elif stage == TaskStage.CONVERTING:
            conversion = job.get("conversion", {})
            if task.stage != stage:
                await task_manager.update_stage(task_id, stage)
            current = int(conversion.get("current", 0))
            total = int(conversion.get("total", 0))
            if task.convert_current != current or task.convert_total != total:
                await task_manager.update_convert_progress(task_id, current, total)
        elif stage == TaskStage.PASSWORD_REQUIRED:
            await task_manager.set_password_required(task_id, job.get("error") or "Tệp nén yêu cầu mật khẩu.")
        elif stage == TaskStage.ERROR:
            await task_manager.update_stage(task_id, stage, error=job.get("error") or "Go archive job thất bại.", error_code=job.get("error_code") or "ARCHIVE_JOB_FAILED")
        elif stage in (TaskStage.COMPLETED, TaskStage.CANCELLED) and task.stage != stage:
            await task_manager.update_stage(task_id, stage)


archive_service = ArchiveService()
