import re
import urllib.parse
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.telegram.client import telegram_service
from logger import log_error, log_info

router = APIRouter(prefix="/api/v1/telegram", tags=["Telegram"])


class SendCodeRequest(BaseModel):
    phone: str


class SignInRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: Optional[str] = None
    password: Optional[str] = None


@router.get("/auth/status")
async def get_telegram_auth_status():
    return await telegram_service.get_auth_status()


@router.post("/auth/send_code")
async def send_login_code(req: SendCodeRequest):
    if not req.phone or not req.phone.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số điện thoại không được để trống")
    try:
        res = await telegram_service.send_login_code(req.phone)
        return res
    except Exception as e:
        log_error("TELEGRAM_AUTH", f"Lỗi gửi mã xác thực: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/auth/sign_in")
async def sign_in_telegram(req: SignInRequest):
    if not req.phone or not req.code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số điện thoại và mã OTP là bắt buộc")
    try:
        res = await telegram_service.sign_in(
            phone=req.phone,
            code=req.code,
            phone_code_hash=req.phone_code_hash,
            password=req.password,
        )
        return res
    except Exception as e:
        log_error("TELEGRAM_AUTH", f"Lỗi xác thực đăng nhập: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/inspect")
async def inspect_telegram_url(url: str = Query(..., description="Link tin nhắn Telegram (ví dụ: https://t.me/uuxiaomo/1128)")):
    if not url or not url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL Telegram không được để trống")
    try:
        info = await telegram_service.get_media_info(url)
        return info
    except Exception as e:
        log_error("TELEGRAM_INSPECT", f"Lỗi lấy thông tin media Telegram: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/download")
@router.get("/stream")
async def download_telegram_media(
    request: Request,
    url: str = Query(..., description="Link tin nhắn Telegram"),
):
    if not url or not url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL Telegram không được để trống")

    try:
        info = await telegram_service.get_media_info(url)
        file_size = info.get("file_size", 0)
        mime_type = info.get("mime_type", "application/octet-stream")
        raw_file_name = info.get("file_name", "download.bin")
        ascii_file_name = re.sub(r"[^\x20-\x7E]", "_", raw_file_name)
        safe_disposition = f"attachment; filename=\"{ascii_file_name}\"; filename*=UTF-8''{urllib.parse.quote(raw_file_name)}"

        range_header = request.headers.get("range")
        if range_header and file_size > 0:
            match = re.search(r"bytes=(\d+)-(\d*)", range_header)
            if match:
                start = int(match.group(1))
                requested_end = int(match.group(2)) if match.group(2) else None
                if start >= file_size:
                    return Response(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        headers={"Content-Range": f"bytes */{file_size}"},
                    )
                end = min(requested_end, file_size - 1) if requested_end is not None else file_size - 1
                content_length = end - start + 1

                headers = {
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(content_length),
                    "Content-Type": mime_type,
                    "Content-Disposition": safe_disposition,
                }

                log_info("TELEGRAM_DOWNLOAD", f"Download Range: {start}-{end}/{file_size} ({content_length} bytes) - {raw_file_name}")
                chunk_generator = telegram_service.stream_media_chunks(
                    url=url,
                    offset=start,
                    length=content_length,
                    chunk_size=512 * 1024,
                )
                return StreamingResponse(
                    chunk_generator,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    headers=headers,
                    media_type=mime_type,
                )

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": mime_type,
            "Content-Disposition": safe_disposition,
        }
        if file_size > 0:
            headers["Content-Length"] = str(file_size)

        log_info("TELEGRAM_DOWNLOAD", f"Download Full File: {file_size} bytes - {raw_file_name}")
        chunk_generator = telegram_service.stream_media_chunks(url=url, chunk_size=512 * 1024)
        return StreamingResponse(
            chunk_generator,
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=mime_type,
        )
    except Exception as e:
        log_error("TELEGRAM_DOWNLOAD", f"Lỗi tải media Telegram: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/thumbnail")
async def get_telegram_thumbnail(
    url: str = Query(..., description="Link tin nhắn Telegram"),
):
    if not url or not url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL Telegram không được để trống")

    try:
        thumb_bytes = await telegram_service.get_thumbnail_bytes(url.strip())
        if not thumb_bytes:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thumbnail cho media này")

        return Response(
            content=thumb_bytes,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=86400",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        log_error("TELEGRAM_THUMB", f"Lỗi lấy thumbnail: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


