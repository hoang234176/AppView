"""TikTok extractor leveraging yt-dlp to inspect videos and photo slideshows."""

from __future__ import annotations

import asyncio
from functools import partial
import html
import threading
from typing import Any, Optional
import yt_dlp
import yt_dlp.cookies

from logger import log_error, log_event, log_info
from services.resolution import compute_video_resolution
from services.tiktok.auth import classify_tiktok_error, update_tiktok_session_cookies
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


class _YtDlpQuietLogger:
    """Quiet logger for yt-dlp to suppress console error output during fallback attempts."""

    def debug(self, msg: str) -> None:
        pass

    def info(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        pass

    def error(self, msg: str) -> None:
        pass


class TikTokExtractor:
    """Extracts metadata, formats, and images for TikTok posts via yt-dlp."""

    async def inspect(self, url: str) -> dict[str, Any]:
        """Inspect a TikTok URL and return structured metadata along with raw info."""
        clean_url = url.strip()

        # Nếu liên kết là bài đăng ảnh (/photo/), ưu tiên TikTokWebScraper để lấy trọn vẹn ảnh gốc chất lượng cao
        if "/photo/" in clean_url.lower():
            try:
                from services.tiktok.scraper import TikTokWebScraper
                res = await TikTokWebScraper().scrape(clean_url)
                if res and (res.get("slideshow_images") or res.get("images")):
                    return res
            except Exception as err:
                log_info("TIKTOK_EXTRACTOR", f"TikTokWebScraper không thành công cho link photo ({err}), chuyển sang yt-dlp...")

        # Thử yt-dlp (chuẩn hóa /photo/ thành /video/ nếu cần)
        ytdlp_url = clean_url
        if "/photo/" in clean_url.lower():
            import re
            ytdlp_url = re.sub(r"/photo/", "/video/", clean_url, flags=re.IGNORECASE)

        try:
            res = await self._inspect_via_ytdlp(ytdlp_url)
            has_real_video = any(
                f.get("vcodec") and f.get("vcodec") != "none"
                for f in res.get("video_formats", [])
            )
            has_photos = len(res.get("slideshow_images") or []) > 0
            # Nếu yt-dlp trả về nhưng không có video thực thụ (chỉ audio) và không có ảnh, fallback sang scraper
            if not has_real_video and not has_photos:
                log_info("TIKTOK_EXTRACTOR", "yt-dlp không tìm thấy video/ảnh hợp lệ, chuyển sang TikTokWebScraper...")
                from services.tiktok.scraper import TikTokWebScraper
                return await TikTokWebScraper().scrape(clean_url)
            return res
        except Exception as err:
            log_info("TIKTOK_EXTRACTOR", f"yt-dlp không thành công ({err}), chuyển sang TikTokWebScraper...")
            try:
                from services.tiktok.scraper import TikTokWebScraper
                return await TikTokWebScraper().scrape(clean_url)
            except Exception as scraper_err:
                log_error("TIKTOK_EXTRACTOR", f"Cả yt-dlp và TikTokWebScraper đều thất bại: {scraper_err}")
                raise err

    async def _inspect_via_ytdlp(self, clean_url: str) -> dict[str, Any]:
        cancel_event = threading.Event()
        finished = threading.Event()
        ydl_ref: list[Optional[yt_dlp.YoutubeDL]] = [None]
        loop = asyncio.get_running_loop()

        # Step 1 (Guest-First Policy): Luôn thử qua yt-dlp ẩn danh không cookie trước
        try:
            future = loop.run_in_executor(
                None,
                partial(self._extract_sync, cookiejar=None),
                clean_url,
                cancel_event,
                ydl_ref,
                finished,
            )
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
        except Exception as err:
            err_msg = str(err).lower()
            if not any(k in err_msg for k in ["login", "sign in", "auth", "private", "age"]):
                raise
            log_info("TIKTOK_EXTRACTOR", f"yt-dlp yêu cầu xác thực ({err}), kiểm tra và nạp cookies TikTok...")

        # Step 2: Chỉ khi video yêu cầu đăng nhập mới nạp cookie và thử lại
        cookiejar = None
        try:
            from services.tiktok.auth import load_tiktok_cookies
            raw_cookies = await load_tiktok_cookies()
            if raw_cookies:
                cookiejar = create_cookiejar_from_netscape(raw_cookies)
        except Exception as err:
            log_error("TIKTOK_EXTRACTOR", f"Lỗi nạp cookie TikTok: {err}")
            cookiejar = None

        if not cookiejar:
            from services.tiktok.auth import TikTokError
            raise TikTokError(code="SOURCE_AUTH_REQUIRED", message="Bài viết yêu cầu đăng nhập. Vui lòng cấu hình cookies TikTok.")

        cancel_event = threading.Event()
        finished = threading.Event()
        ydl_ref = [None]
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
            "logger": _YtDlpQuietLogger(),
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

            session_cookies: dict[str, str] = {}
            if ydl.cookiejar is not None:
                for d, ddict in getattr(ydl.cookiejar, "_cookies", {}).items():
                    for p, pdict in ddict.items():
                        for cname, c in pdict.items():
                            if hasattr(c, "value"):
                                session_cookies[cname] = c.value

            if session_cookies:
                try:
                    update_tiktok_session_cookies(session_cookies)
                except Exception as e:
                    log_error("TIKTOK_EXTRACTOR", f"Lỗi cập nhật session cookies: {e}")

            return self._process_info(info_dict, session_cookies=session_cookies)
        except Exception as err:
            if cancel_event.is_set():
                raise asyncio.CancelledError()
            raise classify_tiktok_error(str(err)) from err
        finally:
            finished.set()

    def _process_info(
        self,
        info: dict[str, Any],
        session_cookies: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
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
        all_video_formats: list[dict[str, Any]] = []

        for f in formats:
            if not isinstance(f, dict):
                continue
            vcodec = str(f.get("vcodec") or "none").lower()
            if vcodec == "none":
                continue

            has_video = True
            width = f.get("width")
            height = f.get("height")
            norm = compute_video_resolution(width, height)
            if norm is not None and norm > 0:
                qualities_set.add(norm)

            f_url = f.get("url")
            if not f_url:
                continue

            tbr = float(f.get("tbr") or f.get("vbr") or 0.0)
            stream_entry = {
                "format_id": str(f.get("format_id") or ""),
                "vcodec": vcodec,
                "acodec": str(f.get("acodec") or "").lower(),
                "resolution": f"{width}x{height}" if width and height else (f.get("resolution") or ""),
                "quality": norm,
                "tbr": tbr,
                "url": f_url,
                "http_headers": f.get("http_headers") or info.get("http_headers") or {},
            }
            all_video_formats.append(stream_entry)

        # Luôn ưu tiên luồng có bitrate cao nhất (tbr) tuyệt đối, bất kể codec vì Go Storage có cơ chế convert
        all_video_formats.sort(key=lambda x: (x.get("tbr") or 0, x.get("quality") or 0), reverse=True)
        best_headers: dict[str, str] = {}
        if all_video_formats:
            video_url = all_video_formats[0]["url"]
            best_headers = all_video_formats[0].get("http_headers") or {}
        else:
            video_url = info.get("url")
            best_headers = info.get("http_headers") or {}

        if video_url:
            video_url = html.unescape(video_url).replace(r"\u002F", "/")

        if not has_video and (info.get("duration") or info.get("ext") == "mp4"):
            if info.get("url") and not info.get("url", "").endswith((".jpg", ".png", ".webp")):
                has_video = True

        # Thu thập ảnh nội dung bài viết (ảnh thật / gốc từ entries hoặc formats)
        slideshow_images: list[str] = []
        seen_slides: set[str] = set()

        def add_slide(s_url: Optional[str]) -> None:
            if s_url and isinstance(s_url, str) and s_url.startswith("http"):
                clean = html.unescape(s_url).replace(r"\u002F", "/")
                if clean not in seen_slides:
                    seen_slides.add(clean)
                    slideshow_images.append(clean)

        entries = info.get("entries")
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict):
                    entry_url = entry.get("url")
                    if entry_url:
                        add_slide(entry_url)
                    else:
                        for thumb in entry.get("thumbnails") or []:
                            if isinstance(thumb, dict) and thumb.get("url"):
                                add_slide(thumb.get("url"))
                                break

        for fmt in formats:
            if isinstance(fmt, dict):
                fmt_id = str(fmt.get("format_id") or "").lower()
                ext = str(fmt.get("ext") or "").lower()
                if ext in ("jpg", "jpeg", "png", "webp") or "photo" in fmt_id or "image" in fmt_id:
                    add_slide(fmt.get("url"))

        # Nếu không có video và chưa tìm thấy ảnh từ entries/formats (bài chỉ có 1 ảnh), fallback về thumbnails
        if not has_video and not slideshow_images:
            for t in info.get("thumbnails") or []:
                if isinstance(t, dict) and t.get("url"):
                    add_slide(t.get("url"))
            if not slideshow_images and info.get("thumbnail"):
                add_slide(info.get("thumbnail"))

        # Thu thập các ảnh bìa / thumbnail (dynamicCover, cover, originCover)
        # Dùng làm thumbnail xem trước bài viết, tuyệt đối không đưa vào all_images tải về
        covers: list[dict[str, str]] = []
        seen_cover_urls: set[str] = set()
        raw_thumbnails = info.get("thumbnails") or []
        for i, t in enumerate(raw_thumbnails):
            if isinstance(t, dict) and t.get("url"):
                t_url = html.unescape(t.get("url")).replace(r"\u002F", "/")
                cid = str(t.get("id") or f"cover_{i+1}")
                # Chỉ coi là cover nếu là bài video hoặc id/url có chữ cover
                if t_url not in seen_cover_urls and (has_video or "cover" in cid.lower()):
                    seen_cover_urls.add(t_url)
                    covers.append({
                        "id": cid,
                        "label": f"Ảnh bìa / Cover ({cid})",
                        "url": t_url,
                    })

        if not covers and info.get("thumbnail"):
            t_url = html.unescape(info.get("thumbnail")).replace(r"\u002F", "/")
            if t_url not in seen_cover_urls:
                seen_cover_urls.add(t_url)
                covers.append({
                    "id": "thumbnail",
                    "label": "Ảnh bìa đại diện",
                    "url": t_url,
                })

        # Danh sách ảnh bài viết - chỉ chứa ảnh nội dung/gốc (tuyệt đối không đưa ảnh bìa/covers vào đây)
        all_images: list[dict[str, str]] = []
        for idx, s_url in enumerate(slideshow_images):
            all_images.append({
                "id": f"photo_{idx + 1}",
                "type": "slideshow_photo",
                "label": f"Ảnh gốc #{idx + 1}",
                "url": s_url,
            })

        images = list(slideshow_images)

        if has_video and len(slideshow_images) > 0:
            post_type = "mixed"
        elif has_video:
            post_type = "video"
        elif len(slideshow_images) > 1:
            post_type = "slideshow"
        elif len(slideshow_images) == 1:
            post_type = "photo"
        else:
            post_type = "video" if has_video else "unknown"

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
            "session_cookies": session_cookies or {},
            "http_headers": best_headers,
            "raw_info": sanitized_info,
        }
