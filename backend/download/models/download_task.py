from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class TaskStage(str, Enum):
    QUEUED = "queued"
    RESOLVING = "resolving"
    DOWNLOADING = "downloading"
    WAITING_EXTRACT = "waiting_extract"
    EXTRACTING = "extracting"
    SCANNING = "scanning"
    CONVERTING = "converting"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ERROR = "error"
    PASSWORD_REQUIRED = "password_required"

class DownloadTask(BaseModel):
    task_id: str
    original_url: str
    resolved_url: Optional[str] = None
    filename: Optional[str] = None
    destination: str
    stage: TaskStage = TaskStage.QUEUED
    downloaded_bytes: int = 0
    download_total_bytes: Optional[int] = None
    download_percent: Optional[float] = None
    download_speed_bytes: Optional[int] = 0
    extracted_percent: Optional[float] = None
    convert_total: int = 0
    convert_current: int = 0
    # Giữ lại công đoạn ngay trước lúc hủy để giao diện phân biệt việc hủy
    # tải/giải nén với việc đã giải nén xong nhưng hủy tối ưu video.
    cancelled_from_stage: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    password_required: bool = False
    password: Optional[str] = None

class ArchiveDownloadRequest(BaseModel):
    url: str
    destination: str = ""
    password: Optional[str] = None

class TaskPasswordRequest(BaseModel):
    password: str

class APIErrorDetail(BaseModel):
    code: str
    message: str

class APIErrorResponse(BaseModel):
    error: APIErrorDetail

class SummaryResponse(BaseModel):
    active_count: int
    downloading_count: int
    extracting_count: int
    download: dict
    extract: dict
