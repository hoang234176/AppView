import time
import asyncio
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import Config
from logger import log_event, log_info, log_http, log_error
from models.download_task import (
    ArchiveDownloadRequest,
    TaskPasswordRequest,
    DownloadTask,
    SummaryResponse,
    TaskStage
)
from services.task_manager import task_manager
from services.progress_manager import ProgressManager
from services.websocket_manager import websocket_manager
from archive.service import archive_service
from worker.client import coordinator_worker_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    log_info("DOWNLOAD SERVICE", "==================================================")
    log_info("DOWNLOAD SERVICE", f"AppView Python Download Microservice khởi chạy port: {Config.PORT}")
    log_info("DOWNLOAD SERVICE", "Storage filesystem is owned by the Go service.")
    task_manager.set_service_stopping(False)
    task_manager.load_tasks_from_disk()
    await archive_service.restore_jobs_from_go()
    coordinator_worker_client.start()
    log_event("INFO", "coordinator worker started", "DOWNLOAD SERVICE", workerId=Config.COORDINATOR_WORKER_ID)
    log_info("DOWNLOAD SERVICE", "==================================================")
    try:
        yield
    finally:
        # Không để coroutine monitor/process_task bị cancel vì reload gửi lệnh
        # hủy nhầm xuống Go. Process Python mới sẽ tự reconnect ngay sau đó.
        task_manager.set_service_stopping(True)
        await coordinator_worker_client.stop()
        log_event("INFO", "download service stopped", "DOWNLOAD SERVICE")

app = FastAPI(
    title="AppView Python Download Microservice",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP Request Logger Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    latency_ms = (time.time() - start_time) * 1000.0
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    log_http(
        status=response.status_code,
        latency_ms=latency_ms,
        client_ip=client_ip,
        method=request.method,
        path=request.url.path,
        query=request.url.query
    )
    return response

# Custom HTTP Exception Handler for structured errors (Section 27)
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    code = getattr(exc, "code", "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": exc.detail
            }
        }
    )

# -------------------------------------------------------------------
# REST API ENDPOINTS
# -------------------------------------------------------------------

@app.post("/api/v1/download/archive", status_code=status.HTTP_202_ACCEPTED)
async def create_archive_download(req: ArchiveDownloadRequest):
    if not req.url or not req.url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL không được để trống."
        )

    task = await task_manager.create_task(
        url=req.url.strip(),
        destination=req.destination.strip(),
        password=req.password
    )

    async_task = asyncio.create_task(archive_service.process_task(task.task_id))
    task_manager.register_async_task(task.task_id, async_task)

    return {
        "task_id": task.task_id,
        "status": task.stage.value
    }

@app.get("/api/v1/download/tasks", response_model=List[DownloadTask])
async def list_tasks():
    return await task_manager.list_tasks()

@app.get("/api/v1/download/tasks/{task_id}", response_model=DownloadTask)
async def get_task(task_id: str):
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy task yêu cầu."
        )
    return task

@app.post("/api/v1/download/tasks/{task_id}/retry")
async def retry_task(task_id: str):
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy task yêu cầu."
        )
    async_task = asyncio.create_task(archive_service.retry_task(task_id))
    task_manager.register_async_task(task_id, async_task)
    return {"message": "Đang thử giải nén lại tệp đã tải xuống."}

@app.post("/api/v1/download/tasks/{task_id}/password")
async def retry_task_password(task_id: str, req: TaskPasswordRequest):
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy task yêu cầu."
        )

    if task.stage != TaskStage.PASSWORD_REQUIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task không ở trạng thái yêu cầu mật khẩu."
        )

    try:
        await archive_service.retry_extraction(task_id, req.password)
        return {"message": "Đã nhận mật khẩu mới và bắt đầu thử giải nén lại."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/v1/download/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy task yêu cầu."
        )
    await task_manager.cancel_task(task_id)
    return {"message": "Đã hủy bỏ task thành công."}

@app.delete("/api/v1/download/tasks/{task_id}")
async def delete_task(task_id: str):
    await task_manager.delete_task(task_id)
    return {"message": "Đã xóa task thành công."}

@app.get("/api/v1/download/summary")
async def get_summary():
    tasks = await task_manager.list_tasks()
    summary = ProgressManager.calculate_summary(tasks)
    return summary

# -------------------------------------------------------------------
# WEBSOCKET REALTIME ENDPOINT
# -------------------------------------------------------------------

@app.websocket("/api/v1/download/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        tasks = await task_manager.list_tasks()
        summary = ProgressManager.calculate_summary(tasks)
        
        await websocket.send_json({
            "type": "init_state",
            "tasks": [t.model_dump(exclude={"password"}) for t in tasks],
            "summary": summary
        })

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)
    except Exception as e:
        log_error("WEBSOCKET", f"Lỗi WebSocket client: {e}")
        await websocket_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=True)
