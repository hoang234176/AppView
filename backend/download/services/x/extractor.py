"""X (Twitter) post extractor.

Fetches post metadata, text, author details, photos, and video variants
without requiring user credentials or API keys (Guest-First policy).
"""

from __future__ import annotations

import asyncio
import json
import math
import re
import ssl
from typing import Any, Optional
import urllib.parse
import urllib.request

from archive.contracts import format_photo_download_filename, format_video_download_filename
from logger import log_error, log_info, log_warning
from services.x.errors import (
    XAuthRequiredError,
    XNotFoundError,
    XPostError,
    XRateLimitError,
    XUnsupportedUrlError,
)

X_STATUS_URL_PATTERN = re.compile(
    r"(?:https?://)?(?:(?:www\.|mobile\.)?(?:twitter\.com|x\.com))/[^/]+/status/(\d+)",
    re.IGNORECASE,
)


def sanitize_filename(name: str) -> str:
    """Sanitize title into a safe filename without path traversal or invalid characters."""
    name = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "x_post"


def calculate_twitter_token(status_id: str) -> str:
    """Compute the syndication token required by cdn.syndication.twimg.com."""
    try:
        val = (float(status_id) / 1e15) * math.pi
        chars = "0123456789abcdefghijklmnopqrstuvwxyz"
        int_part = int(val)
        frac_part = val - int_part
        int_str = ""
        if int_part == 0:
            int_str = "0"
        else:
            temp = int_part
            while temp > 0:
                int_str = chars[temp % 36] + int_str
                temp //= 36
        frac_str = ""
        for _ in range(11):
            frac_part *= 36
            d = int(frac_part)
            frac_str += chars[d]
            frac_part -= d
        full = int_str + frac_str
        return "".join(c for c in full if c not in ("0", "."))
    except Exception:
        return "x"


