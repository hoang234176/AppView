"""Facebook resolver implementing DownloadResolver protocol.

Provides separate and decoupled resolve paths for Facebook photos and videos.
"""

from __future__ import annotations

import re
from typing import Any, Optional
import urllib.parse

from archive.contracts import DownloadResolver, ResolvedDownload
from logger import log_error, log_info
from services.facebook.errors import FacebookNotFoundError, FacebookUnsupportedPostError
from services.facebook.extractor import FacebookExtractor, clean_facebook_url

FACEBOOK_HOST_PATTERN = re.compile(
    r"^(?:(?:www\.|m\.|mbasic\.|web\.)?facebook\.com|fb\.watch|fb\.com|fb\.me)$",
    re.IGNORECASE,
)


def sanitize_filename(name: str) -> str:
    """Sanitize title into a safe filename without path traversal or invalid characters."""
    name = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "facebook_post"


class FacebookResolver(DownloadResolver):
    """Resolves Facebook posts into normalized AppView download contracts."""

    def __init__(self, extractor: Optional[FacebookExtractor] = None):
        self._extractor = extractor or FacebookExtractor()

    def supports(self, url: str) -> bool:
        """Check if URL belongs to Facebook."""
        if not url or not isinstance(url, str):
            return False
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            return bool(FACEBOOK_HOST_PATTERN.match(host))
        except Exception:
            return False

    async def preview(self, url: str) -> dict[str, Any]:
        """Return full structured preview metadata for Facebook posts."""
        if not self.supports(url):
            raise FacebookUnsupportedPostError("Liên kết không phải là bài viết Facebook hợp lệ.")
        return await self._extractor.inspect(url)

    def resolve_images(
        self,
        clean_url: str,
        info: dict[str, Any],
        selected_indices: Optional[list[int]] = None,
    ) -> ResolvedDownload:
        """Resolve Facebook photos to normalized download contract (Tách riêng cho Ảnh)."""
        title = sanitize_filename(info.get("title") or f"facebook_{info.get('id', 'post')}")
        photos = info.get("photos") or []
        photo_urls = [p["url"] for p in photos if p.get("url")]

        if not photo_urls:
            raw_imgs = info.get("images") or []
            for item in raw_imgs:
                if isinstance(item, dict) and item.get("url"):
                    photo_urls.append(item["url"])
                elif isinstance(item, str) and item.startswith("http"):
                    photo_urls.append(item)

        if not photo_urls:
            raise FacebookNotFoundError("Không tìm thấy ảnh để tải xuống từ bài viết Facebook này.")

        if selected_indices is not None and len(selected_indices) > 0:
            valid_indices = [i for i in selected_indices if 0 <= i < len(photo_urls)]
            if valid_indices:
                photo_urls = [photo_urls[i] for i in valid_indices]

        items: list[dict[str, Any]] = []
        for idx, img_url in enumerate(photo_urls):
            filename = f"{idx + 1:02d}_{title[:30].strip()}.jpeg"
            items.append({
                "url": img_url,
                "filename": filename,
                "type": "image",
            })

        primary_url = items[0]["url"]
        image_headers: dict[str, str] = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Referer": "https://www.facebook.com/",
        }
        cookie_header = self._extractor._get_cookie_header()
        if cookie_header:
            image_headers["Cookie"] = cookie_header

        return ResolvedDownload(
            original_url=clean_url,
            download_url=primary_url,
            filename=f"{title}.jpeg" if len(items) == 1 else f"{title}.zip",
            extension=".jpeg" if len(items) == 1 else ".zip",
            audio_url=None,
            headers=image_headers,
            source="facebook",
            items=items,
        )

    def resolve_video(
        self,
        clean_url: str,
        info: dict[str, Any],
        quality: Optional[int] = None,
    ) -> ResolvedDownload:
        """Resolve Facebook video to normalized download contract (Tách riêng cho Video)."""
        title = sanitize_filename(info.get("title") or f"facebook_{info.get('id', 'post')}")
        videos = info.get("videos") or []

        if not videos:
            raise FacebookNotFoundError("Không tìm thấy luồng video để tải xuống từ bài viết Facebook này.")

        chosen_video: Optional[dict[str, Any]] = None
        if quality is not None:
            matched = [v for v in videos if v.get("quality") == quality]
            if matched:
                chosen_video = matched[0]
            else:
                closest = min(videos, key=lambda v: abs((v.get("quality") or 0) - quality))
                chosen_video = closest
        else:
            # Mặc định chọn chất lượng cao nhất (HD)
            chosen_video = max(videos, key=lambda v: v.get("quality") or 0)

        video_url = chosen_video["url"]
        video_headers: dict[str, str] = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Referer": "https://www.facebook.com/",
        }
        cookie_header = self._extractor._get_cookie_header()
        if cookie_header:
            video_headers["Cookie"] = cookie_header

        filename = f"{title}.mp4"
        return ResolvedDownload(
            original_url=clean_url,
            download_url=video_url,
            filename=filename,
            extension=".mp4",
            audio_url=None,
            headers=video_headers,
            source="facebook",
        )

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        """Dispatch resolution to resolve_images or resolve_video independently."""
        clean_url = clean_facebook_url(url)
        if not self.supports(clean_url):
            raise FacebookUnsupportedPostError("Liên kết không phải là bài viết Facebook hợp lệ.")

        info = await self._extractor.inspect(clean_url)
        has_video = info.get("has_video") or len(info.get("videos") or []) > 0
        has_photos = len(info.get("photos") or []) > 0

        # Dispatch based on explicit media_type or available content
        if media_type == "video" and has_video:
            return self.resolve_video(clean_url, info, quality=quality)
        elif media_type in ("photo", "slideshow", "image") and has_photos:
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)

        if has_photos:
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)
        elif has_video:
            return self.resolve_video(clean_url, info, quality=quality)

        raise FacebookNotFoundError("Bài viết này không chứa ảnh hoặc video có thể tải xuống.")
