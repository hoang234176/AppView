"""Public TikTok resolver implementing the DownloadResolver protocol."""

from __future__ import annotations

import re
from typing import Any, Optional
import urllib.parse

from archive.contracts import (
    DownloadResolver,
    ResolvedDownload,
    format_photo_download_filename,
    format_video_download_filename,
)
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
        # Chỉ trả về ảnh nội dung/gốc trong danh sách images (không trả về covers)
        slideshow_photos = [
            img for img in info.get("all_images", [])
            if img.get("type") == "slideshow_photo" or "photo" in str(img.get("id", ""))
        ]
        if not slideshow_photos and info.get("slideshow_images"):
            slideshow_photos = [
                {"id": f"photo_{i+1}", "type": "slideshow_photo", "label": f"Ảnh gốc #{i+1}", "url": u}
                for i, u in enumerate(info.get("slideshow_images", []))
            ]

        return {
            "source": "tiktok",
            "type": info.get("type", "video"),
            "title": info.get("title", "TikTok Post"),
            "thumbnail": info.get("thumbnail", ""),
            "uploader": info.get("uploader", ""),
            "qualities": info.get("qualities", []),
            "images": slideshow_photos,
            "has_video": bool(info.get("video_url")),
            "has_audio": bool(info.get("audio_url")),
        }
    def _build_cookie_header(self, info: dict[str, Any]) -> str:
        """Helper to build merged cookie string from fresh session cookies and saved login cookies."""
        session_cookies = info.get("session_cookies") or {}
        cookie_parts: list[str] = []
        seen_cookie_names: set[str] = set()

        for cname, cval in session_cookies.items():
            cookie_parts.append(f"{cname}={cval}")
            seen_cookie_names.add(cname)

        try:
            from services.tiktok.auth import read_tiktok_cookies_from_file
            raw_saved = read_tiktok_cookies_from_file()
            if raw_saved:
                for line in raw_saved.splitlines():
                    line = line.strip()
                    if line and not line.startswith("#"):
                        parts = line.split("\t")
                        if len(parts) >= 7:
                            cname, cval = parts[5], parts[6]
                            if cname not in seen_cookie_names:
                                cookie_parts.append(f"{cname}={cval}")
                                seen_cookie_names.add(cname)
        except Exception:
            pass

        return "; ".join(cookie_parts) if cookie_parts else ""

    def resolve_images(
        self,
        clean_url: str,
        info: dict[str, Any],
        selected_indices: Optional[list[int]] = None,
    ) -> ResolvedDownload:
        """Resolve photos/slideshow to normalized AppView download contracts (Tách riêng cho Ảnh)."""
        raw_title = info.get("title") or ""
        post_id = str(info.get("id") or "post")
        slideshow_images = info.get("slideshow_images") or []
        if not slideshow_images:
            slideshow_images = [
                img["url"] for img in info.get("all_images", [])
                if img.get("type") == "slideshow_photo" and img.get("url")
            ]
        if not slideshow_images and info.get("images"):
            slideshow_images = [
                (img["url"] if isinstance(img, dict) else str(img))
                for img in info.get("images", [])
                if (isinstance(img, dict) and img.get("type") == "slideshow_photo") or isinstance(img, str)
            ]

        if not slideshow_images:
            raise NoDownloadableMediaError("Không tìm thấy ảnh để tải xuống từ bài viết TikTok này.")

        if selected_indices is not None and len(selected_indices) > 0:
            valid_indices = [i for i in selected_indices if 0 <= i < len(slideshow_images)]
            if valid_indices:
                slideshow_images = [slideshow_images[i] for i in valid_indices]

        items: list[dict[str, Any]] = []
        for idx, img_url in enumerate(slideshow_images):
            filename = format_photo_download_filename("TikTok", raw_title, post_id, idx + 1, ".jpeg")
            items.append({
                "url": img_url,
                "filename": filename,
                "type": "image",
            })

        primary_url = items[0]["url"]
        cookie_header = self._build_cookie_header(info)
        image_headers: dict[str, str] = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Referer": "https://www.tiktok.com/",
        }
        if cookie_header:
            image_headers["Cookie"] = cookie_header

        single_filename = items[0]["filename"]
        clean_base = items[0]["filename"].rsplit("_", 1)[0]
        bundle_filename = f"{clean_base}.zip"

        return ResolvedDownload(
            original_url=clean_url,
            download_url=primary_url,
            filename=single_filename if len(items) == 1 else bundle_filename,
            extension=".jpeg" if len(items) == 1 else ".zip",
            audio_url=None,
            headers=image_headers,
            source="tiktok",
            items=items,
        )

    def resolve_video(
        self,
        clean_url: str,
        info: dict[str, Any],
        quality: Optional[int] = None,
    ) -> ResolvedDownload:
        raw_title = info.get("title") or ""
        post_id = str(info.get("id") or "post")
        title = sanitize_filename(raw_title or f"tiktok_{post_id}")
        video_url = info.get("video_url")
        formats = info.get("video_formats") or []
        chosen_format_headers: dict[str, str] = {}

        if quality is not None and formats:
            matched = [f for f in formats if f.get("quality") == quality]
            if matched:
                # Ưu tiên bitrate cao nhất trong độ phân giải đã chọn
                matched.sort(key=lambda x: x.get("tbr") or 0, reverse=True)
                video_url = matched[0]["url"]
                chosen_format_headers = matched[0].get("http_headers") or {}
            else:
                formats_with_quality = [f for f in formats if f.get("quality")]
                if formats_with_quality:
                    closest = min(formats_with_quality, key=lambda f: abs(f.get("quality", 0) - quality))
                    video_url = closest["url"]
                    chosen_format_headers = closest.get("http_headers") or {}
        elif formats:
            # Luôn ưu tiên bitrate cao nhất (Go backend Storage sẽ tự convert nếu cần)
            sorted_formats = sorted(formats, key=lambda x: (x.get("tbr") or 0, x.get("quality") or 0), reverse=True)
            video_url = sorted_formats[0]["url"]
            chosen_format_headers = sorted_formats[0].get("http_headers") or {}

        if not video_url:
            raise NoDownloadableMediaError("Không tìm thấy luồng video để tải xuống từ liên kết TikTok này.")

        format_headers = chosen_format_headers or info.get("http_headers") or {}
        ua = format_headers.get("User-Agent") or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        referer = format_headers.get("Referer") or "https://www.tiktok.com/"

        safe_headers: dict[str, str] = {
            "User-Agent": ua,
            "Referer": referer,
        }
        cookie_header = self._build_cookie_header(info)
        if cookie_header:
            safe_headers["Cookie"] = cookie_header

        filename = format_video_download_filename("TikTok", raw_title, post_id, ext=".mp4")
        return ResolvedDownload(
            original_url=clean_url,
            download_url=video_url,
            filename=filename,
            extension=".mp4",
            audio_url=info.get("audio_url"),
            headers=safe_headers,
            source="tiktok",
        )

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
        has_slides = len(info.get("slideshow_images") or []) > 0 or len(info.get("images") or []) > 0
        has_real_video = any(
            f.get("vcodec") and f.get("vcodec") != "none"
            for f in info.get("video_formats", [])
        ) or (bool(info.get("video_url")) and post_type not in ("photo", "slideshow"))

        # Phân luồng độc lập tuyệt đối giữa Tải Ảnh và Tải Video
        if media_type == "images":
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)
        elif media_type == "video":
            return self.resolve_video(clean_url, info, quality=quality)
        elif post_type in ("photo", "slideshow") or (has_slides and not has_real_video):
            # Bài đăng ảnh/slideshow -> Mặc định tải ảnh
            return self.resolve_images(clean_url, info, selected_indices=selected_indices)
        else:
            # Bài đăng video -> Tải video chất lượng/bitrate cao nhất
            return self.resolve_video(clean_url, info, quality=quality)