class XExtractor:
    """Extracts metadata, author, text, images, and videos from X (Twitter) posts."""

    def __init__(self):
        self._ssl_ctx = ssl._create_unverified_context()

    @staticmethod
    def extract_status_id(url: str) -> Optional[str]:
        """Extract the numeric status ID from an X or Twitter URL."""
        if not url or not isinstance(url, str):
            return None
        match = X_STATUS_URL_PATTERN.search(url.strip())
        if match:
            return match.group(1)
        return None

    async def inspect(self, url: str, cookies: Optional[str] = None) -> dict[str, Any]:
        """Asynchronously inspect an X post and return structured data."""
        clean_url = url.strip()
        status_id = self.extract_status_id(clean_url)
        if not status_id:
            raise XUnsupportedUrlError(f"Không thể nhận diện ID bài viết từ URL: {clean_url}")

        raw_cookies = cookies
        if not raw_cookies:
            try:
                from services.x.auth import load_x_cookies
                raw_cookies = await load_x_cookies()
            except Exception:
                raw_cookies = None

        from services.x.auth import parse_cookies_to_header
        cookie_header = parse_cookies_to_header(raw_cookies) if raw_cookies else ""

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._inspect_sync, clean_url, status_id, cookie_header)

    def _fetch_graphql_sync(self, status_id: str, cookie_header: str = "") -> Optional[dict[str, Any]]:
        """Fetch tweet detail via Twitter Web GraphQL API (supports NSFW, 18+, age-restricted, and sensitive tweets)."""
        if not cookie_header:
            return None

        from services.x.auth import parse_cookies_to_dict, TWITTER_WEB_BEARER
        cookie_dict = parse_cookies_to_dict(cookie_header)
        ct0 = cookie_dict.get("ct0", "")
        if not ct0:
            import secrets
            ct0 = secrets.token_hex(16)
            cookie_dict["ct0"] = ct0
            cookie_header = "; ".join(f"{k}={v}" for k, v in cookie_dict.items())

        variables = {
            "tweetId": status_id,
            "withCommunity": False,
            "includePromotedContent": False,
            "withVoice": False,
        }
        features = {
            "creator_subscriptions_tweet_preview_api_enabled": True,
            "tweetypie_unmention_optimization_enabled": True,
            "responsive_web_edit_tweet_api_enabled": True,
            "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
            "view_counts_everywhere_api_enabled": True,
            "longform_notetweets_consumption_enabled": True,
            "responsive_web_twitter_article_tweet_consumption_enabled": False,
            "tweet_awards_web_tipping_enabled": False,
            "freedom_of_speech_not_reach_fetch_enabled": True,
            "standardized_nudges_misinfo": True,
            "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
            "longform_notetweets_rich_text_read_enabled": True,
            "longform_notetweets_inline_media_enabled": True,
            "responsive_web_graphql_exclude_directive_enabled": True,
            "verified_phone_label_enabled": False,
            "responsive_web_media_download_video_enabled": False,
            "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
            "responsive_web_graphql_timeline_navigation_enabled": True,
            "responsive_web_enhance_cards_enabled": False,
        }
        field_toggles = {"withArticleRichContentState": False}

        params = urllib.parse.urlencode({
            "variables": json.dumps(variables, separators=(",", ":")),
            "features": json.dumps(features, separators=(",", ":")),
            "fieldToggles": json.dumps(field_toggles, separators=(",", ":")),
        })

        url = f"https://x.com/i/api/graphql/2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId?{params}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Authorization": TWITTER_WEB_BEARER,
                "Cookie": cookie_header,
                "x-csrf-token": ct0,
                "x-twitter-active-user": "yes",
                "x-twitter-auth-type": "OAuth2Session",
                "x-twitter-client-language": "en",
                "Origin": "https://x.com",
                "Referer": "https://x.com/",
            },
        )

        try:
            with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=12) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8", errors="ignore"))
                    tweet_result = raw.get("data", {}).get("tweetResult", {}).get("result", {})
                    if tweet_result.get("__typename") == "TweetWithVisibilityResults":
                        tweet_result = tweet_result.get("tweet", {})

                    if tweet_result.get("__typename") == "TweetUnavailable":
                        reason = tweet_result.get("reason", "")
                        if reason in ("NsfwLoggedOut", "NsfwViewerHasNoStatedAge"):
                            raise XAuthRequiredError("Bài viết nhạy cảm (18+) yêu cầu đăng nhập tài khoản đủ 18 tuổi.")
                        if reason == "Protected":
                            raise XAuthRequiredError("Tài khoản này ở chế độ riêng tư (Protected). Bạn cần quyền theo dõi để xem bài viết.")
                        raise XPostError(f"Bài viết không khả dụng: {reason}")

                    legacy = tweet_result.get("legacy", {})
                    user_legacy = tweet_result.get("core", {}).get("user_results", {}).get("result", {}).get("legacy", {})
                    media = legacy.get("extended_entities", {}).get("media") or legacy.get("entities", {}).get("media") or []

                    if not legacy and not user_legacy:
                        return None

                    log_info("X_EXTRACTOR", f"Đã giải mã thành công bài viết X (GraphQL với Cookies): {status_id}")
                    return {
                        "id_str": status_id,
                        "text": legacy.get("full_text") or "",
                        "created_at": legacy.get("created_at") or "",
                        "favorite_count": legacy.get("favorite_count", 0),
                        "conversation_count": legacy.get("reply_count", 0),
                        "user": {
                            "name": user_legacy.get("name") or "X User",
                            "screen_name": user_legacy.get("screen_name") or "user",
                            "profile_image_url_https": user_legacy.get("profile_image_url_https") or "",
                            "verified": bool(user_legacy.get("verified") or user_legacy.get("is_blue_verified")),
                        },
                        "mediaDetails": media,
                    }
        except XPostError:
            raise
        except Exception as err:
            log_warning("X_EXTRACTOR", f"GraphQL API fetch thất bại: {err}")
            return None

    def _inspect_sync(self, url: str, status_id: str, cookie_header: str = "") -> dict[str, Any]:
        """Synchronously fetch and parse post information from Twitter/X."""
        data = None

        # 1. If cookies are present, prioritize GraphQL to access full content (including NSFW/18+/private)
        if cookie_header:
            log_info("X_EXTRACTOR", f"Đang gửi yêu cầu kiểm tra bài viết X có nạp cookies: {status_id}")
            data = self._fetch_graphql_sync(status_id, cookie_header)

        # 2. If no data yet, query the syndication API (Guest-first)
        if not data:
            token = calculate_twitter_token(status_id)
            api_url = f"https://cdn.syndication.twimg.com/tweet-result?id={status_id}&token={token}"

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                "Origin": "https://platform.twitter.com",
                "Referer": "https://platform.twitter.com/",
            }
            if cookie_header:
                headers["Cookie"] = cookie_header

            req = urllib.request.Request(api_url, headers=headers)
            try:
                with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=10) as resp:
                    if resp.status == 200:
                        raw_json = json.loads(resp.read().decode("utf-8", errors="ignore"))
                        # If syndication returns TweetTombstone (NSFW / sensitive / protected)
                        if raw_json.get("__typename") == "TweetTombstone" or not raw_json.get("text"):
                            log_warning("X_EXTRACTOR", f"Syndication trả về TweetTombstone cho bài viết {status_id}")
                            if cookie_header:
                                data = self._fetch_graphql_sync(status_id, cookie_header)
                            if not data:
                                raise XAuthRequiredError("Bài viết này có nội dung nhạy cảm (18+) hoặc tài khoản riêng tư. Vui lòng nạp Cookie X để mở khóa nội dung.")
                        else:
                            data = raw_json
            except (XPostError, XNotFoundError, XAuthRequiredError):
                raise
            except urllib.error.HTTPError as http_err:
                if http_err.code == 404:
                    raise XNotFoundError(f"Bài viết X ({status_id}) không tồn tại hoặc đã bị xóa.") from http_err
                if http_err.code in (429, 403):
                    log_warning("X_EXTRACTOR", f"Syndication API trả về HTTP {http_err.code}, thử oEmbed...")
                    data = self._fetch_oembed_sync(status_id)
                else:
                    raise XPostError(f"Lỗi kết nối máy chủ X (HTTP {http_err.code}).") from http_err
            except Exception as err:
                log_warning("X_EXTRACTOR", f"Lỗi gọi syndication API: {err}, thử oEmbed...")
                data = self._fetch_oembed_sync(status_id)

        if not data:
            raise XPostError("Không nhận được dữ liệu từ bài viết X.")

        return self._normalize_post(data, status_id, url)

    def _fetch_oembed_sync(self, status_id: str) -> dict[str, Any]:
        """Fallback to Twitter public oEmbed endpoint."""
        oembed_url = f"https://publish.twitter.com/oembed?url=https://x.com/i/status/{status_id}"
        req = urllib.request.Request(
            oembed_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, context=self._ssl_ctx, timeout=8) as resp:
                if resp.status == 200:
                    raw = json.loads(resp.read().decode("utf-8", errors="ignore"))
                    # Normalize oembed into minimal shape
                    clean_text = re.sub(r"<[^>]+>", " ", raw.get("html", "")).strip()
                    return {
                        "id_str": status_id,
                        "text": clean_text,
                        "user": {
                            "name": raw.get("author_name", "X User"),
                            "screen_name": raw.get("author_url", "").split("/")[-1] or "user",
                        },
                    }
        except Exception as err:
            log_error("X_EXTRACTOR", f"oEmbed fallback thất bại: {err}")
        raise XNotFoundError("Không tìm thấy bài viết X.")

    def _normalize_post(self, data: dict[str, Any], status_id: str, original_url: str) -> dict[str, Any]:
        """Normalize raw X API response into standardized AppView inspect structure."""
        text = str(data.get("text") or "").strip()
        # Clean t.co trailing URLs from text if desired or keep
        title = text.split("\n")[0][:80].strip() if text else f"post_{status_id}"
        clean_title = sanitize_filename(title)

        user_info = data.get("user") or {}
        author_name = user_info.get("name") or "X User"
        screen_name = user_info.get("screen_name") or "user"
        avatar = user_info.get("profile_image_url_https") or ""
        # Upgrade avatar to higher resolution if available
        if avatar and "_normal" in avatar:
            avatar = avatar.replace("_normal", "_bigger")

        author = {
            "name": author_name,
            "screen_name": screen_name,
            "avatar": avatar,
            "profile_url": f"https://x.com/{screen_name}",
            "verified": bool(user_info.get("verified") or user_info.get("is_blue_verified")),
        }

        created_at = data.get("created_at") or ""
        metrics = {
            "likes": data.get("favorite_count", 0),
            "replies": data.get("conversation_count", 0),
        }

        media_details = data.get("mediaDetails") or []
        items = []
        item_index = 1
        thumbnail = None

        for media in media_details:
            mtype = media.get("type")
            if mtype in ("video", "animated_gif"):
                video_info = media.get("video_info") or {}
                variants = video_info.get("variants") or []
                mp4_variants = [
                    v for v in variants
                    if v.get("content_type") == "video/mp4" and isinstance(v.get("url"), str)
                ]
                # Sort MP4 variants by bitrate descending
                mp4_variants.sort(key=lambda x: x.get("bitrate") or 0, reverse=True)

                if mp4_variants:
                    best = mp4_variants[0]
                    thumb = media.get("media_url_https") or ""
                    if not thumbnail:
                        thumbnail = thumb

                    qualities = []
                    for v in mp4_variants:
                        bitrate = v.get("bitrate")
                        # Approximate quality height from URL or bitrate
                        q_label = f"{bitrate // 1000}kbps" if bitrate else "MP4"
                        qualities.append({
                            "url": v.get("url"),
                            "bitrate": bitrate,
                            "label": q_label,
                        })

                    filename = format_video_download_filename("X", clean_title, f"{status_id}_{item_index}", ext=".mp4")
                    items.append({
                        "index": item_index,
                        "type": "video",
                        "download_url": best.get("url"),
                        "thumbnail": thumb,
                        "filename": filename,
                        "qualities": qualities,
                        "bitrate": best.get("bitrate"),
                    })
                    item_index += 1

            elif mtype == "photo":
                photo_url = media.get("media_url_https") or ""
                if photo_url:
                    if not thumbnail:
                        thumbnail = photo_url
                    # High-res photo URL
                    high_res_url = f"{photo_url}?name=orig" if "?" not in photo_url else photo_url
                    filename = format_photo_download_filename("X", clean_title, item_index, ext=".jpeg")
                    items.append({
                        "index": item_index,
                        "type": "photo",
                        "download_url": high_res_url,
                        "thumbnail": photo_url,
                        "filename": filename,
                    })
                    item_index += 1

        # Determine media classification
        photos = [it for it in items if it.get("type") == "photo"]
        videos = [it for it in items if it.get("type") == "video"]
        images = [
            {
                "id": f"photo_{it['index']}",
                "url": it["download_url"],
                "label": f"Ảnh {it['index']}",
                "type": "photo",
            }
            for it in photos
        ]
        has_video = len(videos) > 0

        if len(items) == 0:
            media_type = "text_only"
        elif len(items) == 1:
            media_type = items[0]["type"]
        else:
            media_type = "carousel"

        return {
            "id": status_id,
            "source": "x",
            "platform": "X (Twitter)",
            "url": f"https://x.com/{screen_name}/status/{status_id}",
            "original_url": original_url,
            "title": clean_title,
            "text": text,
            "content": text,
            "uploader": author_name,
            "created_at": created_at,
            "created_time": created_at,
            "author": author,
            "metrics": metrics,
            "reactions": metrics,
            "media_type": media_type,
            "type": media_type,
            "thumbnail": thumbnail or avatar,
            "items": items,
            "photos": photos,
            "videos": videos,
            "images": images,
            "qualities": [],
            "has_video": has_video,
            "has_audio": has_video,
            "total_items": len(items),
            "raw_data": data,
        }
