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
    archive_type: str = "single"


class DownloadResolver(Protocol):
    async def resolve(self, url: str) -> ResolvedDownload:
        """Chuyển URL của nền tảng thành URL tải trực tiếp an toàn."""


def format_photo_download_filename(
    platform: str,
    raw_title: str,
    post_id: str = "",
    index: Optional[int] = None,
    ext: str = ".jpeg",
) -> str:
    """Format social media photo filename following the universal AppView convention:
    Single/Unique photo: [<Tên mxh>]_<Tên ảnh>.<đuôi file ảnh>
    Duplicate/Indexed photo: [<Tên mxh>]_<Tên ảnh>_<số thứ tự 2 chữ số>.<đuôi file ảnh>
    Ví dụ: [Facebook]_Ảnh demo.jpeg, [TikTok]_Ảnh demo_01.jpeg, [Instagram]_Ảnh demo.jpeg
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
    elif clean_platform.lower() == "telegram":
        platform_tag = "[Telegram]"
    elif clean_platform.lower() in ("x", "twitter"):
        platform_tag = "[X]"
    else:
        platform_tag = f"[{clean_platform.title()}]"

    clean_id = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", str(post_id or "post")).strip(" _-")
    title_text = str(raw_title or "").strip()
    sanitized = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", title_text)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()

    # Strip trailing file extensions if title contains them
    sanitized = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv|bin)$", "", sanitized, flags=re.IGNORECASE).strip(" _-")

    # Strip redundant platform prefixes if present
    for pfx in (
        f"{clean_platform.lower()}_",
        f"[{clean_platform.lower()}]",
        f"[{clean_platform.lower()}]_",
        "facebook_",
        "tiktok_",
        "instagram_",
        "youtube_",
        "telegram_",
        "fb_",
        "yt_",
        "tg_",
    ):
        if sanitized.lower().startswith(pfx):
            sanitized = sanitized[len(pfx):].strip(" _-")

    # If title is empty or generic placeholder, fallback to post ID
    if (
        not sanitized
        or re.match(r"^(?:Mục|Item|Ảnh|Photo|Video|Image)\s*#?\d*$", sanitized, re.IGNORECASE)
        or sanitized.lower() in ("post", "photo", "image", "media", "video", "telegram media")
    ):
        clean_title = f"post_{clean_id}"
    else:
        clean_title = sanitized[:40].strip(" _-") or f"post_{clean_id}"

    idx_str = f"_{max(1, int(index)):02d}" if index is not None else ""
    clean_ext = ext if ext.startswith(".") else f".{ext}"
    if not clean_ext:
        clean_ext = ".jpeg"

    return f"{platform_tag}_{clean_title}{idx_str}{clean_ext}"


def format_video_download_filename(
    platform: str,
    raw_title: str,
    post_id: str = "",
    index: Optional[int] = None,
    ext: str = ".mp4",
) -> str:
    """Format social media video filename following the universal AppView convention:
    Single/Unique video: [<Tên mxh>]_<Tên video>.<đuôi file video>
    Duplicate/Indexed video: [<Tên mxh>]_<Tên video>_<số thứ tự 2 chữ số>.<đuôi file video>
    Ví dụ:
        [YouTube]_Bài giảng Python.mp4
        [Facebook]_Video hài hước.mp4
        [TikTok]_Dance Challenge.mp4
        [Instagram]_Reel demo.mp4
        [Instagram]_Reel demo_01.mp4 (khi trùng tên trong cùng bài viết)
        [Telegram]_Video clip.mp4
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
    elif clean_platform.lower() == "telegram":
        platform_tag = "[Telegram]"
    elif clean_platform.lower() in ("x", "twitter"):
        platform_tag = "[X]"
    else:
        platform_tag = f"[{clean_platform.title()}]"

    clean_id = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", str(post_id or "video")).strip(" _-")
    title_text = str(raw_title or "").strip()
    sanitized = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", title_text)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()

    # Strip trailing file extensions if title contains them
    sanitized = re.sub(r"\.(?:jpe?g|png|webp|mp4|mov|mkv|bin)$", "", sanitized, flags=re.IGNORECASE).strip(" _-")

    # Strip redundant platform prefixes if present
    for pfx in (
        f"{clean_platform.lower()}_",
        f"[{clean_platform.lower()}]",
        f"[{clean_platform.lower()}]_",
        "facebook_",
        "tiktok_",
        "instagram_",
        "youtube_",
        "telegram_",
        "fb_",
        "yt_",
        "tg_",
    ):
        if sanitized.lower().startswith(pfx):
            sanitized = sanitized[len(pfx):].strip(" _-")

    # If title is empty or generic, fallback to video ID
    if (
        not sanitized
        or re.match(r"^(?:Mục|Item|Ảnh|Photo|Video|Image)\s*#?\d*$", sanitized, re.IGNORECASE)
        or sanitized.lower() in ("post", "photo", "image", "media", "video", "reel", "telegram media")
    ):
        clean_title = f"video_{clean_id}" if clean_id else "video"
    else:
        clean_title = sanitized[:60].strip(" _-") or (f"video_{clean_id}" if clean_id else "video")

    idx_str = f"_{max(1, int(index)):02d}" if index is not None else ""
    clean_ext = ext if ext.startswith(".") else f".{ext}"
    if not clean_ext:
        clean_ext = ".mp4"

    return f"{platform_tag}_{clean_title}{idx_str}{clean_ext}"


