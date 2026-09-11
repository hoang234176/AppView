"""Public TikTok resolver implementing the DownloadResolver protocol."""

from __future__ import annotations

import re
from typing import Any, Optional
import urllib.parse

from archive.contracts import DownloadResolver, ResolvedDownload
from services.tiktok.extractor import TikTokExtractor
from services.youtube.errors import NoDownloadableMediaError, UnsupportedSourceError

# Matches tiktok.com, www.tiktok.com, m.tiktok.com, vt.tiktok.com, vm.tiktok.com
TIKTOK_HOST_PATTERN = re.compile(
    r"^(?:(?:www\.|m\.|vt\.|vm\.)?tiktok\.com)$",
    re.IGNORECASE,
)


def sanitize_filename(name: str) -> str:
    """Sanitize title into a safe filename without path traversal or invalid characters."""
    name = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "tiktok_post"


class TikTokResolver(DownloadResolver):
    """Resolves TikTok URLs into normalized AppView download contracts."""

    def __init__(self, extractor: Optional[TikTokExtractor] = None):
        self._extractor = extractor or TikTokExtractor()

    def supports(self, url: str) -> bool:
        """Check if URL belongs to TikTok."""
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            return bool(TIKTOK_HOST_PATTERN.match(host))
        except Exception:
            return False

    async def preview(self, url: str) -> dict[str, Any]:
        """Return standardized preview metadata for TikTok video/photo posts."""
        clean_url = url.strip()
        if not self.supports(clean_url):
            raise UnsupportedSourceError("URL không phải là liên kết TikTok hợp lệ.")

        info = await self._extractor.inspect(clean_url)
        return {
            "source": "tiktok",
            "type": info.get("type", "video"),
            "title": info.get("title", "TikTok Post"),
            "thumbnail": info.get("thumbnail", ""),
            "uploader": info.get("uploader", ""),
            "qualities": info.get("qualities", []),
            "images": info.get("all_images", []),
            "has_video": bool(info.get("video_url")),
            "has_audio": bool(info.get("audio_url")),
        }

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        """Resolve TikTok post to normalized media descriptor for Storage download."""
        clean_url = url.strip()
        if not self.supports(clean_url):
            raise UnsupportedSourceError("URL không phải là liên kết TikTok hợp lệ.")

        info = await self._extractor.inspect(clean_url)
        post_type = info.get("type", "video")
        title = sanitize_filename(info.get("title") or f"tiktok_{info.get('id', 'post')}")
        safe_headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.tiktok.com/",
        }

        # Determine if downloading images:
        # User specified media_type == "images" or post has no video (slideshow/photo)
        is_images_download = media_type == "images" or (
            media_type != "video" and post_type in ("slideshow", "photo") and not info.get("video_url")
        )

        if is_images_download or (post_type in ("slideshow", "photo") and not info.get("video_url")):
            slideshow_images = info.get("slideshow_images") or []
            if not slideshow_images:
                slideshow_images = [
                    img["url"] for img in info.get("all_images", [])
                    if img.get("type") == "slideshow_photo" and img.get("url")
                ]
            if not slideshow_images and info.get("images"):
                slideshow_images = info.get("images")

            if not slideshow_images:
                raise NoDownloadableMediaError("Không tìm thấy ảnh để tải xuống từ bài viết TikTok này.")

            if selected_indices is not None and len(selected_indices) > 0:
                valid_indices = [i for i in selected_indices if 0 <= i < len(slideshow_images)]
                if valid_indices:
                    slideshow_images = [slideshow_images[i] for i in valid_indices]

            items: list[dict[str, Any]] = []
            for idx, img_url in enumerate(slideshow_images):
                filename = f"{idx + 1:02d}_{title[:30].strip()}.jpeg"
                items.append({
                    "url": img_url,
                    "filename": filename,
                    "type": "image",
                })

            primary_url = items[0]["url"]
            return ResolvedDownload(
                original_url=clean_url,
                download_url=primary_url,
                filename=title,
                extension=".jpeg" if len(items) == 1 else ".zip",
                audio_url=None,
                headers=safe_headers,
                source="tiktok",
                items=items,
            )

        # Video download
        video_url = info.get("video_url")
        formats = info.get("video_formats") or []
        if quality is not None and formats:
            matched = [f for f in formats if f.get("quality") == quality]
            if matched:
                video_url = matched[0]["url"]
            else:
                formats_with_quality = [f for f in formats if f.get("quality")]
                if formats_with_quality:
                    closest = min(formats_with_quality, key=lambda f: abs(f.get("quality", 0) - quality))
                    video_url = closest["url"]

        if not video_url:
            raise NoDownloadableMediaError("Không tìm thấy luồng video để tải xuống từ liên kết TikTok này.")

        filename = f"{title}.mp4"
        return ResolvedDownload(
            original_url=clean_url,
            download_url=video_url,
            filename=filename,
            extension=".mp4",
            audio_url=info.get("audio_url"),
            headers=safe_headers,
            source="tiktok",
        )
