"""TikTok extractor leveraging yt-dlp to inspect videos and photo slideshows."""

from __future__ import annotations

import asyncio
from functools import partial
import threading
from typing import Any, Optional
import yt_dlp
import yt_dlp.cookies

from logger import log_error, log_event, log_info
from services.resolution import compute_video_resolution
from services.tiktok.auth import classify_tiktok_error
from services.youtube.auth import create_cookiejar_from_netscape


def sanitize_raw_info(data: Any, depth: int = 0) -> Any:
    """Recursively sanitize dictionary data to ensure no secret tokens or cookies leak."""
    if depth > 10:
        return "<max_depth_reached>"
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            lower_key = str(key).lower()
            if any(secret in lower_key for secret in [
                "cookie", "token", "password", "secret", "authorization", "session", "auth"
            ]):
                cleaned[key] = "[REDACTED]"
            elif lower_key == "http_headers":
                cleaned[key] = {
                    h: ("[REDACTED]" if any(s in str(h).lower() for s in ["cookie", "auth", "token"]) else val)
                    for h, val in (value.items() if isinstance(value, dict) else [])
                }
            else:
                cleaned[key] = sanitize_raw_info(value, depth + 1)
        return cleaned
    elif isinstance(data, list):
        return [sanitize_raw_info(item, depth + 1) for item in data]
    return data


