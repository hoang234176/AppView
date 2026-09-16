"""Direct TikTok Web Scraper for posts, especially photo slideshows (/photo/).

Extracts itemStruct JSON directly from TikTok HTML without relying on yt-dlp,
enabling full support for photo posts and zero-watermark high-res images.
"""

from __future__ import annotations

import asyncio
import html
import json
import re
import ssl
from typing import Any, Optional
import urllib.request
import urllib.error

from logger import log_error, log_info
from services.tiktok.auth import classify_tiktok_error, TikTokError
from services.youtube.auth import create_cookiejar_from_netscape

# Mobile User-Agent triggers TikTok to render clean JSON inside <script id="api-data">
MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
)


class TikTokWebScraper:
    """Direct web scraper parsing embedded JSON from TikTok web pages."""

    async def scrape(self, url: str) -> dict[str, Any]:
        """Fetch and extract TikTok post metadata asynchronously."""
        from services.tiktok.auth import load_tiktok_cookies
        raw_cookies = await load_tiktok_cookies()

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._scrape_sync, url.strip(), raw_cookies)

    def _scrape_sync(self, url: str, raw_cookies: Optional[str] = None) -> dict[str, Any]:
        import http.cookiejar

        ssl_context = ssl._create_unverified_context()
        clean_opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ssl_context)
        )

        is_photo_url = "/photo/" in url.lower()
        cookie_jar = http.cookiejar.CookieJar()
        req_headers = {
            "User-Agent": MOBILE_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        has_cookies = False

        if raw_cookies:
            try:
                saved_jar = create_cookiejar_from_netscape(raw_cookies)
                if saved_jar:
                    for c in saved_jar:
                        cookie_jar.set_cookie(c)
                    cookie_pairs = [f"{c.name}={c.value}" for c in saved_jar if "tiktok.com" in getattr(c, "domain", "")]
                    if cookie_pairs:
                        req_headers["Cookie"] = "; ".join(cookie_pairs)
                        has_cookies = True
            except Exception:
                pass

        auth_opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ssl_context),
            urllib.request.HTTPCookieProcessor(cookie_jar),
        )

        # Guest-First policy: Luôn thử cào ở chế độ khách (guest session không cookie) trước cho tất cả bài viết.
        # Chỉ khi bài viết yêu cầu đăng nhập (401/403) hoặc không tìm thấy itemStruct mới nạp cookies để thử lại.
        primary_opener = clean_opener
        current_headers = {
            "User-Agent": MOBILE_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        }

        raw_html = ""
        try:
            req = urllib.request.Request(url, headers=current_headers)
            with primary_opener.open(req, timeout=15) as resp:
                raw_html = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as err:
            log_error("TIKTOK_SCRAPER", f"HTTP error {err.code} on {url}: {err.reason}")
            if err.code == 404:
                raise TikTokError(code="SOURCE_NOT_FOUND", message="Không tìm thấy bài viết TikTok hoặc bài viết đã bị xóa.")
            if err.code in (401, 403):
                if primary_opener == clean_opener and has_cookies:
                    # Nếu chế độ khách bị 401/403 (bài riêng tư/giới hạn tuổi), thử lại với auth_opener
                    try:
                        req_auth = urllib.request.Request(url, headers=req_headers)
                        with auth_opener.open(req_auth, timeout=15) as resp:
                            raw_html = resp.read().decode("utf-8", errors="replace")
                    except Exception:
                        raise TikTokError(code="SOURCE_AUTH_REQUIRED", message="Bài viết yêu cầu đăng nhập hoặc giới hạn độ tuổi.")
                else:
                    raise TikTokError(code="SOURCE_AUTH_REQUIRED", message="Bài viết yêu cầu đăng nhập hoặc giới hạn độ tuổi.")
            else:
                raise TikTokError(code="RESOLVE_FAILED", message=f"Lỗi kết nối máy chủ TikTok (HTTP {err.code}).")
        except Exception as err:
            log_error("TIKTOK_SCRAPER", f"Network error on {url}: {err}")
            raise TikTokError(code="RESOLVE_FAILED", message="Không thể kết nối đến TikTok.")

        item = self._extract_item_struct(raw_html)

        # Fallback 1: Nếu dùng auth_opener mà không thấy itemStruct, thử clean_opener (thực sự không gửi cookie)
        if not item and primary_opener == auth_opener:
            try:
                clean_headers = {
                    "User-Agent": MOBILE_USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                }
                req_fallback = urllib.request.Request(url, headers=clean_headers)
                with clean_opener.open(req_fallback, timeout=15) as resp:
                    raw_html = resp.read().decode("utf-8", errors="replace")
                item = self._extract_item_struct(raw_html)
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Fallback cào dữ liệu không cookie thất bại: {e}")

        # Fallback 2: Nếu dùng clean_opener mà không thấy itemStruct và có cookies, thử lại với auth_opener
        if not item and primary_opener == clean_opener and has_cookies:
            try:
                req_auth = urllib.request.Request(url, headers=req_headers)
                with auth_opener.open(req_auth, timeout=15) as resp:
                    raw_html = resp.read().decode("utf-8", errors="replace")
                item = self._extract_item_struct(raw_html)
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Fallback cào dữ liệu có cookie thất bại: {e}")

        if not item:
            raise TikTokError(code="RESOLVE_FAILED", message="Không tìm thấy cấu trúc dữ liệu của bài viết TikTok.")

        session_cookies: dict[str, str] = {c.name: c.value for c in cookie_jar}
        if session_cookies:
            try:
                from services.tiktok.auth import update_tiktok_session_cookies
                update_tiktok_session_cookies(session_cookies)
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Lỗi cập nhật session cookies: {e}")

        return self._format_item(item, raw_html, session_cookies=session_cookies)

    def _extract_item_struct(self, raw_html: str) -> Optional[dict[str, Any]]:
        """Find and parse JSON data from script tags."""
        # 1. Check <script id="api-data" type="application/json">
        m = re.search(r"<script id=\"api-data\" type=\"application/json\">(.*?)</script>", raw_html, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(1).strip())
                item = (
                    data.get("videoDetail", {}).get("itemInfo", {}).get("itemStruct")
                    or data.get("itemInfo", {}).get("itemStruct")
                    or data.get("itemStruct")
                )
                if item and isinstance(item, dict):
                    return item
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Lỗi parse api-data: {e}")

        # 2. Check <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" ...>
        m2 = re.search(r"<script id=\"__UNIVERSAL_DATA_FOR_REHYDRATION__\"[^>]*>(.*?)</script>", raw_html, re.DOTALL)
        if m2:
            try:
                data = json.loads(m2.group(1).strip())
                scope = data.get("__DEFAULT_SCOPE__", {})
                # Support both modern reflow structure (webapp.reflow.video.detail) and legacy (webapp.video-detail)
                detail = (
                    scope.get("webapp.reflow.video.detail")
                    or scope.get("webapp.video-detail")
                    or {}
                )
                item = detail.get("itemInfo", {}).get("itemStruct")
                if not item:
                    # Fallback: scan any scope key containing 'detail'
                    for k, v in scope.items():
                        if isinstance(v, dict) and "itemInfo" in v:
                            item = v.get("itemInfo", {}).get("itemStruct")
                            if item:
                                break
                if item and isinstance(item, dict):
                    return item
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Lỗi parse __UNIVERSAL_DATA_FOR_REHYDRATION__: {e}")

        # 3. Check SIGI_STATE
        m3 = re.search(r"<script id=\"SIGI_STATE\"[^>]*>(.*?)</script>", raw_html, re.DOTALL)
        if m3:
            try:
                data = json.loads(m3.group(1).strip())
                items = data.get("ItemModule", {})
                if items and isinstance(items, dict):
                    first_val = next(iter(items.values()))
                    if isinstance(first_val, dict):
                        return first_val
            except Exception as e:
                log_error("TIKTOK_SCRAPER", f"Lỗi parse SIGI_STATE: {e}")

        return None

    def _format_item(
        self,
        item: dict[str, Any],
        raw_html: str,
        session_cookies: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """Convert itemStruct into AppView TikTok standardized inspect schema."""
        post_id = str(item.get("id") or "")
        desc = str(item.get("desc") or "TikTok Post")
        author_info = item.get("author") or {}
        uploader = str(author_info.get("nickname") or author_info.get("uniqueId") or "")
        
        # Slideshow / Photo post detection - extract highest resolution original photos
        image_post = item.get("imagePost") or {}
        raw_images = image_post.get("images") or []
        slideshow_images: list[str] = []
        for img in raw_images:
            if isinstance(img, dict):
                # Prefer displayImage (original uncompressed photo), fallback to imageURL
                url_list = (
                    img.get("displayImage", {}).get("urlList")
                    or img.get("imageURL", {}).get("urlList")
                    or []
                )
                if url_list:
                    clean_u = html.unescape(url_list[0]).replace(r"\u002F", "/")
                    slideshow_images.append(clean_u)

        # If no images in imagePost, fallback to scanning photomode-image in HTML
        if not slideshow_images:
            photomode_matches = re.findall(r"https://[^\"]*photomode-image[^\"]*", raw_html)
            seen = set()
            for p in photomode_matches:
                clean_url = html.unescape(p).replace(r"\u002F", "/")
                if clean_url not in seen:
                    seen.add(clean_url)
                    slideshow_images.append(clean_url)

        # Covers / Thumbnails (used ONLY for preview thumbnail, never as downloadable post photos)
        covers: list[dict[str, str]] = []
        seen_covers = set()
        video_info = item.get("video") or {}

        for cover_key, label in [
            ("originCover", "Ảnh bìa gốc (originCover)"),
            ("cover", "Ảnh bìa tĩnh (cover)"),
            ("dynamicCover", "Ảnh bìa động (dynamicCover)"),
            ("reflowCover", "Ảnh bìa reflow"),
        ]:
            c_url = video_info.get(cover_key) or image_post.get(cover_key, {}).get("imageURL", {}).get("urlList", [None])[0]
            if c_url and isinstance(c_url, str) and c_url.startswith("http"):
                clean_c_url = html.unescape(c_url).replace(r"\u002F", "/")
                if clean_c_url not in seen_covers:
                    seen_covers.add(clean_c_url)
                    covers.append({"id": cover_key, "label": label, "url": clean_c_url})

        # Video streams
        raw_video = video_info.get("playAddr") or video_info.get("downloadAddr")
        video_url = html.unescape(raw_video).replace(r"\u002F", "/") if raw_video else None
        duration = item.get("duration") or video_info.get("duration") or 0
        has_video = bool(video_url)

        # All images containing ONLY actual slideshow photos (never covers)
        all_images: list[dict[str, str]] = []
        for idx, s_url in enumerate(slideshow_images):
            all_images.append({
                "id": f"photo_{idx + 1}",
                "type": "slideshow_photo",
                "label": f"Ảnh gốc #{idx + 1}",
                "url": s_url,
            })

        if has_video and len(slideshow_images) > 0:
            post_type = "mixed"
        elif len(slideshow_images) > 1:
            post_type = "slideshow"
        elif len(slideshow_images) == 1:
            post_type = "photo"
        elif has_video:
            post_type = "video"
        else:
            post_type = "unknown"

        headers_for_video = {
            "User-Agent": MOBILE_USER_AGENT,
            "Referer": "https://www.tiktok.com/",
        }

        video_formats: list[dict[str, Any]] = []

        # 1. Parse bitrateInfo if available from TikTok JSON (multiple bitrates / codecs)
        bitrate_info_list = video_info.get("bitrateInfo") or []
        for b_item in bitrate_info_list:
            if isinstance(b_item, dict):
                play_urls = b_item.get("PlayAddr", {}).get("UrlList") or []
                br = b_item.get("Bitrate") or 0
                codec = b_item.get("CodecType") or "h264"
                q_type = b_item.get("QualityType") or 0
                if play_urls:
                    clean_b_url = html.unescape(play_urls[0]).replace(r"\u002F", "/")
                    w = video_info.get("width", 0)
                    h = video_info.get("height", 0)
                    video_formats.append({
                        "format_id": f"bitrate_{br}_{codec}",
                        "vcodec": codec,
                        "tbr": br // 1000 if br else 0,
                        "bitrate": br,
                        "resolution": f"{w}x{h}",
                        "quality": 1080 if (h >= 1080 or q_type >= 20) else 720,
                        "url": clean_b_url,
                        "http_headers": dict(headers_for_video),
                    })

        # 2. Main direct_play and downloadAddr
        if video_url:
            br = video_info.get("bitrate") or 0
            w = video_info.get("width", 0)
            h = video_info.get("height", 0)
            video_formats.append({
                "format_id": "direct_play",
                "vcodec": "h264",
                "tbr": br // 1000 if br else 0,
                "bitrate": br,
                "resolution": f"{w}x{h}",
                "quality": 1080 if h >= 1080 else 720,
                "url": video_url,
                "http_headers": dict(headers_for_video),
            })
        raw_dl = video_info.get("downloadAddr")
        clean_dl = html.unescape(raw_dl).replace(r"\u002F", "/") if raw_dl else None
        if clean_dl and clean_dl != video_url:
            video_formats.append({
                "format_id": "download_addr",
                "vcodec": "h264",
                "tbr": (video_info.get("bitrate") or 0) // 1000,
                "resolution": f"{video_info.get('width', 0)}x{video_info.get('height', 0)}",
                "quality": 720,
                "url": clean_dl,
                "http_headers": dict(headers_for_video),
            })

        # Audio music
        music_info = item.get("music") or {}
        raw_audio = music_info.get("playUrl")
        audio_url = html.unescape(raw_audio).replace(r"\u002F", "/") if raw_audio else None

        return {
            "source": "tiktok",
            "type": post_type,
            "id": post_id,
            "title": desc,
            "uploader": uploader,
            "duration": duration,
            "thumbnail": covers[0]["url"] if covers else (slideshow_images[0] if slideshow_images else ""),
            "video_url": video_url,
            "video_formats": video_formats,
            "audio_url": audio_url,
            "covers": covers,
            "slideshow_images": slideshow_images,
            "all_images": all_images,
            "images": slideshow_images,
            "qualities": [],
            "session_cookies": session_cookies or {},
            "http_headers": headers_for_video,
            "raw_info": item,
        }
