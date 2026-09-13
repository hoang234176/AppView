"""Các hợp đồng dùng chung cho mọi nguồn tải.

Thêm một nền tảng mới chỉ cần triển khai ``DownloadResolver``; downloader,
extractor và video pipeline không cần biết URL đến từ MediaFire, YouTube hay nơi khác.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Optional, Protocol


@dataclass(frozen=True)
class ResolvedDownload:
    original_url: str
    download_url: str
    filename: str
    extension: str
    audio_url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    source: str = "archive"
    items: Optional[list[dict[str, Any]]] = None


class DownloadResolver(Protocol):
    async def resolve(self, url: str) -> ResolvedDownload:
        """Chuyển URL của nền tảng thành URL tải trực tiếp an toàn."""


def format_photo_download_filename(
    platform: str,
    raw_title: str,
    post_id: str,
    index: int = 1,
    ext: str = ".jpeg",
) -> str:
    """Format social media photo filename following the universal AppView convention:
    [<Tên mxh>]_<Tên ảnh>_<số thứ tự ảnh>.<đuôi file ảnh>
    Ví dụ: [Facebook]_Ảnh demo_01.jpeg, [TikTok]_Ảnh demo_01.jpeg, [Instagram]_Ảnh demo_01.jpeg
    """
    clean_platform = platform.strip()
    if clean_platform.lower() == "tiktok":
        platform_tag = "[TikTok]"
    elif clean_platform.lower() == "facebook":
        platform_tag = "[Facebook]"
    elif clean_platform.lower() == "instagram":
        platform_tag = "[Instagram]"
    elif clean_platform.lower() == "youtube":
        platform_tag = "[YouTube]"
    else:
        platform_tag = f"[{clean_platform.title()}]"

    clean_id = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", str(post_id or "post")).strip(" _-")
    title_text = str(raw_title or "").strip()
    sanitized = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", title_text)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()

    # Strip redundant platform prefixes if present
    for pfx in (f"{clean_platform.lower()}_", "facebook_", "tiktok_", "instagram_", "fb_"):
        if sanitized.lower().startswith(pfx):
            sanitized = sanitized[len(pfx):].strip(" _-")

    # If title is empty or generic, fallback to post ID
    if not sanitized or sanitized.lower() in ("post", "photo", "image", "media", "video"):
        clean_title = f"post_{clean_id}"
    else:
        clean_title = sanitized[:40].strip(" _-") or f"post_{clean_id}"

    idx_str = f"{max(1, int(index)):02d}"
    clean_ext = ext if ext.startswith(".") else f".{ext}"
    if not clean_ext:
        clean_ext = ".jpeg"

    return f"{platform_tag}_{clean_title}_{idx_str}{clean_ext}"
