import asyncio
import os
import re
from typing import Any, AsyncGenerator, Optional, Tuple

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import MessageMediaDocument, MessageMediaPhoto, DocumentAttributeVideo, DocumentAttributeFilename
from logger import log_error, log_info, log_warning
import config  # noqa: F401


class TelegramService:
    def __init__(self) -> None:
        self._client: Optional[TelegramClient] = None
        self._lock = asyncio.Lock()
        self._current_session_str: Optional[str] = None
        self._phone_code_hashes: dict[str, str] = {}

    def _get_api_credentials(self) -> Tuple[Optional[int], Optional[str]]:
        api_id_str = os.getenv("TELEGRAM_API_ID", "").strip()
        api_hash = os.getenv("TELEGRAM_API_HASH", "").strip()
        if not api_id_str or not api_hash:
            return None, None
        try:
            return int(api_id_str), api_hash
        except ValueError:
            return None, None

    async def _ensure_client(self) -> TelegramClient:
        async with self._lock:
            api_id, api_hash = self._get_api_credentials()
            if not api_id or not api_hash:
                raise ValueError("Chưa cấu hình TELEGRAM_API_ID và TELEGRAM_API_HASH trong biến môi trường.")

            if not self._current_session_str:
                from worker.client import coordinator_worker_client
                saved_session = await coordinator_worker_client.get_session("telegram")
                if saved_session:
                    self._current_session_str = saved_session

            session_str = self._current_session_str or ""

            if self._client is None or (session_str and self._current_session_str != session_str):
                if self._client is not None and self._client.is_connected():
                    await self._client.disconnect()

                self._current_session_str = session_str
                self._client = TelegramClient(StringSession(session_str), api_id, api_hash)
                await self._client.connect()

            if not self._client.is_connected():
                await self._client.connect()

            return self._client

    async def get_auth_status(self) -> dict[str, Any]:
        api_id, api_hash = self._get_api_credentials()
        if not api_id or not api_hash:
            return {
                "configured": False,
                "logged_in": False,
                "message": "Chưa cấu hình TELEGRAM_API_ID và TELEGRAM_API_HASH",
            }

        try:
            client = await self._ensure_client()
            is_auth = await client.is_user_authorized()
            if is_auth:
                me = await client.get_me()
                return {
                    "configured": True,
                    "logged_in": True,
                    "user": {
                        "id": me.id,
                        "first_name": me.first_name,
                        "username": me.username,
                        "phone": me.phone,
                    },
                }
            return {
                "configured": True,
                "logged_in": False,
                "message": "Chưa đăng nhập Telegram session",
            }
        except Exception as e:
            log_error("TELEGRAM", f"Lỗi kiểm tra auth status: {e}")
            return {
                "configured": True,
                "logged_in": False,
                "error": str(e),
            }

    async def send_login_code(self, phone: str) -> dict[str, Any]:
        clean_phone = re.sub(r"[^\d+]", "", phone.strip())
        if not clean_phone:
            raise ValueError("Số điện thoại không hợp lệ")

        client = await self._ensure_client()
        sent_code = await client.send_code_request(clean_phone)
        self._phone_code_hashes[clean_phone] = sent_code.phone_code_hash
        log_info("TELEGRAM", f"Đã gửi mã xác thực Telegram tới {clean_phone}")
        return {
            "success": True,
            "phone": clean_phone,
            "phone_code_hash": sent_code.phone_code_hash,
            "type": str(type(sent_code.type).__name__),
        }

    async def sign_in(
        self,
        phone: str,
        code: str,
        phone_code_hash: Optional[str] = None,
        password: Optional[str] = None,
    ) -> dict[str, Any]:
        clean_phone = re.sub(r"[^\d+]", "", phone.strip())
        clean_code = code.strip()
        h = phone_code_hash or self._phone_code_hashes.get(clean_phone)

        client = await self._ensure_client()
        try:
            if not await client.is_user_authorized():
                if not h:
                    raise ValueError("Thiếu phone_code_hash. Vui lòng gửi lại mã OTP.")
                try:
                    await client.sign_in(phone=clean_phone, code=clean_code, phone_code_hash=h)
                except Exception as e:
                    if "Two-steps verification is enabled" in str(e) or "SessionPasswordNeededError" in type(e).__name__:
                        if not password:
                            return {
                                "success": False,
                                "requires_password": True,
                                "message": "Tài khoản có bảo mật 2 bước (2FA). Vui lòng nhập mật khẩu 2FA.",
                            }
                        await client.sign_in(password=password)
                    else:
                        raise e

            # Save session via Coordinator -> Storage
            session_str = client.session.save()
            from worker.client import coordinator_worker_client
            await coordinator_worker_client.save_session("telegram", session_str)
            self._current_session_str = session_str

            me = await client.get_me()
            log_info("TELEGRAM", f"Đăng nhập Telegram thành công: {me.first_name} (@{me.username})")
            return {
                "success": True,
                "logged_in": True,
                "user": {
                    "id": me.id,
                    "first_name": me.first_name,
                    "username": me.username,
                },
            }
        except Exception as e:
            log_error("TELEGRAM", f"Lỗi đăng nhập Telegram: {e}")
            raise e

    @staticmethod
    def parse_telegram_url(url: str) -> Tuple[str, int]:
        clean_url = url.strip()
        match = re.search(r"t\.me/(?:c/)?([^/]+)/(\d+)", clean_url)
        if not match:
            raise ValueError(f"Định dạng link Telegram không hợp lệ: {url}")
        channel_identifier = match.group(1)
        message_id = int(match.group(2))
        return channel_identifier, message_id

    async def get_message_media(self, url: str) -> Tuple[Any, Any]:
        channel_id, msg_id = self.parse_telegram_url(url)
        client = await self._ensure_client()
        if not await client.is_user_authorized():
            raise PermissionError("Telegram chưa được đăng nhập. Vui lòng xác thực tài khoản.")

        entity = channel_id
        if channel_id.isdigit() or (channel_id.startswith("-") and channel_id[1:].isdigit()):
            entity = int(channel_id)

        try:
            entity_obj = await client.get_entity(entity)
        except Exception:
            entity_obj = entity

        message = await client.get_messages(entity_obj, ids=msg_id)
        if not message:
            raise ValueError(f"Không tìm thấy tin nhắn {msg_id} trên kênh {channel_id}")

        if not message.media:
            raise ValueError(f"Tin nhắn {msg_id} không chứa file ảnh hoặc video nào.")

        return message, message.media

    async def get_media_info(self, url: str) -> dict[str, Any]:
        message, media = await self.get_message_media(url)
        channel_id, msg_id = self.parse_telegram_url(url)
        client = await self._ensure_client()

        entity = channel_id
        if channel_id.isdigit() or (channel_id.startswith("-") and channel_id[1:].isdigit()):
            entity = int(channel_id)
        try:
            entity_obj = await client.get_entity(entity)
        except Exception:
            entity_obj = entity

        grouped_id = getattr(message, "grouped_id", None)
        album_messages = [message]
        if grouped_id:
            try:
                min_id = max(0, msg_id - 20)
                max_id = msg_id + 20
                surrounding = await client.get_messages(entity_obj, min_id=min_id, max_id=max_id, limit=40)
                matched = [m for m in surrounding if getattr(m, "grouped_id", None) == grouped_id]
                if matched:
                    album_messages = sorted(matched, key=lambda x: x.id)
            except Exception as e:
                log_warning("TELEGRAM_ALBUM", f"Không thể lấy album hoàn chỉnh: {e}")

        # Extract album caption across album messages if available
        album_caption = ""
        for m in album_messages:
            msg_text = (getattr(m, "message", None) or "").strip()
            if msg_text:
                album_caption = msg_text
                break

        main_caption = (getattr(message, "message", None) or "").strip() or album_caption
        overall_title = main_caption or f"{channel_id}_{msg_id}"

        items = []
        for idx, m in enumerate(album_messages, start=1):
            m_media = m.media
            if not m_media:
                continue

            item_type = "photo"
            file_name = f"[Telegram]_{channel_id}_{idx:02d}.jpg"
            file_size = 0
            mime_type = "image/jpeg"
            duration = 0
            width = 0
            height = 0

            if isinstance(m_media, MessageMediaDocument) and m_media.document:
                doc = m_media.document
                item_type = "video" if doc.mime_type and doc.mime_type.startswith("video/") else "document"
                file_size = doc.size
                mime_type = doc.mime_type or "video/mp4"
                custom_name = None
                for attr in doc.attributes:
                    if isinstance(attr, DocumentAttributeVideo):
                        duration = attr.duration
                        width = attr.w
                        height = attr.h
                    elif isinstance(attr, DocumentAttributeFilename):
                        custom_name = attr.file_name

                if custom_name:
                    file_name = f"[Telegram]_{custom_name}" if not custom_name.startswith("[Telegram]_") else custom_name
                else:
                    ext = ".mp4" if item_type == "video" else ".bin"
                    file_name = f"[Telegram]_{channel_id}_{idx:02d}{ext}"

            elif isinstance(m_media, MessageMediaPhoto) and m_media.photo:
                item_type = "photo"
                file_name = f"[Telegram]_{channel_id}_{idx:02d}.jpg"
                mime_type = "image/jpeg"
                photo = m_media.photo
                from telethon.tl.types import PhotoSize, PhotoSizeProgressive
                for s in photo.sizes:
                    if isinstance(s, PhotoSize):
                        if s.size > file_size:
                            file_size = s.size
                        if s.w > width:
                            width, height = s.w, s.h
                    elif isinstance(s, PhotoSizeProgressive):
                        if s.w > width:
                            width, height = s.w, s.h
                        if s.sizes:
                            max_s = max(s.sizes)
                            if max_s > file_size:
                                file_size = max_s

            item_url = f"https://t.me/{channel_id}/{m.id}"
            item_msg_text = (getattr(m, "message", None) or "").strip()
            item_title = item_msg_text or album_caption or f"{channel_id}_{m.id}"

            items.append({
                "index": idx,
                "msg_id": m.id,
                "type": item_type,
                "url": item_url,
                "title": item_title,
                "file_name": file_name,
                "file_size": file_size,
                "mime_type": mime_type,
                "duration": duration,
                "width": width,
                "height": height,
            })

        # Selected main item
        main_item = next((it for it in items if it["msg_id"] == msg_id), items[0] if items else None)

        return {
            "url": url,
            "channel": channel_id,
            "message_id": msg_id,
            "is_album": len(items) > 1,
            "total_items": len(items),
            "title": overall_title,
            "file_name": main_item["file_name"] if main_item else f"telegram_{channel_id}_{msg_id}.mp4",
            "file_size": main_item["file_size"] if main_item else 0,
            "mime_type": main_item["mime_type"] if main_item else "video/mp4",
            "duration": main_item["duration"] if main_item else 0,
            "width": main_item["width"] if main_item else 0,
            "height": main_item["height"] if main_item else 0,
            "type": main_item["type"] if main_item else "video",
            "items": items,
        }


    async def stream_media_chunks(
        self,
        url: str,
        offset: int = 0,
        length: Optional[int] = None,
        chunk_size: int = 512 * 1024,
    ) -> AsyncGenerator[bytes, None]:
        client = await self._ensure_client()
        message, media = await self.get_message_media(url)
        target = media.document if (isinstance(media, MessageMediaDocument) and media.document) else media

        bytes_yielded = 0
        try:
            async for chunk in client.iter_download(
                target,
                offset=offset,
                chunk_size=chunk_size,
                request_size=chunk_size,
            ):
                if length is not None and bytes_yielded + len(chunk) > length:
                    remaining = length - bytes_yielded
                    if remaining > 0:
                        yield chunk[:remaining]
                    break
                yield chunk
                bytes_yielded += len(chunk)
                if length is not None and bytes_yielded >= length:
                    break
        except (asyncio.CancelledError, ConnectionResetError):
            pass
        except Exception as e:
            log_warning("TELEGRAM_STREAM", f"Lỗi trong quá trình stream: {e}")

    async def get_thumbnail_bytes(self, url: str) -> bytes:
        client = await self._ensure_client()
        message, media = await self.get_message_media(url)

        # 1. Try downloading thumb=-1 with message
        try:
            data = await client.download_media(message, file=bytes, thumb=-1)
            if isinstance(data, bytes) and len(data) > 0:
                return data
        except Exception as e:
            log_warning("TELEGRAM_THUMB", f"download_media message thumb=-1: {e}")

        # 2. Try downloading thumb=-1 with media
        try:
            data = await client.download_media(media, file=bytes, thumb=-1)
            if isinstance(data, bytes) and len(data) > 0:
                return data
        except Exception as e:
            log_warning("TELEGRAM_THUMB", f"download_media media thumb=-1: {e}")

        # 3. For photos, try downloading whole photo as thumb
        if isinstance(media, MessageMediaPhoto):
            try:
                data = await client.download_media(media, file=bytes)
                if isinstance(data, bytes) and len(data) > 0:
                    return data
            except Exception as e:
                log_warning("TELEGRAM_THUMB", f"download_media photo fallback: {e}")

        return b""


telegram_service = TelegramService()



