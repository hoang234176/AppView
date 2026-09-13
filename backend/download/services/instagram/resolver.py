"""Instagram resolver implementing DownloadResolver protocol.

Provides inspection and resolution for Instagram posts (photos, videos, mixed media)
with highest bitrate/resolution selection and multi-item batch contracts.
"""

from __future__ import annotations

import re
from typing import Any, Optional
import urllib.parse

from archive.contracts import (
    DownloadResolver,
    ResolvedDownload,
    format_photo_download_filename,
)
from logger import log_error, log_info
from services.instagram.errors import InstagramNotFoundError, InstagramUnsupportedPostError
from services.instagram.extractor import InstagramExtractor

INSTAGRAM_HOST_PATTERN = re.compile(
    r"^(?:(?:www\.)?instagram\.com|instagr\.am)$",
    re.IGNORECASE,
)


def sanitize_filename(name: str) -> str:
    """Sanitize title into a safe filename without path traversal or invalid characters."""
    name = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "instagram_post"


class InstagramResolver(DownloadResolver):
    """Resolves Instagram posts into normalized AppView download contracts."""

    def __init__(self, extractor: Optional[InstagramExtractor] = None):
        self._extractor = extractor or InstagramExtractor()

    def supports(self, url: str) -> bool:
        """Check if URL belongs to Instagram."""
        if not url or not isinstance(url, str):
            return False
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            if not bool(INSTAGRAM_HOST_PATTERN.match(host)):
                return False
            path = parsed.path.lower()
            return any(p in path for p in ("/p/", "/reel/", "/reels/", "/tv/", "/share/"))
        except Exception:
            return False

    async def preview(self, url: str) -> dict[str, Any]:
        """Return full structured preview metadata for Instagram posts."""
        if not self.supports(url):
            raise InstagramUnsupportedPostError("Liên kết không phải là bài viết Instagram hợp lệ.")
        return await self._extractor.inspect(url)

    def _get_headers(self) -> dict[str, str]:
        """Build standard headers with optional authenticated cookie."""
        headers: dict[str, str] = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Referer": "https://www.instagram.com/",
        }
        cookie_header = self._extractor._get_cookie_header()
        if cookie_header:
            headers["Cookie"] = cookie_header
        return headers

    def resolve_images(
        self,
        clean_url: str,
        info: dict[str, Any],
        selected_indices: Optional[list[int]] = None,
    ) -> ResolvedDownload:
        """Resolve Instagram photos to normalized download contract."""
        raw_title = info.get("title") or ""
        post_id = str(info.get("id") or "post")
        photos = info.get("photos") or []
        photo_urls = [p["url"] for p in photos if p.get("url")]

        if not photo_urls:
            raw_imgs = info.get("images") or []
            for item in raw_imgs:
                if isinstance(item, dict) and item.get("url"):
                    photo_urls.append(item["url"])

        if not photo_urls:
            raise InstagramNotFoundError("Không tìm thấy ảnh để tải xuống từ bài viết Instagram này.")

        if selected_indices is not None and len(selected_indices) > 0:
            valid_indices = [i for i in selected_indices if 0 <= i < len(photo_urls)]
            if valid_indices:
                photo_urls = [photo_urls[i] for i in valid_indices]

        items: list[dict[str, Any]] = []
        for idx, img_url in enumerate(photo_urls):
            filename = format_photo_download_filename("Instagram", raw_title, post_id, idx + 1, ".jpeg")
            items.append({
                "url": img_url,
                "filename": filename,
                "type": "image",
            })

        primary_url = items[0]["url"]
        headers = self._get_headers()

        single_filename = items[0]["filename"]
        clean_base = items[0]["filename"].rsplit("_", 1)[0]
        bundle_filename = f"{clean_base}.zip"

        return ResolvedDownload(
            original_url=clean_url,
            download_url=primary_url,
            filename=single_filename if len(items) == 1 else bundle_filename,
            extension=".jpeg" if len(items) == 1 else ".zip",
            audio_url=None,
            headers=headers,
            source="instagram",
            items=items,
        )

    def resolve_video(
        self,
        clean_url: str,
        info: dict[str, Any],
        selected_indices: Optional[list[int]] = None,
    ) -> ResolvedDownload:
        """Resolve Instagram video(s) to normalized download contract."""
        title = sanitize_filename(info.get("title") or f"instagram_{info.get('id', 'reel')}")
        videos = info.get("videos") or []
        valid_videos = [v for v in videos if v.get("url")]
        if not valid_videos:
            raise InstagramNotFoundError("Không tìm thấy liên kết video để tải xuống.")

        if selected_indices is not None and len(selected_indices) > 0:
            filtered = [v for idx, v in enumerate(valid_videos) if idx in selected_indices]
            if filtered:
                valid_videos = filtered

        headers = self._get_headers()

        # If single video, return direct single file contract
        if len(valid_videos) == 1:
            return ResolvedDownload(
                original_url=clean_url,
                download_url=valid_videos[0]["url"],
                filename=f"{title}.mp4",
                extension=".mp4",
                audio_url=None,
                headers=headers,
                source="instagram",
            )

        # If multiple videos in carousel
        items: list[dict[str, Any]] = []
        for idx, v in enumerate(valid_videos):
            filename = f"{idx + 1:02d}_{title[:30].strip()}.mp4"
            items.append({
                "url": v["url"],
                "filename": filename,
                "type": "video",
            })

        return ResolvedDownload(
            original_url=clean_url,
            download_url=items[0]["url"],
            filename=f"{title}.zip",
            extension=".zip",
            audio_url=None,
            headers=headers,
            source="instagram",
            items=items,
        )

    def resolve_mixed(
        self,
        clean_url: str,
        info: dict[str, Any],
        selected_indices: Optional[list[int]] = None,
    ) -> ResolvedDownload:
        """Resolve Instagram mixed post (photos and videos) preserving original order."""
        title = sanitize_filename(info.get("title") or f"instagram_{info.get('id', 'mixed')}")
        ordered_items = info.get("items") or []

        if not ordered_items:
            # Fallback to combining photos and videos
            photos = info.get("photos") or []
            videos = info.get("videos") or []
            ordered_items = photos + videos

        valid_items = [it for it in ordered_items if it.get("url")]
        if not valid_items:
            raise InstagramNotFoundError("Không tìm thấy tệp phương tiện để tải xuống.")

        if selected_indices is not None and len(selected_indices) > 0:
            filtered = [it for idx, it in enumerate(valid_items) if idx in selected_indices]
            if filtered:
                valid_items = filtered

        raw_title = info.get("title") or ""
        post_id = str(info.get("id") or "mixed")

        # If after selection only 1 item remains
        if len(valid_items) == 1:
            single = valid_items[0]
            is_vid = single.get("type") == "video"
            if is_vid:
                ext = ".mp4"
                single_fname = f"{title}.mp4"
            else:
                ext = ".jpeg"
                single_fname = format_photo_download_filename("Instagram", raw_title, post_id, 1, ".jpeg")
            return ResolvedDownload(
                original_url=clean_url,
                download_url=single["url"],
                filename=single_fname,
                extension=ext,
                audio_url=None,
                headers=self._get_headers(),
                source="instagram",
            )

        items: list[dict[str, Any]] = []
        for idx, it in enumerate(valid_items):
            is_vid = it.get("type") == "video"
            if is_vid:
                filename = f"{idx + 1:02d}_{title[:30].strip()}.mp4"
            else:
                filename = format_photo_download_filename("Instagram", raw_title, post_id, idx + 1, ".jpeg")
            items.append({
                "url": it["url"],
                "filename": filename,
                "type": "video" if is_vid else "image",
            })

        return ResolvedDownload(
            original_url=clean_url,
            download_url=items[0]["url"],
            filename=f"{title}.zip",
            extension=".zip",
            audio_url=None,
            headers=self._get_headers(),
            source="instagram",
            items=items,
        )

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        """Dispatch resolution based on available media and user filters."""
        clean_url = url.strip()
        if not self.supports(clean_url):
            raise InstagramUnsupportedPostError("Liên kết không phải là bài viết Instagram hợp lệ.")

        info = await self._extractor.inspect(clean_url)
        has_video = info.get("has_video") or len(info.get("videos") or []) > 0
        has_photos = len(info.get("photos") or []) > 0
        post_type = info.get("type")

        # Explicit media_type filter
        if media_type == "video" and has_video:
            return self.resolve_video(clean_url, info, selected_indices=selected_indices)
        elif media_type in ("photo", "slideshow", "image") and has_photos:
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)

        # Automatic dispatch
        if post_type == "mixed" or (has_video and has_photos):
            return self.resolve_mixed(clean_url, info, selected_indices=selected_indices)
        if has_video:
            return self.resolve_video(clean_url, info, selected_indices=selected_indices)
        if has_photos:
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)

        raise InstagramNotFoundError("Bài viết này không chứa ảnh hoặc video có thể tải xuống.")