class TikTokExtractor:
    """Extracts metadata, formats, and images for TikTok posts via yt-dlp."""

    async def inspect(self, url: str) -> dict[str, Any]:
        """Inspect a TikTok URL and return structured metadata along with raw info."""
        clean_url = url.strip()

        # Nếu là bài viết ảnh /photo/, chuyển thẳng tới TikTokWebScraper để lấy ảnh chất lượng cao
        if "/photo/" in clean_url.lower():
            from services.tiktok.scraper import TikTokWebScraper
            return await TikTokWebScraper().scrape(clean_url)

        try:
            return await self._inspect_via_ytdlp(clean_url)
        except Exception as err:
            log_info("TIKTOK_EXTRACTOR", f"yt-dlp không thành công ({err}), chuyển sang TikTokWebScraper...")
            try:
                from services.tiktok.scraper import TikTokWebScraper
                return await TikTokWebScraper().scrape(clean_url)
            except Exception:
                raise err

    async def _inspect_via_ytdlp(self, clean_url: str) -> dict[str, Any]:
        cookiejar = None
        try:
            from services.tiktok.auth import load_tiktok_cookies
            raw_cookies = await load_tiktok_cookies()
            if raw_cookies:
                cookiejar = create_cookiejar_from_netscape(raw_cookies)
        except Exception as err:
            log_error("TIKTOK_EXTRACTOR", f"Lỗi nạp cookie TikTok: {err}")
            cookiejar = None

        cancel_event = threading.Event()
        finished = threading.Event()
        ydl_ref: list[Optional[yt_dlp.YoutubeDL]] = [None]

        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(
            None,
            partial(self._extract_sync, cookiejar=cookiejar),
            clean_url,
            cancel_event,
            ydl_ref,
            finished,
        )

        try:
            return await future
        except asyncio.CancelledError:
            cancel_event.set()
            ydl = ydl_ref[0]
            if ydl is not None:
                try:
                    ydl.close()
                except Exception:
                    pass
            loop.run_in_executor(None, lambda: finished.wait(timeout=1.5))
            raise

    def _extract_sync(
        self,
        url: str,
        cancel_event: threading.Event,
        ydl_ref: list[Optional[yt_dlp.YoutubeDL]],
        finished: threading.Event,
        cookiejar: Optional[yt_dlp.cookies.YoutubeDLCookieJar] = None,
    ) -> dict[str, Any]:
        ydl_opts: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
            "socket_timeout": 20,
            "noplaylist": True,
        }

        try:
            ydl = yt_dlp.YoutubeDL(ydl_opts)
            ydl_ref[0] = ydl
            if cookiejar is not None:
                ydl.cookiejar = cookiejar

            if cancel_event.is_set():
                raise asyncio.CancelledError()

            info_dict = ydl.extract_info(url, download=False)
            if not info_dict:
                raise ValueError("Không tìm thấy dữ liệu từ liên kết TikTok.")

            return self._process_info(info_dict)
        except Exception as err:
            if cancel_event.is_set():
                raise asyncio.CancelledError()
            log_error("TIKTOK_EXTRACTOR", f"Lỗi extract TikTok: {err}")
            raise classify_tiktok_error(str(err)) from err
        finally:
            finished.set()

    def _process_info(self, info: dict[str, Any]) -> dict[str, Any]:
        """Analyze info_dict and classify as video or slideshow with extracted images."""
        images: list[str] = []
        seen_images: set[str] = set()

        def add_image(img_url: Optional[str]) -> None:
            if img_url and isinstance(img_url, str) and img_url.startswith("http") and img_url not in seen_images:
                seen_images.add(img_url)
                images.append(img_url)

        # 1. Scan formats to determine if video streams exist
        formats = info.get("formats") or []
        has_video = False
        qualities_set: set[int] = set()
        video_url: Optional[str] = info.get("url")
        best_tbr = -1.0

        all_video_formats: list[dict[str, Any]] = []
        h264_formats: list[dict[str, Any]] = []

        for fmt in formats:
            if not isinstance(fmt, dict):
                continue
            fmt_url = fmt.get("url")
            vcodec = str(fmt.get("vcodec") or "").lower()
            acodec = str(fmt.get("acodec") or "").lower()
            width = fmt.get("width")
            height = fmt.get("height")
            tbr = float(fmt.get("tbr") or fmt.get("vbr") or 0)
            format_id = str(fmt.get("format_id") or "")

            if vcodec and vcodec != "none":
                has_video = True
                norm = compute_video_resolution(width, height)
                if norm is not None and norm > 0:
                    qualities_set.add(norm)
                
                stream_entry = {
                    "format_id": format_id,
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "resolution": f"{width}x{height}" if width and height else (fmt.get("resolution") or ""),
                    "quality": norm,
                    "tbr": tbr,
                    "url": fmt_url,
                }
                all_video_formats.append(stream_entry)
                # Ưu tiên H.264 vì tất cả trình duyệt (Chrome, Safari, Firefox) đều giải mã được HTML5 <video>
                if "h264" in vcodec or "avc" in vcodec:
                    h264_formats.append(stream_entry)

        # Chọn video_url tối ưu cho trình duyệt:
        # Nếu có H.264 -> chọn luồng H.264 có bitrate cao nhất
        # Nếu không có H.264 -> fallback về video có bitrate cao nhất hoặc info.url
        if h264_formats:
            h264_formats.sort(key=lambda x: x["tbr"], reverse=True)
            video_url = h264_formats[0]["url"]
        elif all_video_formats:
            all_video_formats.sort(key=lambda x: x["tbr"], reverse=True)
            video_url = all_video_formats[0]["url"]
        else:
            video_url = info.get("url")

        if not has_video and (info.get("duration") or info.get("ext") == "mp4"):
            if info.get("url") and not info.get("url", "").endswith((".jpg", ".png", ".webp")):
                has_video = True

        # Thu thập các ảnh bìa / thumbnail (dynamicCover, cover, originCover)
        covers: list[dict[str, str]] = []
        seen_cover_urls: set[str] = set()
        raw_thumbnails = info.get("thumbnails") or []
        for i, t in enumerate(raw_thumbnails):
            if isinstance(t, dict) and t.get("url"):
                t_url = t.get("url")
                if t_url not in seen_cover_urls:
                    seen_cover_urls.add(t_url)
                    cid = t.get("id") or f"cover_{i+1}"
                    covers.append({
                        "id": str(cid),
                        "label": f"Ảnh bìa / Cover ({cid})",
                        "url": t_url,
                    })

        if not covers and info.get("thumbnail"):
            t_url = info.get("thumbnail")
            seen_cover_urls.add(t_url)
            covers.append({
                "id": "thumbnail",
                "label": "Ảnh bìa đại diện",
                "url": t_url,
            })

        # Thu thập ảnh nội dung bài viết (nếu có từ entries hoặc formats ảnh)
        slideshow_images: list[str] = []
        seen_slides: set[str] = set()

        def add_slide(s_url: Optional[str]) -> None:
            if s_url and isinstance(s_url, str) and s_url.startswith("http") and s_url not in seen_slides and s_url not in seen_cover_urls:
                seen_slides.add(s_url)
                slideshow_images.append(s_url)

        entries = info.get("entries")
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict):
                    add_slide(entry.get("url"))
                    for thumb in entry.get("thumbnails") or []:
                        if isinstance(thumb, dict):
                            add_slide(thumb.get("url"))

        for fmt in formats:
            if isinstance(fmt, dict) and fmt.get("ext") in ("jpg", "jpeg", "png", "webp"):
                add_slide(fmt.get("url"))

        # Tổng hợp toàn bộ ảnh với phân loại rõ ràng (ảnh nội dung vs ảnh bìa)
        all_images: list[dict[str, str]] = []
        for idx, s_url in enumerate(slideshow_images):
            all_images.append({
                "id": f"photo_{idx + 1}",
                "type": "slideshow_photo",
                "label": f"Ảnh nội dung #{idx + 1}",
                "url": s_url,
            })
        for idx, c in enumerate(covers):
            all_images.append({
                "id": c.get("id") or f"cover_{idx + 1}",
                "type": "cover",
                "label": c["label"],
                "url": c["url"],
            })

        images = [item["url"] for item in all_images]

        if has_video and len(slideshow_images) > 0:
            post_type = "mixed"
        elif has_video:
            post_type = "video"
        elif len(slideshow_images) > 1:
            post_type = "slideshow"
        elif len(slideshow_images) == 1:
            post_type = "photo"
        elif len(covers) > 0:
            post_type = "video" if has_video else "photo"
        else:
            post_type = "unknown"

        qualities = sorted(qualities_set, reverse=True)
        sanitized_info = sanitize_raw_info(info)

        return {
            "source": "tiktok",
            "type": post_type,
            "id": str(info.get("id") or ""),
            "title": str(info.get("title") or info.get("description") or "TikTok Post"),
            "uploader": str(info.get("uploader") or info.get("creator") or info.get("channel") or ""),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail") or (covers[0]["url"] if covers else ""),
            "video_url": video_url if has_video else None,
            "video_formats": all_video_formats,
            "covers": covers,
            "slideshow_images": slideshow_images,
            "all_images": all_images,
            "images": images,
            "qualities": qualities,
            "raw_info": sanitized_info,
        }
