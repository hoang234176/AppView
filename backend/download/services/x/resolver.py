"""Public X (Twitter) resolver implementing DownloadResolver protocol."""

from __future__ import annotations

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
from logger import log_error, log_info
from services.x.errors import XNotFoundError, XPostError, XUnsupportedUrlError
from services.x.extractor import XExtractor

X_HOST_PATTERN = re.compile(
    r"^(?:(?:www\.|mobile\.)?(?:twitter\.com|x\.com))$",
    re.IGNORECASE,
)


class XResolver(DownloadResolver):
    """Resolves X (Twitter) URLs into normalized AppView download contracts."""

    def __init__(self, extractor: Optional[XExtractor] = None):
        self._extractor = extractor or XExtractor()

    def supports(self, url: str) -> bool:
        """Check if URL belongs to X (Twitter)."""
        if not url or not isinstance(url, str):
            return False
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            if not bool(X_HOST_PATTERN.match(host)):
                return False
            return "/status/" in parsed.path.lower()
        except Exception:
            return False

    async def preview(self, url: str) -> dict[str, Any]:
        """Return full structured preview metadata for X posts."""
        if not self.supports(url):
            raise XUnsupportedUrlError("Liên kết không phải là bài viết X (Twitter) hợp lệ.")
        return await self._extractor.inspect(url)

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        """Resolve X post to normalized download contract."""
        clean_url = url.strip()
        if not self.supports(clean_url):
            raise XUnsupportedUrlError("Liên kết không phải là bài viết X (Twitter) hợp lệ.")

        info = await self._extractor.inspect(clean_url)
        items = info.get("items") or []
        post_text = (info.get("text") or info.get("content") or "").strip()
        clean_title = info.get("title") or f"post_{info.get('id', 'post')}"

        # If post has text, generate companion post text item
        text_item = None
        if post_text:
            author_info = info.get("author") or {}
            author_str = f"{author_info.get('name', 'X User')} (@{author_info.get('screen_name', 'user')})"
            created_at_str = info.get("created_at") or info.get("created_time") or ""
            likes = info.get("metrics", {}).get("likes", 0)
            replies = info.get("metrics", {}).get("replies", 0)

            txt_content = (
                f"Tác giả: {author_str}\n"
                f"Thời gian: {created_at_str}\n"
                f"Tương tác: {likes} lượt thích, {replies} phản hồi\n"
                f"Liên kết: {clean_url}\n\n"
                f"--- NỘI DUNG BÀI VIẾT ---\n"
                f"{post_text}\n"
            )
            data_uri = "data:text/plain;charset=utf-8," + urllib.parse.quote(txt_content)
            txt_suffix = "_post" if len(items) > 0 else ""
            txt_filename = f"[X]_{clean_title}{txt_suffix}.txt"
            text_item = {
                "index": len(items) + 1,
                "type": "text",
                "download_url": data_uri,
                "filename": txt_filename,
            }

        if not items:
            if text_item is not None:
                items = [text_item]
            else:
                raise XNotFoundError("Bài viết X này không chứa tệp hình ảnh, video hoặc nội dung để tải xuống.")
        elif media_type not in ("photo", "video") and text_item is not None:
            # Include post text alongside media items when not strictly filtered
            items.append(text_item)

        # Filter by selected_indices if provided
        if selected_indices is not None and len(selected_indices) > 0:
            filtered = [item for idx, item in enumerate(items) if idx in selected_indices or (idx + 1) in selected_indices]
            if filtered:
                items = filtered

        # Filter by media_type if provided ("photo", "video", or "text")
        if media_type in ("photo", "video", "text"):
            filtered = [item for item in items if item.get("type") == media_type]
            if filtered:
                items = filtered

        raw_items = [
            {
                "url": it["download_url"],
                "type": it["type"],
                "title": it.get("title") or clean_title,
                "extension": ".jpeg" if it["type"] == "photo" else (".txt" if it["type"] == "text" else ".mp4"),
            }
            for it in items
        ]
        assigned_items = assign_unique_item_filenames("X", clean_title, str(info.get("id", "post")), raw_items)

        # Headers safe for twimg CDN download
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Referer": "https://x.com/",
        }

        primary_item = assigned_items[0]
        download_url = primary_item.get("url") or ""
        single_filename = primary_item.get("filename") or "x_media.mp4"
        single_ext = primary_item.get("extension") or (".jpeg" if primary_item.get("type") == "photo" else ".mp4")

        return ResolvedDownload(
            original_url=clean_url,
            download_url=download_url,
            filename=single_filename,
            extension=single_ext,
            headers=headers,
            source="x",
            items=assigned_items if len(assigned_items) > 1 else None,
        )