def assign_unique_item_filenames(
    platform: str,
    raw_title: str,
    post_id: str,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Assign smart deduplicated filenames to items in an album/carousel.
    - Items with unique titles do not receive index suffixes (_01, _02).
    - Only items with colliding/duplicate base filenames receive sequential suffixes (_01, _02...).
    """
    if not items:
        return []

    if len(items) == 1:
        it = dict(items[0])
        it_type = str(it.get("type", "video")).lower()
        ext = it.get("extension") or (".jpeg" if it_type in ("image", "photo") else ".mp4")
        it_title = it.get("title") or raw_title
        it_index = it.get("index")
        if it_type in ("image", "photo"):
            fn = format_photo_download_filename(platform, it_title, post_id, index=it_index, ext=ext)
        else:
            fn = format_video_download_filename(platform, it_title, post_id, index=it_index, ext=ext)
        it["filename"] = fn
        return [it]

    # First pass: calculate candidate base filenames without index
    candidates: list[tuple[dict[str, Any], str, str, str]] = []
    base_counts: dict[str, int] = {}

    for it in items:
        it_copy = dict(it)
        it_type = str(it_copy.get("type", "video")).lower()
        ext = it_copy.get("extension") or (".jpeg" if it_type in ("image", "photo") else ".mp4")

        # Check if item title is meaningful vs generic placeholder
        item_title = str(it_copy.get("title") or "").strip()
        is_generic = (
            not item_title
            or re.match(r"^(?:Mục|Item|Ảnh|Photo|Video|Image)\s*#?\d*$", item_title, re.IGNORECASE)
            or item_title.lower() in ("post", "photo", "image", "media", "video", "reel", "telegram media")
        )
        effective_title = raw_title if is_generic else item_title

        if it_type in ("image", "photo"):
            base_fn = format_photo_download_filename(platform, effective_title, post_id, index=None, ext=ext)
        else:
            base_fn = format_video_download_filename(platform, effective_title, post_id, index=None, ext=ext)

        base_counts[base_fn] = base_counts.get(base_fn, 0) + 1
        candidates.append((it_copy, base_fn, effective_title, ext))

    # Second pass: assign final filename, numbering only colliding filenames
    base_seq: dict[str, int] = {}
    result: list[dict[str, Any]] = []

    for it_copy, base_fn, effective_title, ext in candidates:
        it_type = str(it_copy.get("type", "video")).lower()
        item_given_idx = it_copy.get("index")
        if base_counts[base_fn] > 1:
            base_seq[base_fn] = base_seq.get(base_fn, 0) + 1
            idx = item_given_idx if item_given_idx is not None else base_seq[base_fn]
            if it_type in ("image", "photo"):
                final_fn = format_photo_download_filename(platform, effective_title, post_id, index=idx, ext=ext)
            else:
                final_fn = format_video_download_filename(platform, effective_title, post_id, index=idx, ext=ext)
        else:
            final_fn = base_fn

        it_copy["filename"] = final_fn
        result.append(it_copy)

    return result
