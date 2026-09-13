"""Instagram media extractor supporting photos, videos, and mixed carousels.

Strictly follows the repository's guest-first policy:
1. Attempt extraction without cookies.
2. If HTTP 403 / auth required is returned, load cookies from ~/.tmp-appview/cookies/instagram.txt and retry.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
import json
import re
import ssl
from typing import Any, Optional
import urllib.error
import urllib.parse
import urllib.request

import yt_dlp

from logger import log_error, log_event, log_info, log_warning
from services.instagram.auth import (
    create_cookiejar_from_netscape,
    load_instagram_cookies,
    parse_cookies_to_header,
    update_instagram_session_cookies_from_headers,
)
from services.instagram.errors import (
    InstagramAuthRequiredError,
    InstagramError,
    InstagramNotFoundError,
    InstagramUnsupportedPostError,
)

_BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def shortcode_to_media_id(shortcode: str) -> int:
    """Convert an Instagram shortcode (e.g. C-5w4tFvFv-) to a numeric media ID."""
    clean = shortcode.strip()
    if len(clean) > 28:
        clean = clean[:-28]
    media_id = 0
    for char in clean:
        if char not in _BASE64_CHARS:
            continue
        media_id = (media_id * 64) + _BASE64_CHARS.index(char)
    return media_id


def parse_instagram_url(url: str) -> tuple[str, str]:
    """Extract post kind ('p', 'reel', 'tv') and shortcode from Instagram URL."""
    clean = url.strip()
    # Match /p/{shortcode}, /reel/{shortcode}, /reels/{shortcode}, /tv/{shortcode}
    m = re.search(r"/(?:p|reel|reels|tv|share/(?:p|reel))/([a-zA-Z0-9_-]+)", clean)
    if m:
        shortcode = m.group(1)
        kind = "video" if "/reel" in clean or "/tv" in clean else "post"
        return kind, shortcode
    raise InstagramUnsupportedPostError(f"Không nhận diện được mã bài viết từ URL Instagram: {url}")


def sanitize_raw_info(data: Any, depth: int = 0) -> Any:
    """Recursively sanitize dictionary data so tokens or secrets never leak."""
    if depth > 8:
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
        return [sanitize_raw_info(item, depth + 1) for item in data[:50]]
    return data


def format_timestamp(ts: Optional[int]) -> str:
    """Format a Unix epoch timestamp into human-readable date string."""
    if not ts or ts <= 0:
        return "Không rõ thời gian"
    try:
        dt = datetime.fromtimestamp(ts)
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return str(ts)


class _YtDlpQuietLogger:
    """Quiet logger for yt-dlp to avoid console noise."""
    def debug(self, msg: str) -> None: pass
    def info(self, msg: str) -> None: pass
    def warning(self, msg: str) -> None: pass
    def error(self, msg: str) -> None: pass


class InstagramExtractor:
    """Extracts post metadata, photos, videos, and mixed media from Instagram posts."""

    def __init__(self, custom_cookies: Optional[str] = None):
        self._custom_cookies = custom_cookies

    def _get_cookie_header(self) -> str:
        if self._custom_cookies:
            return parse_cookies_to_header(self._custom_cookies)
        return ""

    async def inspect(self, url: str) -> dict[str, Any]:
        """Asynchronously extract post info following the guest-first flow:
        Step 1: Read without cookie (anonymous). If 403 or auth required ->
        Step 2: Load cookies from Go storage via Coordinator and retry in-memory.
        """
        _, shortcode = parse_instagram_url(url)
        canonical_url = f"https://www.instagram.com/p/{shortcode}/"

        execution_steps: list[dict[str, Any]] = []

        # =========================================================================
        # Bước 1: Đọc bài viết ẩn danh (không cookie)
        # =========================================================================
        log_info("INSTAGRAM_EXTRACTOR", f"[Bước 1] Thử đọc bài viết ẩn danh (không cookie) cho shortcode: {shortcode}")
        step1_info = {
            "step": 1,
            "name": "Đọc bài viết không cookie (Ẩn danh / Guest)",
            "status": "pending",
            "http_code": None,
            "message": "Đang gửi yêu cầu đọc bài viết ở chế độ khách...",
        }
        execution_steps.append(step1_info)

        data = None
        step1_error_reason = None
        is_403_or_auth_error = False
        loop = asyncio.get_running_loop()

        try:
            data = await loop.run_in_executor(None, self._fetch_via_direct_apis, shortcode, "")
            if data:
                step1_info["status"] = "success"
                step1_info["http_code"] = 200
                step1_info["message"] = "Đọc dữ liệu bài viết thành công ở chế độ khách (không cần cookie)."
        except urllib.error.HTTPError as http_err:
            step1_info["http_code"] = http_err.code
            step1_error_reason = f"HTTP {http_err.code} {http_err.reason}"
            if http_err.code in (401, 403):
                is_403_or_auth_error = True
                step1_info["status"] = "failed"
                step1_info["message"] = f"Instagram trả về {http_err.code} Forbidden (yêu cầu đăng nhập)."
            else:
                step1_info["status"] = "failed"
                step1_info["message"] = f"Instagram trả về lỗi HTTP {http_err.code}."
        except InstagramAuthRequiredError as auth_err:
            is_403_or_auth_error = True
            step1_info["status"] = "failed"
            step1_info["http_code"] = 403
            step1_info["message"] = f"Bài viết yêu cầu đăng nhập: {auth_err}"
        except Exception as err:
            step1_info["status"] = "failed"
            step1_error_reason = str(err)
            step1_info["message"] = f"Yêu cầu ẩn danh không thành công: {err}"
            if "403" in str(err) or "login" in str(err).lower() or "auth" in str(err).lower():
                is_403_or_auth_error = True

        # =========================================================================
        # Bước 2: Nạp cookie từ Go storage nếu Bước 1 gặp 403
        # =========================================================================
        if not data and is_403_or_auth_error:
            log_info("INSTAGRAM_EXTRACTOR", "[Bước 2] Bước 1 báo 403/yêu cầu login. Tiến hành nạp cookie Instagram từ Go storage...")
            step2_info = {
                "step": 2,
                "name": "Nạp cookie Instagram từ Go storage",
                "status": "pending",
                "message": "Đang nạp cookie Instagram từ hệ thống lưu trữ...",
            }
            execution_steps.append(step2_info)

            raw_cookies = self._custom_cookies
            if not raw_cookies:
                raw_cookies = await load_instagram_cookies()

            cookie_header = parse_cookies_to_header(raw_cookies) if raw_cookies else ""
            if not cookie_header:
                step2_info["status"] = "failed"
                step2_info["message"] = (
                    "Bài viết yêu cầu 403 Forbidden nhưng chưa tìm thấy cookie Instagram trong hệ thống lưu trữ. "
                    "Vui lòng nhập các trường cookie (sessionid, ds_user_id...) và nhấn 'Lưu Cookie' trước khi thử lại."
                )
                raise InstagramAuthRequiredError(step2_info["message"])

            try:
                data = await loop.run_in_executor(None, self._fetch_via_direct_apis, shortcode, cookie_header)
                if data:
                    step2_info["status"] = "success"
                    step2_info["message"] = "Đã nạp cookie thành công và lấy được đầy đủ thông tin bài viết."
            except Exception as err:
                log_warning("INSTAGRAM_EXTRACTOR", f"Direct API với cookie thất bại ({err}), thử tiếp qua yt-dlp...")
                # Try fallback via yt-dlp with in-memory cookiejar
                try:
                    data = await loop.run_in_executor(None, self._fetch_via_ytdlp, canonical_url, raw_cookies)
                    if data:
                        step2_info["status"] = "success"
                        step2_info["message"] = "Đã nạp cookie thành công qua yt-dlp engine."
                except Exception as ytdl_err:
                    step2_info["status"] = "failed"
                    step2_info["message"] = f"Lỗi đọc bài viết kể cả khi đã nạp cookie: {ytdl_err}"
                    raise InstagramAuthRequiredError(f"Không thể đọc bài viết Instagram với cookie: {ytdl_err}")

        # Fallback if unauthenticated yt-dlp can read public posts when direct API returned non-403
        if not data:
            raw_cookies = self._custom_cookies or await load_instagram_cookies()
            try:
                data = await loop.run_in_executor(None, self._fetch_via_ytdlp, canonical_url, raw_cookies)
            except Exception as e:
                log_error("INSTAGRAM_EXTRACTOR", f"Hoàn toàn không thể trích xuất bài viết Instagram: {e}")
                raise InstagramNotFoundError(f"Không thể đọc bài viết Instagram ({shortcode}): {e}")

        # Normalize parsed data into 3 supported cases
        return self._normalize_post(data, shortcode, canonical_url, execution_steps)

    def _fetch_via_direct_apis(self, shortcode: str, cookie_header: str = "") -> dict[str, Any]:
        """Query Instagram GraphQL or REST media info endpoints."""
        media_id = shortcode_to_media_id(shortcode)
        ssl_ctx = ssl._create_unverified_context()

        base_headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "X-IG-App-ID": "936619743392459",
            "Accept": "*/*",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://www.instagram.com/",
        }
        if cookie_header:
            base_headers["Cookie"] = cookie_header

        # Endpoint 1: GraphQL query
        gql_vars = urllib.parse.quote(json.dumps({"shortcode": shortcode}, separators=(",", ":")))
        gql_url = f"https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables={gql_vars}"
        try:
            req = urllib.request.Request(gql_url, headers=base_headers)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
                set_cookies = resp.headers.get_all("Set-Cookie") or []
                if set_cookies:
                    update_instagram_session_cookies_from_headers(set_cookies)
                if resp.status == 200:
                    raw_bytes = resp.read()
                    parsed = json.loads(raw_bytes.decode("utf-8", errors="ignore"))
                    media = (parsed.get("data") or {}).get("xdt_shortcode_media")
                    if media:
                        return {"type": "graphql", "data": media}
        except urllib.error.HTTPError as err:
            set_cookies = err.headers.get_all("Set-Cookie") or []
            if set_cookies:
                update_instagram_session_cookies_from_headers(set_cookies)
            if err.code in (401, 403):
                raise InstagramAuthRequiredError(f"GraphQL API trả về HTTP {err.code} Forbidden.")
            log_info("INSTAGRAM_EXTRACTOR", f"GraphQL API HTTP {err.code}, tiếp tục thử REST API...")
        except Exception as e:
            log_info("INSTAGRAM_EXTRACTOR", f"GraphQL API lỗi: {e}")

        # Endpoint 2: REST Media Info API
        rest_url = f"https://i.instagram.com/api/v1/media/{media_id}/info/"
        mobile_headers = {
            **base_headers,
            "User-Agent": "Instagram 320.0.0.18.109 (iPhone14,3; iOS 17_0; en_US; en-US; scale=3.00; 1284x2778; 576974247)",
            "X-IG-App-ID": "124024574287414",
        }
        try:
            req = urllib.request.Request(rest_url, headers=mobile_headers)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
                set_cookies = resp.headers.get_all("Set-Cookie") or []
                if set_cookies:
                    update_instagram_session_cookies_from_headers(set_cookies)
                final_url = resp.geturl().lower()
                if "/login" in final_url:
                    raise InstagramAuthRequiredError("Yêu cầu đăng nhập (bị chuyển hướng login).")
                if resp.status == 200:
                    raw = resp.read().decode("utf-8", errors="ignore")
                    if raw.strip().startswith("{"):
                        parsed = json.loads(raw)
                        items = parsed.get("items") or []
                        if items:
                            return {"type": "rest", "data": items[0]}
        except urllib.error.HTTPError as err:
            set_cookies = err.headers.get_all("Set-Cookie") or []
            if set_cookies:
                update_instagram_session_cookies_from_headers(set_cookies)
            if err.code in (401, 403):
                raise InstagramAuthRequiredError(f"REST API trả về HTTP {err.code} Forbidden.")
            raise

        raise InstagramNotFoundError("Không lấy được dữ liệu bài viết qua direct API.")

    def _fetch_via_ytdlp(self, url: str, raw_cookies: Optional[str] = None) -> dict[str, Any]:
        """Fallback extraction using yt-dlp strictly in-memory without accessing or writing cookie files."""
        ydl_opts: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "logger": _YtDlpQuietLogger(),
            "extract_flat": False,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            if raw_cookies:
                jar = create_cookiejar_from_netscape(raw_cookies)
                if jar is not None:
                    ydl.cookiejar = jar
            info = ydl.extract_info(url, download=False)
            if not info:
                raise InstagramNotFoundError("yt-dlp không trả về thông tin bài viết.")
            return {"type": "ytdlp", "data": info}

    def _normalize_post(
        self,
        raw_payload: dict[str, Any],
        shortcode: str,
        canonical_url: str,
        execution_steps: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Normalize raw Instagram data into the standard AppView contract supporting the 3 cases:
        1. Only Photos (1 or multiple) -> type: "photo"
        2. Only Videos -> type: "video"
        3. Both Photos and Videos -> type: "mixed"
        """
        payload_type = raw_payload.get("type")
        raw_data = raw_payload.get("data") or {}

        title = ""
        content = ""
        uploader = "Người dùng Instagram"
        author = {
            "id": "",
            "username": "",
            "full_name": "",
            "avatar": "",
            "is_verified": False,
        }
        timestamp = 0
        reactions = {
            "likes": 0,
            "comments": 0,
            "views": 0,
        }

        photos: list[dict[str, Any]] = []
        videos: list[dict[str, Any]] = []
        ordered_items: list[dict[str, Any]] = []

        if payload_type == "graphql":
            # xdt_shortcode_media
            owner = raw_data.get("owner") or {}
            avatar = (
                owner.get("profile_pic_url_hd")
                or owner.get("profile_pic_url")
                or (owner.get("hd_profile_pic_url_info") or {}).get("url")
                or ""
            )
            author = {
                "id": str(owner.get("id") or ""),
                "username": owner.get("username") or "",
                "name": owner.get("full_name") or owner.get("username") or "",
                "full_name": owner.get("full_name") or owner.get("username") or "",
                "avatar": avatar,
                "is_verified": bool(owner.get("is_verified")),
            }
            uploader = author["username"] or author["full_name"]

            # Caption text
            cap_edges = (raw_data.get("edge_media_to_caption") or {}).get("edges") or []
            if cap_edges:
                content = (cap_edges[0].get("node") or {}).get("text") or ""
            title = content[:80].strip() if content else f"Bài viết Instagram của @{uploader}"

            # Timestamp & counts
            timestamp = int(raw_data.get("taken_at_timestamp") or 0)
            reactions["likes"] = int((raw_data.get("edge_media_preview_like") or {}).get("count") or 0)
            reactions["comments"] = int((raw_data.get("edge_media_to_parent_comment") or {}).get("count") or 0)
            reactions["views"] = int(raw_data.get("video_view_count") or 0)

            # Check carousel vs single
            typename = raw_data.get("__typename") or ""
            children_edges = (raw_data.get("edge_sidecar_to_children") or {}).get("edges") or []

            if children_edges:
                # Carousel items
                for idx, edge in enumerate(children_edges):
                    node = edge.get("node") or {}
                    is_vid = bool(node.get("is_video") or node.get("__typename") == "GraphVideo")
                    dim = node.get("dimensions") or {}
                    width = dim.get("width")
                    height = dim.get("height")

                    if is_vid:
                        v_url = node.get("video_url")
                        thumb = node.get("display_url")
                        dur = node.get("video_duration") or 0
                        v_resources = node.get("video_resources") or []
                        if v_resources:
                            best_v = max(v_resources, key=lambda r: ((r.get("config_width") or 0) * (r.get("config_height") or 0)))
                            v_url = best_v.get("src") or v_url
                            width = best_v.get("config_width") or width
                            height = best_v.get("config_height") or height
                        vid_obj = {
                            "index": idx,
                            "type": "video",
                            "url": v_url,
                            "thumbnail": thumb,
                            "width": width,
                            "height": height,
                            "duration": dur,
                        }
                        videos.append(vid_obj)
                        ordered_items.append(vid_obj)
                    else:
                        img_url = node.get("display_url")
                        # Pick highest resolution display resource if available
                        d_resources = node.get("display_resources") or []
                        if d_resources:
                            best_d = max(d_resources, key=lambda r: ((r.get("config_width") or 0) * (r.get("config_height") or 0)))
                            img_url = best_d.get("src") or img_url
                            width = best_d.get("config_width") or width
                            height = best_d.get("config_height") or height
                        img_obj = {
                            "index": idx,
                            "type": "photo",
                            "url": img_url,
                            "thumbnail": img_url,
                            "width": width,
                            "height": height,
                        }
                        photos.append(img_obj)
                        ordered_items.append(img_obj)
            else:
                # Single item
                is_vid = bool(raw_data.get("is_video") or typename == "GraphVideo")
                dim = raw_data.get("dimensions") or {}
                width = dim.get("width")
                height = dim.get("height")
                if is_vid:
                    v_url = raw_data.get("video_url")
                    thumb = raw_data.get("display_url")
                    dur = raw_data.get("video_duration") or 0
                    v_resources = raw_data.get("video_resources") or []
                    if v_resources:
                        best_v = max(v_resources, key=lambda r: ((r.get("config_width") or 0) * (r.get("config_height") or 0)))
                        v_url = best_v.get("src") or v_url
                        width = best_v.get("config_width") or width
                        height = best_v.get("config_height") or height
                    vid_obj = {
                        "index": 0,
                        "type": "video",
                        "url": v_url,
                        "thumbnail": thumb,
                        "width": width,
                        "height": height,
                        "duration": dur,
                    }
                    videos.append(vid_obj)
                    ordered_items.append(vid_obj)
                else:
                    img_url = raw_data.get("display_url")
                    d_resources = raw_data.get("display_resources") or []
                    if d_resources:
                        best_d = max(d_resources, key=lambda r: ((r.get("config_width") or 0) * (r.get("config_height") or 0)))
                        img_url = best_d.get("src") or img_url
                        width = best_d.get("config_width") or width
                        height = best_d.get("config_height") or height
                    img_obj = {
                        "index": 0,
                        "type": "photo",
                        "url": img_url,
                        "thumbnail": img_url,
                        "width": width,
                        "height": height,
                    }
                    photos.append(img_obj)
                    ordered_items.append(img_obj)

        elif payload_type == "rest":
            # REST item
            user = raw_data.get("user") or {}
            avatar = (
                (user.get("hd_profile_pic_url_info") or {}).get("url")
                or user.get("profile_pic_url")
                or (user.get("hd_profile_pic_versions") or [{}])[0].get("url")
                or ""
            )
            author = {
                "id": str(user.get("pk") or ""),
                "username": user.get("username") or "",
                "name": user.get("full_name") or user.get("username") or "",
                "full_name": user.get("full_name") or user.get("username") or "",
                "avatar": avatar,
                "is_verified": bool(user.get("is_verified")),
            }
            uploader = author["username"] or author["full_name"]
            content = (raw_data.get("caption") or {}).get("text") or ""
            title = content[:80].strip() if content else f"Bài viết Instagram của @{uploader}"
            timestamp = int(raw_data.get("taken_at") or 0)
            reactions["likes"] = int(raw_data.get("like_count") or 0)
            reactions["comments"] = int(raw_data.get("comment_count") or 0)
            reactions["views"] = int(raw_data.get("view_count") or 0)

            carousel = raw_data.get("carousel_media") or []
            if carousel:
                for idx, c_item in enumerate(carousel):
                    m_type = c_item.get("media_type")  # 1: Photo, 2: Video
                    if m_type == 2:
                        v_versions = c_item.get("video_versions") or []
                        v_sorted = sorted(
                            v_versions,
                            key=lambda v: (
                                (v.get("width") or 0) * (v.get("height") or 0),
                                v.get("bandwidth") or 0,
                                v.get("bitrate") or 0,
                            ),
                            reverse=True,
                        )
                        best_v = v_sorted[0] if v_sorted else {}
                        v_url = best_v.get("url") or ""
                        candidates = (c_item.get("image_versions2") or {}).get("candidates") or []
                        thumb = candidates[0]["url"] if candidates else ""
                        vid_obj = {
                            "index": idx,
                            "type": "video",
                            "url": v_url,
                            "thumbnail": thumb,
                            "width": best_v.get("width"),
                            "height": best_v.get("height"),
                            "bitrate": best_v.get("bandwidth") or best_v.get("bitrate"),
                            "duration": c_item.get("video_duration") or 0,
                        }
                        videos.append(vid_obj)
                        ordered_items.append(vid_obj)
                    else:
                        candidates = (c_item.get("image_versions2") or {}).get("candidates") or []
                        c_sorted = sorted(
                            candidates,
                            key=lambda c: ((c.get("width") or 0) * (c.get("height") or 0)),
                            reverse=True,
                        )
                        best_c = c_sorted[0] if c_sorted else {}
                        img_url = best_c.get("url") or ""
                        img_obj = {
                            "index": idx,
                            "type": "photo",
                            "url": img_url,
                            "thumbnail": img_url,
                            "width": best_c.get("width"),
                            "height": best_c.get("height"),
                        }
                        photos.append(img_obj)
                        ordered_items.append(img_obj)
            else:
                m_type = raw_data.get("media_type")
                if m_type == 2:
                    v_versions = raw_data.get("video_versions") or []
                    v_sorted = sorted(
                        v_versions,
                        key=lambda v: (
                            (v.get("width") or 0) * (v.get("height") or 0),
                            v.get("bandwidth") or 0,
                            v.get("bitrate") or 0,
                        ),
                        reverse=True,
                    )
                    best_v = v_sorted[0] if v_sorted else {}
                    v_url = best_v.get("url") or ""
                    candidates = (raw_data.get("image_versions2") or {}).get("candidates") or []
                    thumb = candidates[0]["url"] if candidates else ""
                    vid_obj = {
                        "index": 0,
                        "type": "video",
                        "url": v_url,
                        "thumbnail": thumb,
                        "width": best_v.get("width"),
                        "height": best_v.get("height"),
                        "bitrate": best_v.get("bandwidth") or best_v.get("bitrate"),
                        "duration": raw_data.get("video_duration") or 0,
                    }
                    videos.append(vid_obj)
                    ordered_items.append(vid_obj)
                else:
                    candidates = (raw_data.get("image_versions2") or {}).get("candidates") or []
                    c_sorted = sorted(
                        candidates,
                        key=lambda c: ((c.get("width") or 0) * (c.get("height") or 0)),
                        reverse=True,
                    )
                    best_c = c_sorted[0] if c_sorted else {}
                    img_url = best_c.get("url") or ""
                    img_obj = {
                        "index": 0,
                        "type": "photo",
                        "url": img_url,
                        "thumbnail": img_url,
                        "width": best_c.get("width"),
                        "height": best_c.get("height"),
                    }
                    photos.append(img_obj)
                    ordered_items.append(img_obj)

        else:
            # yt-dlp dictionary
            uploader = raw_data.get("uploader") or raw_data.get("channel") or uploader
            avatar = (
                raw_data.get("uploader_thumbnail")
                or raw_data.get("channel_thumbnail")
                or (raw_data.get("channel_thumbnails") or [{}])[0].get("url")
                or ""
            )
            author = {
                "id": str(raw_data.get("uploader_id") or ""),
                "username": raw_data.get("channel") or raw_data.get("uploader") or "",
                "name": raw_data.get("uploader") or raw_data.get("channel") or "",
                "full_name": raw_data.get("uploader") or "",
                "avatar": avatar,
                "is_verified": False,
            }
            content = raw_data.get("description") or ""
            title = raw_data.get("title") or content[:80] or f"Bài viết Instagram của @{uploader}"
            timestamp = int(raw_data.get("timestamp") or 0)
            reactions["likes"] = int(raw_data.get("like_count") or 0)
            reactions["comments"] = int(raw_data.get("comment_count") or 0)
            reactions["views"] = int(raw_data.get("view_count") or 0)

            entries = raw_data.get("entries") or []
            if entries:
                for idx, entry in enumerate(entries):
                    vcodec = entry.get("vcodec") or ""
                    ext = entry.get("ext") or ""
                    formats = entry.get("formats") or []
                    v_formats = [f for f in formats if f.get("vcodec") != "none" and f.get("url")]
                    is_vid = vcodec != "none" or ext == "mp4" or bool(v_formats) or bool(entry.get("video_duration"))
                    if is_vid:
                        v_url = entry.get("url")
                        width = entry.get("width")
                        height = entry.get("height")
                        bitrate = None
                        # Prefer progressive formats that contain audio (exclude DASH video-only formats where acodec == 'none')
                        formats_with_audio = [f for f in v_formats if f.get("acodec") != "none"]
                        target_formats = formats_with_audio if formats_with_audio else v_formats
                        if target_formats:
                            best_vf = max(
                                target_formats,
                                key=lambda f: (
                                    (f.get("width") or 0) * (f.get("height") or 0),
                                    f.get("tbr") or f.get("vbr") or 0,
                                ),
                            )
                            v_url = best_vf.get("url") or v_url
                            width = best_vf.get("width") or width
                            height = best_vf.get("height") or height
                            bitrate = int(best_vf.get("tbr") or best_vf.get("vbr") or 0)
                        vid_obj = {
                            "index": idx,
                            "type": "video",
                            "url": v_url,
                            "thumbnail": entry.get("thumbnail"),
                            "width": width,
                            "height": height,
                            "bitrate": bitrate,
                            "duration": entry.get("duration") or 0,
                        }
                        videos.append(vid_obj)
                        ordered_items.append(vid_obj)
                    else:
                        img_url = entry.get("url") or entry.get("thumbnail")
                        width = entry.get("width")
                        height = entry.get("height")
                        thumbnails = entry.get("thumbnails") or []
                        if thumbnails:
                            best_t = max(thumbnails, key=lambda t: ((t.get("width") or 0) * (t.get("height") or 0)))
                            img_url = best_t.get("url") or img_url
                            width = best_t.get("width") or width
                            height = best_t.get("height") or height
                        img_obj = {
                            "index": idx,
                            "type": "photo",
                            "url": img_url,
                            "thumbnail": img_url,
                            "width": width,
                            "height": height,
                        }
                        photos.append(img_obj)
                        ordered_items.append(img_obj)
            else:
                vcodec = raw_data.get("vcodec") or ""
                ext = raw_data.get("ext") or ""
                formats = raw_data.get("formats") or []
                v_formats = [f for f in formats if f.get("vcodec") != "none" and f.get("url")]
                is_vid = vcodec != "none" or ext == "mp4" or bool(v_formats) or bool(raw_data.get("duration"))
                if is_vid:
                    v_url = raw_data.get("url")
                    width = raw_data.get("width")
                    height = raw_data.get("height")
                    bitrate = None
                    formats_with_audio = [f for f in v_formats if f.get("acodec") != "none"]
                    target_formats = formats_with_audio if formats_with_audio else v_formats
                    if target_formats:
                        best_vf = max(
                            target_formats,
                            key=lambda f: (
                                (f.get("width") or 0) * (f.get("height") or 0),
                                f.get("tbr") or f.get("vbr") or 0,
                            ),
                        )
                        v_url = best_vf.get("url") or v_url
                        width = best_vf.get("width") or width
                        height = best_vf.get("height") or height
                        bitrate = int(best_vf.get("tbr") or best_vf.get("vbr") or 0)
                    vid_obj = {
                        "index": 0,
                        "type": "video",
                        "url": v_url,
                        "thumbnail": raw_data.get("thumbnail"),
                        "width": width,
                        "height": height,
                        "bitrate": bitrate,
                        "duration": raw_data.get("duration") or 0,
                    }
                    videos.append(vid_obj)
                    ordered_items.append(vid_obj)
                else:
                    img_url = raw_data.get("url") or raw_data.get("thumbnail")
                    width = raw_data.get("width")
                    height = raw_data.get("height")
                    thumbnails = raw_data.get("thumbnails") or []
                    if thumbnails:
                        best_t = max(thumbnails, key=lambda t: ((t.get("width") or 0) * (t.get("height") or 0)))
                        img_url = best_t.get("url") or img_url
                        width = best_t.get("width") or width
                        height = best_t.get("height") or height
                    img_obj = {
                        "index": 0,
                        "type": "photo",
                        "url": img_url,
                        "thumbnail": img_url,
                        "width": width,
                        "height": height,
                    }
                    photos.append(img_obj)
                    ordered_items.append(img_obj)

        # Determine exact media case:
        # Case 1: Photo only (1 or multiple photos)
        # Case 2: Video only (1 or multiple videos)
        # Case 3: Mixed (both photos and videos exist!)
        num_photos = len(photos)
        num_videos = len(videos)

        if num_photos > 0 and num_videos > 0:
            post_type = "mixed"
        elif num_videos > 0:
            post_type = "video"
        else:
            post_type = "photo"

        # Construct primary thumbnail
        primary_thumbnail = ""
        if ordered_items:
            primary_thumbnail = ordered_items[0].get("thumbnail") or ordered_items[0].get("url") or ""
        elif photos:
            primary_thumbnail = photos[0].get("thumbnail") or photos[0].get("url") or ""
        elif videos:
            primary_thumbnail = videos[0].get("thumbnail") or ""

        # Construct preview image items for AppView format compatibility:
        # ONLY actual photos must be included in preview images, NOT video thumbnails!
        # If the post is purely video(s), images must be empty so the UI does not show a photo tab or download option.
        preview_images: list[dict[str, Any]] = []
        if num_photos > 0:
            for idx, p in enumerate(photos):
                preview_images.append({
                    "id": f"ig_{shortcode}_{idx + 1}",
                    "url": p.get("thumbnail") or p.get("url") or "",
                    "label": f"Ảnh #{idx + 1}",
                    "type": "photo",
                })

        return {
            "source": "instagram",
            "id": shortcode,
            "url": canonical_url,
            "type": post_type,
            "title": title or f"Instagram @{uploader}",
            "author": author,
            "uploader": uploader,
            "content": content,
            "created_time": format_timestamp(timestamp),
            "timestamp": timestamp,
            "reactions": reactions,
            "photos": photos,
            "videos": videos,
            "items": ordered_items,
            "images": preview_images,
            "qualities": [],
            "has_photos": num_photos > 0,
            "has_video": num_videos > 0,
            "has_audio": num_videos > 0,
            "thumbnail": primary_thumbnail,
            "execution_steps": execution_steps,
            "raw_info": {
                "shortcode": shortcode,
                "photos_count": num_photos,
                "videos_count": num_videos,
                "media_type": post_type,
                "execution_steps": execution_steps,
            },
        }
