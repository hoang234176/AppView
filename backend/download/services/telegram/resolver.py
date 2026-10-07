"""Telegram resolver implementing DownloadResolver protocol.

Resolves Telegram post/message URLs to AppView normalized download contracts.
"""

from __future__ import annotations

import os
import re
from typing import Any, Optional
import urllib.parse

from archive.contracts import (
    DownloadResolver,
    ResolvedDownload,
    assign_unique_item_filenames,
    format_photo_download_filename,
    format_video_download_filename,
)
from config import Config
from logger import log_info, safe_url
from services.telegram.client import telegram_service

TELEGRAM_HOST_PATTERN = re.compile(
    r"^(?:(?:www\.|web\.)?t\.me|telegram\.me)$",
    re.IGNORECASE,
)


def get_internal_download_url(telegram_url: str) -> str:
    """Generate internal download URL pointing to Python Download's /api/v1/telegram/download endpoint."""
    encoded_url = urllib.parse.quote(telegram_url.strip(), safe="")
    # Use 127.0.0.1 and Python Download's configured port
    base_url = f"http://127.0.0.1:{Config.PORT}"
    return f"{base_url}/api/v1/telegram/download?url={encoded_url}"



class TelegramResolver(DownloadResolver):
    """Resolves Telegram post media to normalized AppView download contracts."""

    def __init__(self) -> None:
        self._service = telegram_service

    def supports(self, url: str) -> bool:
        """Check if URL belongs to Telegram post."""
        if not url or not isinstance(url, str):
            return False
        try:
            clean = url.strip()
            parsed = urllib.parse.urlparse(clean)
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            if not bool(TELEGRAM_HOST_PATTERN.match(host)):
                return False
            # Check path matches channel/msg_id
            return bool(re.search(r"/(?:c/)?([^/]+)/(\d+)", parsed.path))
        except Exception:
            return False

    async def preview(self, url: str) -> dict[str, Any]:
        """Return structured preview metadata for Telegram post."""
        clean_url = url.strip()
        info = await self._service.get_media_info(clean_url)
        channel = info.get("channel", "tg")
        msg_id = info.get("message_id", 0)
        items = info.get("items", [])
        raw_title = info.get("title") or f"{channel}_{msg_id}"
        clean_raw_title = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv)$", "", raw_title, flags=re.IGNORECASE).strip()
        clean_raw_title = re.sub(r"^\[Telegram\]_", "", clean_raw_title).strip()
        if not clean_raw_title or clean_raw_title.lower() in ("post", "photo", "image", "media", "video", "telegram media"):
            clean_raw_title = f"{channel}_{msg_id}"

        is_album = info.get("is_album", False)
        main_type = info.get("type", "video")

        qualities: list[int] = []
        if main_type == "video" and info.get("height"):
            qualities.append(int(info["height"]))

        import base64
        preview_items: list[dict[str, Any]] = []
        for idx, item in enumerate(items, start=1):
            item_url = item.get("url") or f"https://t.me/{channel}/{item.get('msg_id')}"
            item_type = item.get("type", "video")
            ext = ".mp4" if item_type == "video" else ".jpeg"
            it_idx = item.get("index") or idx

            item_title = item.get("title") or clean_raw_title
            item_title = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv)$", "", str(item_title), flags=re.IGNORECASE).strip()
            item_title = re.sub(r"^\[Telegram\]_", "", item_title).strip()
            if not item_title or item_title.startswith("Mục #") or item_title.lower() in ("post", "photo", "image", "media", "video", "telegram media"):
                item_title = clean_raw_title

            use_index = it_idx if (is_album or len(items) > 1) else None
            if item_type == "photo":
                item_filename = format_photo_download_filename("Telegram", item_title, str(msg_id), use_index, ext)
            else:
                item_filename = format_video_download_filename("Telegram", item_title, str(msg_id), use_index, ext)

            item_thumb = ""
            try:
                tbytes = await self._service.get_thumbnail_bytes(item_url)
                if tbytes:
                    b64 = base64.b64encode(tbytes).decode("ascii")
                    item_thumb = f"data:image/jpeg;base64,{b64}"
            except Exception as e:
                log_warning("TELEGRAM_RESOLVER", f"Không thể lấy thumbnail cho item {item_url}: {e}")

            if not item_thumb:
                item_thumb = f"/api/v1/telegram/thumbnail?url={urllib.parse.quote(item_url, safe='')}"

            display_title = item_title if (item_title and not item_title.startswith("Mục #")) else f"{clean_raw_title} #{idx}"

            preview_items.append({
                "index": it_idx,
                "msg_id": item.get("msg_id"),
                "type": item_type,
                "url": item_thumb,
                "thumbnail": item_thumb,
                "title": display_title,
                "filename": item_filename,
                "file_size": item.get("file_size", 0),
                "duration": item.get("duration", 0),
                "width": item.get("width", 0),
                "height": item.get("height", 0),
            })

        photos = [it for it in preview_items if it["type"] == "photo"]
        videos = [it for it in preview_items if it["type"] == "video"]
        has_video = len(videos) > 0

        # Build standard images array for UI photo gallery & selection
        standard_images = [
            {
                "id": str(p["msg_id"]),
                "type": "photo",
                "label": f"Ảnh #{p['index']}" + (f" ({p['width']}x{p['height']})" if p.get("width") and p.get("height") else ""),
                "url": p["url"],
                "thumbnail": p["thumbnail"],
            }
            for p in photos
        ]

        # Author / Channel info
        author = {
            "name": channel,
            "url": f"https://t.me/{channel}",
            "avatar": "",
        }

        # If there are video qualities from the first video
        if videos and not qualities:
            v0 = videos[0]
            if v0.get("height"):
                qualities.append(int(v0["height"]))

        qualities = sorted(list(set(qualities)), reverse=True)

        primary_thumbnail = ""
        if preview_items:
            primary_thumbnail = preview_items[0]["thumbnail"]

        if not primary_thumbnail:
            try:
                thumb_bytes = await self._service.get_thumbnail_bytes(clean_url)
                if thumb_bytes:
                    b64_str = base64.b64encode(thumb_bytes).decode("ascii")
                    primary_thumbnail = f"data:image/jpeg;base64,{b64_str}"
            except Exception as e:
                log_warning("TELEGRAM_RESOLVER", f"Không thể tạo thumbnail data-url: {e}")

        if not primary_thumbnail:
            primary_thumbnail = f"/api/v1/telegram/thumbnail?url={urllib.parse.quote(clean_url, safe='')}"

        return {
            "source": "telegram",
            "url": clean_url,
            "title": clean_raw_title,
            "uploader": channel,
            "author": author,
            "thumbnail": primary_thumbnail,
            "type": "album" if is_album else main_type,
            "is_album": is_album,
            "total_items": len(items),
            "qualities": qualities,
            "items": preview_items,
            "photos": photos,
            "videos": videos,
            "images": standard_images,
            "all_images": standard_images,
            "has_video": has_video,
            "has_audio": has_video,
        }

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        clean_url = url.strip()
        info = await self._service.get_media_info(clean_url)
        channel = info.get("channel", "tg")
        msg_id = info.get("message_id", 0)
        raw_title = info.get("title") or f"{channel}_{msg_id}"
        is_album = info.get("is_album", False)
        items = info.get("items", [])

        if not items:
            raise ValueError("Không tìm thấy tệp media nào trong tin nhắn Telegram.")

        # 1. Filter strictly by media_type if specified ("images"/"photo" vs "video")
        if media_type in ("images", "photo", "image"):
            items = [it for it in items if it.get("type") == "photo"]
            if not items:
                raise ValueError("Không tìm thấy ảnh nào để tải xuống trong tin nhắn Telegram này.")
        elif media_type == "video":
            items = [it for it in items if it.get("type") == "video"]
            if not items:
                raise ValueError("Không tìm thấy video nào để tải xuống trong tin nhắn Telegram này.")

        # 2. Filter by selected_indices if user picked specific photos/videos
        if selected_indices is not None and len(selected_indices) > 0:
            valid_items = [items[i] for i in selected_indices if 0 <= i < len(items)]
            if valid_items:
                items = valid_items

        # Clean title if it ends with file extension like .jpg or .mp4
        clean_raw_title = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv)$", "", raw_title, flags=re.IGNORECASE).strip()
        clean_raw_title = re.sub(r"^\[Telegram\]_", "", clean_raw_title).strip()
        if not clean_raw_title or clean_raw_title.lower() in ("post", "photo", "image", "media", "video", "telegram media"):
            clean_raw_title = f"{channel}_{msg_id}"

        raw_items: list[dict[str, Any]] = []
        for it in items:
            it_url = it.get("url") or f"https://t.me/{channel}/{it.get('msg_id')}"
            it_type = it.get("type", "video")
            ext = ".mp4" if it_type == "video" else ".jpeg"
            it_title = it.get("title") or clean_raw_title
            # Strip file extension if title looks like a filename
            it_title = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv)$", "", str(it_title), flags=re.IGNORECASE).strip()
            it_title = re.sub(r"^\[Telegram\]_", "", it_title).strip()
            if not it_title or it_title.startswith("Mục #") or it_title.lower() in ("post", "photo", "image", "media", "video", "telegram media"):
                it_title = clean_raw_title

            download_url = get_internal_download_url(it_url)
            it_idx = it.get("index") if (is_album or len(items) > 1) else None
            raw_items.append({
                "url": download_url,
                "type": "image" if it_type == "photo" else "video",
                "title": it_title,
                "extension": ext,
                "size": it.get("file_size", 0),
                "index": it_idx,
            })

        assigned_items = assign_unique_item_filenames("Telegram", clean_raw_title, str(msg_id), raw_items)
        primary_download = assigned_items[0]["url"]
        single_filename = assigned_items[0]["filename"]
        first_ext = ".mp4" if assigned_items[0]["type"] == "video" else ".jpeg"

        return ResolvedDownload(
            original_url=clean_url,
            download_url=primary_download,
            filename=single_filename,
            extension=first_ext,
            source="telegram",
            items=assigned_items if len(assigned_items) > 1 else None,
        )
