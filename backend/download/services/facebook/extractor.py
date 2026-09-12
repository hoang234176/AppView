"""Facebook post extractor.

Extracts post author, content/status lines, publish time, reactions (likes/comments/shares),
and media (photos and videos) from Facebook URLs.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from functools import partial
import html
import json
import re
import ssl
from typing import Any, Optional
import urllib.parse
import urllib.request
import urllib.error

from logger import log_error, log_info, log_warning
from services.facebook.auth import parse_cookies_to_header, read_facebook_cookies_from_file
from services.facebook.errors import (
    FacebookAccessDeniedError,
    FacebookAuthRequiredError,
    FacebookNotFoundError,
    FacebookUnsupportedPostError,
    classify_facebook_error,
)
from services.resolution import compute_video_resolution


def sanitize_raw_info(data: Any, depth: int = 0) -> Any:
    """Recursively clean sensitive data from raw Facebook information."""
    if depth > 8:
        return "<max_depth_reached>"
    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            lower_key = str(key).lower()
            if any(secret in lower_key for secret in [
                "cookie", "token", "password", "secret", "authorization", "session", "auth", "dtsg", "lsd"
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
        return [sanitize_raw_info(item, depth + 1) for item in data[:30]]
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


def clean_facebook_url(url: str) -> str:
    """Normalize Facebook URL to standard clean format."""
    clean = url.strip()
    # Strip tracking params like fbclid, __cft__, __tn__, ref, etc.
    try:
        parsed = urllib.parse.urlparse(clean)
        qs = urllib.parse.parse_qsl(parsed.query)
        allowed_params = ["story_fbid", "id", "v", "fbid", "set", "post_id"]
        filtered_qs = [(k, v) for k, v in qs if k in allowed_params]
        new_query = urllib.parse.urlencode(filtered_qs)
        clean = urllib.parse.urlunparse((
            parsed.scheme or "https",
            parsed.netloc or "www.facebook.com",
            parsed.path,
            parsed.params,
            new_query,
            "",
        ))
    except Exception:
        pass
    return clean


class FacebookExtractor:
    """Extracts post metadata, author, text, reactions, photos, and videos from Facebook posts."""

    def __init__(self, cookies: Optional[str] = None):
        self._custom_cookies = cookies

    def _get_cookie_header(self) -> str:
        if self._custom_cookies:
            return parse_cookies_to_header(self._custom_cookies)
        saved = read_facebook_cookies_from_file()
        if saved:
            return parse_cookies_to_header(saved)
        return ""

    async def inspect(self, url: str) -> dict[str, Any]:
        """Asynchronously extract and return full structured metadata from a Facebook post."""
        clean_url = clean_facebook_url(url)
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._extract_sync, clean_url)

    def _extract_redirect_target(self, html_text: str) -> Optional[str]:
        """Detect client-side meta refresh or window.location.replace on Facebook share links."""
        m_refresh = re.search(r'content=["\']\d+;\s*url=([^"\']+)["\']', html_text, re.IGNORECASE)
        if m_refresh:
            target = html.unescape(m_refresh.group(1)).strip()
            if target.startswith("http"):
                return target
        m_loc = re.search(r'window\.location\.replace\("([^"]+)"\)', html_text)
        if m_loc:
            raw = m_loc.group(1).replace(r"\/", "/").replace(r"\u0025", "%").replace(r"\u0026", "&")
            target = html.unescape(raw).strip()
            if target.startswith("http"):
                return target
        return None

    def _extract_sync(self, url: str) -> dict[str, Any]:
        """Synchronously request Facebook HTML, follow client redirects, and extract post data."""
        cookie_header = self._get_cookie_header()

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
        if cookie_header:
            headers["Cookie"] = cookie_header

        ssl_context = ssl._create_unverified_context()
        current_url = url
        final_url = url
        html_text = ""

        # Follow client redirects (Facebook share/p/ and share/r/ return <meta http-equiv="refresh"> or window.location.replace)
        for _ in range(3):
            req = urllib.request.Request(current_url, headers=headers)
            log_info("FACEBOOK_EXTRACTOR", f"Đang gửi yêu cầu lấy dữ liệu bài viết Facebook: {current_url}")

            try:
                with urllib.request.urlopen(req, timeout=20, context=ssl_context) as resp:
                    final_url = resp.geturl()
                    html_text = resp.read().decode("utf-8", errors="replace")
            except urllib.error.HTTPError as http_err:
                if http_err.code in (404, 410):
                    raise FacebookNotFoundError()
                if http_err.code in (401, 403):
                    raise FacebookAccessDeniedError()
                raise classify_facebook_error(str(http_err))
            except Exception as err:
                raise classify_facebook_error(str(err))

            redirect_target = self._extract_redirect_target(html_text)
            if redirect_target and redirect_target != current_url:
                current_url = redirect_target
            else:
                break

        if "/login" in final_url.lower() or "login.php" in final_url.lower() or "checkpoint" in final_url.lower():
            if not cookie_header:
                raise FacebookAuthRequiredError("Bài viết này yêu cầu đăng nhập. Vui lòng cấu hình cookies Facebook để xem.")
            raise FacebookAccessDeniedError("Bài viết này không thể truy cập với phiên đăng nhập hiện tại.")

        return self._parse_html(url, html_text, final_url)

    def _parse_html(self, original_url: str, html_text: str, final_url: str) -> dict[str, Any]:
        """Parse Facebook HTML and extract author, status, timestamp, reactions, photos and videos."""
        # 1. Post ID resolution
        post_id = self._extract_post_id(original_url, final_url, html_text)

        # 2. Author info
        author = self._extract_author(html_text)

        # 3. Status / Message content
        content = self._extract_content(html_text)

        # 4. Timestamp
        timestamp, created_time_str = self._extract_timestamp(html_text)

        # 5. Reactions, Comments, Shares
        reactions = self._extract_reactions(html_text)

        # 6. Post type analysis & Videos
        is_reel_or_video_url = any(
            x in (original_url + " " + final_url).lower()
            for x in ["/reel/", "/videos/", "/watch/", "share/r/", "share/v/"]
        )
        # Check if the primary post is a photo or album post
        pos_photo = html_text.find("StoryAttachmentPhotoStyleRenderer")
        pos_album = html_text.find("StoryAttachmentAlbumStyleRenderer")
        is_photo_post_detected = False
        if not is_reel_or_video_url:
            if pos_photo != -1 or pos_album != -1:
                is_photo_post_detected = True
            elif re.search(r'"story_attachment_style"\s*:\s*"(?:photo|album)"', html_text):
                is_photo_post_detected = True

        target_vid = post_id if post_id.isdigit() else None
        videos, qualities = self._extract_videos(
            html_text,
            is_photo_post=is_photo_post_detected,
            target_video_id=target_vid,
            is_reel_or_video_url=is_reel_or_video_url,
        )

        # 7. Photos
        if is_reel_or_video_url:
            # Pure video/reel URL: dedicated video post
            photos: list[dict[str, Any]] = []
        else:
            photos = self._extract_photos(html_text)

        # 8. Post classification
        has_video = len(videos) > 0
        has_photos = len(photos) > 0

        if is_reel_or_video_url and has_video:
            post_type = "video"
        elif has_video and has_photos:
            post_type = "mixed"
        elif has_video:
            post_type = "video"
        elif len(photos) > 1:
            post_type = "slideshow"
        elif len(photos) == 1:
            post_type = "photo"
        elif content:
            post_type = "text"
        else:
            post_type = "post"

        # Build thumbnail
        primary_thumbnail = ""
        if photos:
            primary_thumbnail = photos[0]["url"]
        elif videos:
            for pat in [
                r'"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"',
                r'"first_frame_thumbnail":"([^"]+)"',
                r'"video":\{.*?"thumbnailImage":\{"uri":"([^"]+)"',
            ]:
                m_thumb = re.search(pat, html_text)
                if m_thumb:
                    primary_thumbnail = self._clean_url(m_thumb.group(1))
                    break
            if not primary_thumbnail and videos[0].get("thumbnail"):
                primary_thumbnail = videos[0]["thumbnail"]
        if not primary_thumbnail:
            og_img = self._extract_og_meta(html_text, "og:image")
            if og_img and not og_img.endswith(".ico") and "static" not in og_img:
                primary_thumbnail = og_img

        # Title / Headline
        title = ""
        if content:
            first_line = content.splitlines()[0].strip()
            title = first_line[:100]
        if not title:
            og_title = self._extract_og_meta(html_text, "og:title")
            if og_title and "redirecting" not in og_title.lower():
                title = og_title
        if not title or not title.strip() or "redirecting" in title.lower():
            author_name = author.get("name")
            if author_name and author_name != "Người dùng Facebook":
                if is_reel_or_video_url:
                    title = f"Facebook Reel - {author_name}"
                else:
                    title = f"Bài viết của {author_name}"
            else:
                title = f"Bài viết Facebook {post_id}"

        # Standardized images for AppView dialog compatibility (PreviewImageItem contract)
        all_images = [
            {
                "id": p.get("id") or f"photo_{idx + 1}",
                "type": "photo",
                "label": f"Ảnh #{idx + 1}" + (f" ({p['width']}x{p['height']})" if p.get("width") and p.get("height") else ""),
                "url": p["url"],
                "thumbnail": p.get("thumbnail") or p["url"],
            }
            for idx, p in enumerate(photos)
        ]

        result: dict[str, Any] = {
            "source": "facebook",
            "id": post_id,
            "url": original_url,
            "canonical_url": final_url,
            "type": post_type,
            "title": title,
            "author": author,
            "uploader": author.get("name") or "Người dùng Facebook",
            "content": content,
            "created_time": created_time_str,
            "timestamp": timestamp,
            "reactions": reactions,
            "photos": photos,
            "videos": videos,
            "images": all_images,
            "all_images": all_images,
            "qualities": qualities,
            "has_video": has_video,
            "has_audio": has_video,
            "thumbnail": primary_thumbnail,
            "raw_info": {
                "post_id": post_id,
                "photos_count": len(photos),
                "videos_count": len(videos),
                "has_content": bool(content),
            },
        }

        return result

    def _extract_post_id(self, original_url: str, final_url: str, html_text: str) -> str:
        """Extract numeric or alphanumeric post identifier, preferring real canonical ID."""
        # 1. Prefer final numeric ID from final_url (e.g. /reel/1835493077885112, /videos/123, /posts/123)
        for cand_url in [final_url, original_url]:
            m_num = re.search(r"/(?:reel|videos|posts)/(\d+)", cand_url)
            if m_num:
                return m_num.group(1)
            m_fbid = re.search(r"[?&](?:story_fbid|fbid|v)=([a-zA-Z0-9_]+)", cand_url)
            if m_fbid:
                return m_fbid.group(1)

        # 2. General path identifier
        combined = f"{final_url} {original_url}"
        m = re.search(r"/(?:posts|videos|reel|photo|photos|share/(?:p|v|r))/([a-zA-Z0-9_]+)", combined)
        if m:
            return m.group(1)

        # 3. HTML Search
        m_dash = re.search(r"dash_manifest_urls.*?v=(\d+)", html_text)
        if m_dash:
            return m_dash.group(1)
        m = re.search(r'"post_id":"([^"]+)"', html_text)
        if m:
            return m.group(1)
        m = re.search(r'"story_fbid":\[?"?([^"\]]+)"?\]?', html_text)
        if m:
            return m.group(1)
        return "post"

    def _extract_og_meta(self, html_text: str, prop: str) -> Optional[str]:
        """Extract content attribute from OpenGraph meta tags."""
        patterns = [
            rf'<meta\s+property=["\']{prop}["\']\s+content=["\']([^"\']+)["\']',
            rf'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']{prop}["\']',
            rf'<meta\s+name=["\']{prop}["\']\s+content=["\']([^"\']+)["\']',
        ]
        for pat in patterns:
            m = re.search(pat, html_text, re.IGNORECASE)
            if m:
                return html.unescape(m.group(1)).strip()
        return None

    def _extract_author(self, html_text: str) -> dict[str, Any]:
        """Extract post author name, avatar and profile link."""
        name = ""
        avatar = ""
        profile_url = ""
        author_id = ""

        # Search for actor in Comet JSON (support both name-first and id-first, owning_profile, and owner)
        actor_patterns = [
            (r'"actors"\s*:\s*\[\s*\{[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"id"\s*:\s*"(\d+)"', "name_first"),
            (r'"actors"\s*:\s*\[\s*\{[^}]*?"id"\s*:\s*"(\d+)"[^}]*?"name"\s*:\s*"([^"]+)"', "id_first"),
            (r'"owning_profile"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"id"\s*:\s*"(\d+)"', "name_first"),
            (r'"owning_profile"\s*:\s*\{[^}]*?"id"\s*:\s*"(\d+)"[^}]*?"name"\s*:\s*"([^"]+)"', "id_first"),
            (r'"owner"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"id"\s*:\s*"(\d+)"', "name_first"),
            (r'"owner"\s*:\s*\{[^}]*?"id"\s*:\s*"(\d+)"[^}]*?"name"\s*:\s*"([^"]+)"', "id_first"),
        ]
        for pat, mode in actor_patterns:
            m = re.search(pat, html_text)
            if m:
                cand_name = m.group(1) if mode == "name_first" else m.group(2)
                cand_id = m.group(2) if mode == "name_first" else m.group(1)
                cand_name_dec = self._unescape_unicode(cand_name)
                if cand_name_dec and "redirecting" not in cand_name_dec.lower():
                    name = cand_name_dec
                    author_id = cand_id
                    break

        # Author avatar pattern from actors / owner / displayPicture
        for av_pat in [
            r'"actors"\s*:\s*\[\s*\{[^}]*?"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"',
            r'"displayPicture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"',
            r'"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"',
        ]:
            m = re.search(av_pat, html_text)
            if m:
                avatar = self._clean_url(m.group(1))
                break

        # Fallback author name from og:title or title
        if not name:
            og_title = self._extract_og_meta(html_text, "og:title")
            if og_title:
                clean_title = og_title.split(" - ")[0].split(" | ")[0]
                if clean_title and "facebook" not in clean_title.lower() and "redirecting" not in clean_title.lower():
                    name = clean_title.strip()

        if not name:
            title_match = re.search(r"<title>([^<]+)</title>", html_text, re.IGNORECASE)
            if title_match:
                t = html.unescape(title_match.group(1)).strip()
                t = t.replace(" | Facebook", "").replace(" - Facebook", "")
                if t and "facebook" not in t.lower() and "log in" not in t.lower() and "đăng nhập" not in t.lower() and "redirecting" not in t.lower():
                    name = t.split(" - ")[0].strip()

        if author_id:
            profile_url = f"https://www.facebook.com/{author_id}"

        return {
            "name": name or "Người dùng Facebook",
            "id": author_id,
            "profile_url": profile_url,
            "avatar": avatar,
        }

    def _extract_content(self, html_text: str) -> str:
        """Extract status / post body text preserving multiple lines."""
        text = ""

        # Match message in comet story JSON: "message":{"text":"..."}
        # The primary post's message appears first in the stream.
        message_matches = re.finditer(r'"message":\{"text":"((?:[^"\\]|\\.)*)"\}', html_text)
        candidates = []
        for m in message_matches:
            raw = m.group(1)
            decoded = self._unescape_unicode(raw)
            if decoded.strip() and not decoded.startswith("http") and "redirecting" not in decoded.lower():
                candidates.append(decoded.strip())

        if candidates:
            # First candidate is the primary post's message
            text = candidates[0]

        # Fallback to og:description
        if not text:
            og_desc = self._extract_og_meta(html_text, "og:description")
            if og_desc and "facebook" not in og_desc.lower() and "xem bài viết" not in og_desc.lower() and "redirecting" not in og_desc.lower():
                text = og_desc.strip()

        return text

    def _extract_timestamp(self, html_text: str) -> tuple[Optional[int], str]:
        """Extract publication epoch timestamp and formatted date string."""
        # Find creation_time or publish_time in JSON: "creation_time":1726052400
        time_matches = re.findall(r'"(?:creation_time|publish_time|legacy_publish_time)":(\d{10})', html_text)
        if time_matches:
            ts = int(time_matches[0])
            return ts, format_timestamp(ts)

        # Check data-utime in HTML
        m = re.search(r'data-utime=["\'](\d{10})["\']', html_text)
        if m:
            ts = int(m.group(1))
            return ts, format_timestamp(ts)

        return None, "Không rõ ngày đăng"

    def _extract_reactions(self, html_text: str) -> dict[str, int]:
        """Extract likes/reactions, comments, and shares count."""
        likes = 0
        comments = 0
        shares = 0

        # 1. Likes / Reactions matching (supports Comet stories, posts, Reels and Watch)
        for pat in [
            r'"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'"likers"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'"unified_reactors"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'"reactors"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'"like_count"\s*:\s*(\d+)',
        ]:
            m = re.search(pat, html_text)
            if m:
                likes = int(m.group(1))
                break
        if not likes:
            m_alt = re.search(r'"i18n_reaction_count"\s*:\s*"([^"]+)"', html_text)
            if m_alt:
                likes = self._parse_count_str(m_alt.group(1))

        # 2. Comments matching
        for pat in [
            r'"total_comment_count"\s*:\s*(\d+)',
            r'"comments"\s*:\s*\{.*?"total_count"\s*:\s*(\d+)',
            r'"comment_count"\s*:\s*\{.*?"total_count"\s*:\s*(\d+)',
            r'"comment_count"\s*:\s*(\d+)',
        ]:
            m = re.search(pat, html_text)
            if m:
                comments = int(m.group(1))
                break
        if not comments:
            m_alt_c = re.search(r'"i18n_comment_count"\s*:\s*"([^"]+)"', html_text)
            if m_alt_c:
                comments = self._parse_count_str(m_alt_c.group(1))

        # 3. Shares matching (supports post shares and Reel share_count_reduced)
        for pat in [
            r'"share_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
            r'"share_count_reduced"\s*:\s*"(\d+)"',
            r'"share_count_reduced"\s*:\s*(\d+)',
            r'"share_count"\s*:\s*(\d+)',
            r'"reshares"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
        ]:
            m = re.search(pat, html_text)
            if m:
                shares = int(m.group(1))
                break
        if not shares:
            m_alt_s = re.search(r'"i18n_share_count"\s*:\s*"([^"]+)"', html_text)
            if m_alt_s:
                shares = self._parse_count_str(m_alt_s.group(1))

        return {
            "likes": likes,
            "comments": comments,
            "shares": shares,
        }

    def _extract_photos(self, html_text: str) -> list[dict[str, Any]]:
        """Extract high-resolution photo URLs from post attachments."""
        photos: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        pos_photo = html_text.find("StoryAttachmentPhotoStyleRenderer")
        pos_album = html_text.find("StoryAttachmentAlbumStyleRenderer")

        # 1. Single Photo Post: Prioritize StoryAttachmentPhotoStyleRenderer when it appears first
        if pos_photo != -1 and (pos_album == -1 or pos_photo < pos_album):
            chunk = html_text[pos_photo:pos_photo + 15000]
            m_img = re.search(
                r'"photo_image"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"(?:,\s*"height"\s*:\s*(\d+))?(?:,\s*"width"\s*:\s*(\d+))?',
                chunk,
            )
            if m_img:
                clean = self._clean_url(m_img.group(1))
                h = int(m_img.group(2)) if m_img.group(2) else None
                w = int(m_img.group(3)) if m_img.group(3) else None
                if self._is_content_photo(clean, w, h):
                    photos.append({
                        "id": "fb_photo_1",
                        "url": clean,
                        "thumbnail": clean,
                        "width": w,
                        "height": h,
                    })
                    return photos

        # 2. Album Post: StoryAttachmentAlbumStyleRenderer when it appears first
        if pos_album != -1 and (pos_photo == -1 or pos_album < pos_photo):
            chunk = html_text[pos_album:pos_album + 120000]
            m_sub = re.search(r'"all_subattachments"\s*:\s*\{\s*"count"\s*:\s*(\d+)\s*,\s*"nodes"\s*:\s*\[(.*?)\]\}', chunk)
            if m_sub:
                nodes_str = m_sub.group(2)
                for item in re.split(r'\}\s*,\s*\{"deduplication_key"', nodes_str):
                    uri_m = re.findall(r'"uri":"([^"]+)"', item)
                    if not uri_m:
                        continue
                    clean = self._clean_url(uri_m[0])
                    w_m = re.search(r'"width":(\d+)', item)
                    h_m = re.search(r'"height":(\d+)', item)
                    w = int(w_m.group(1)) if w_m else None
                    h = int(h_m.group(1)) if h_m else None
                    if not self._is_content_photo(clean, w, h):
                        continue
                    norm_key = self._normalize_fb_cdn(clean)
                    if norm_key not in seen_urls:
                        seen_urls.add(norm_key)
                        photos.append({
                            "id": f"fb_photo_{len(photos) + 1}",
                            "url": clean,
                            "thumbnail": clean,
                            "width": w,
                            "height": h,
                        })
                if photos:
                    return photos

        # 3. Fallback: Extract from all_subattachments if present
        m_sub = re.search(r'"all_subattachments":\{"count":(\d+),"nodes":\[(.*?)\]\}', html_text)
        if m_sub:
            nodes_str = m_sub.group(2)
            for chunk in re.split(r'\}\s*,\s*\{"deduplication_key"', nodes_str):
                uri_m = re.findall(r'"uri":"([^"]+)"', chunk)
                if not uri_m:
                    continue
                clean = self._clean_url(uri_m[0])
                w_m = re.search(r'"width":(\d+)', chunk)
                h_m = re.search(r'"height":(\d+)', chunk)
                w = int(w_m.group(1)) if w_m else None
                h = int(h_m.group(1)) if h_m else None
                if not self._is_content_photo(clean, w, h):
                    continue
                norm_key = self._normalize_fb_cdn(clean)
                if norm_key not in seen_urls:
                    seen_urls.add(norm_key)
                    photos.append({
                        "id": f"fb_photo_{len(photos) + 1}",
                        "url": clean,
                        "thumbnail": clean,
                        "width": w,
                        "height": h,
                    })

        # 4. Extract from primary story attachments block
        if not photos:
            m_att = re.search(r'"attachments"\s*:\s*\[(.*?)\]\s*\}\s*\}', html_text, re.DOTALL)
            if m_att:
                att_content = m_att.group(1)
                for chunk in re.split(r'\}\s*,\s*\{', att_content):
                    if '"Photo"' in chunk or '"image"' in chunk:
                        uri_m = re.search(r'"uri"\s*:\s*"([^"]+)"', chunk)
                        if not uri_m:
                            continue
                        clean = self._clean_url(uri_m.group(1))
                        w_m = re.search(r'"width"\s*:\s*(\d+)', chunk)
                        h_m = re.search(r'"height"\s*:\s*(\d+)', chunk)
                        w = int(w_m.group(1)) if w_m else None
                        h = int(h_m.group(1)) if h_m else None
                        if self._is_content_photo(clean, w, h):
                            norm_key = self._normalize_fb_cdn(clean)
                            if norm_key not in seen_urls:
                                seen_urls.add(norm_key)
                                photos.append({
                                    "id": f"fb_photo_{len(photos) + 1}",
                                    "url": clean,
                                    "thumbnail": clean,
                                    "width": w,
                                    "height": h,
                                })

        # 5. Direct photo attachment in Comet JSON: "image":{...}
        if not photos:
            img_matches = re.finditer(
                r'"(?:image|photo_image|original_image|full_size_image|large_share_image)":\{([^}]+)\}',
                html_text,
            )
            candidates: list[dict[str, Any]] = []
            for m in img_matches:
                chunk = m.group(1)
                uri_m = re.search(r'"uri":"([^"]+)"', chunk)
                if not uri_m:
                    continue
                raw_url = uri_m.group(1)
                w_m = re.search(r'"width":(\d+)', chunk)
                h_m = re.search(r'"height":(\d+)', chunk)
                w = int(w_m.group(1)) if w_m else None
                h = int(h_m.group(1)) if h_m else None
                clean_url = self._clean_url(raw_url)

                if self._is_content_photo(clean_url, w, h):
                    norm_key = self._normalize_fb_cdn(clean_url)
                    if norm_key not in seen_urls:
                        seen_urls.add(norm_key)
                        area = (w or 0) * (h or 0)
                        candidates.append({
                            "url": clean_url,
                            "thumbnail": clean_url,
                            "width": w,
                            "height": h,
                            "area": area,
                        })

            if candidates:
                # For single photo posts, pick the highest resolution image to avoid stray feed thumbnails
                candidates.sort(key=lambda x: x["area"], reverse=True)
                best = candidates[0]
                photos.append({
                    "id": "fb_photo_1",
                    "url": best["url"],
                    "thumbnail": best["thumbnail"],
                    "width": best["width"],
                    "height": best["height"],
                })

        # 6. Fallback to OpenGraph image if no photos found
        if not photos:
            og_img = self._extract_og_meta(html_text, "og:image")
            if og_img and self._is_content_photo(og_img, None, None):
                norm_key = self._normalize_fb_cdn(og_img)
                if norm_key not in seen_urls:
                    seen_urls.add(norm_key)
                    photos.append({
                        "id": "fb_photo_og",
                        "url": og_img,
                        "thumbnail": og_img,
                        "width": None,
                        "height": None,
                    })

        return photos

    def _extract_videos(
        self,
        html_text: str,
        is_photo_post: bool = False,
        target_video_id: Optional[str] = None,
        is_reel_or_video_url: bool = False,
    ) -> tuple[list[dict[str, Any]], list[int]]:
        """Extract HD and SD video stream URLs and available quality tiers."""
        if is_photo_post:
            return [], []

        # If not a dedicated reel/video URL and there is no video attachment in story, skip extracting stray feed videos
        has_story_video = (
            bool(re.search(r'"__typename"\s*:\s*"Video"', html_text))
            or "video_autoplay" in html_text
            or "EntVideoCreationStory" in html_text
        )
        if not is_reel_or_video_url and not has_story_video:
            return [], []

        videos: list[dict[str, Any]] = []
        qualities_set: set[int] = set()
        seen_urls: set[str] = set()

        def parse_efg(url: str) -> dict[str, Any]:
            try:
                parsed = urllib.parse.urlparse(url)
                qs = urllib.parse.parse_qs(parsed.query)
                efg_raw = qs.get("efg", [""])[0]
                if not efg_raw:
                    return {}
                rem = len(efg_raw) % 4
                if rem > 0:
                    efg_raw += "=" * (4 - rem)
                return json.loads(base64.b64decode(efg_raw))
            except Exception:
                return {}

        def sanitize_stream_url(raw: str) -> str:
            clean = self._clean_url(raw)
            clean = re.split(r"(?:\\u003C|<)(?:\\/|/)BaseURL>", clean)[0]
            clean = re.split(r"(?:\\u003C|<)SegmentBase", clean)[0]
            return clean.strip()

        # 1. Primary for Reels / Video Posts: Progressive URLs from dash_manifest_urls blocks
        prog_blocks = re.finditer(
            r'"dash_manifest_urls"\s*:\s*\[\s*\{.*?v=(\d+).*?"progressive_urls"\s*:\s*\[(.*?)\]',
            html_text,
            re.DOTALL,
        )
        for pb in prog_blocks:
            b_vid = pb.group(1)
            if target_video_id and b_vid != target_video_id:
                continue
            # When target_video_id is unknown, do not iterate across multiple feed videos
            if not target_video_id and videos:
                break
            prog_raw = pb.group(2)
            p_matches = re.finditer(
                r'"progressive_url"\s*:\s*"([^"]+)".*?"metadata"\s*:\s*\{\s*"quality"\s*:\s*"([^"]+)"\}',
                prog_raw,
                re.DOTALL,
            )
            for pm in p_matches:
                raw_u = pm.group(1)
                q_label = pm.group(2).upper()
                clean_u = sanitize_stream_url(raw_u)
                if not clean_u or not clean_u.startswith("http") or clean_u in seen_urls:
                    continue

                efg_info = parse_efg(clean_u)
                tag = efg_info.get("vencode_tag", "")
                if "audio" in tag.lower():
                    continue

                q_num = 720 if q_label == "HD" else 480
                if "1080" in tag:
                    q_num = 1080
                elif "720" in tag:
                    q_num = 720
                elif "480" in tag:
                    q_num = 480
                elif "360" in tag:
                    q_num = 360

                seen_urls.add(clean_u)
                qualities_set.add(q_num)
                videos.append({
                    "id": f"fb_video_{len(videos) + 1}",
                    "label": f"Video {q_label} ({q_num}p)",
                    "quality_label": q_label,
                    "quality": q_num,
                    "url": clean_u,
                })

        # 2. Direct stream patterns in Comet JSON (browser_native_hd_url, playable_url, etc.)
        stream_patterns = [
            ("HD", r'"browser_native_hd_url":"([^"]+)"', 1080),
            ("HD", r'"playable_url_quality_hd":"([^"]+)"', 720),
            ("HD", r'"hd_src":"([^"]+)"', 720),
            ("HD", r'"hd_src_no_ratelimit":"([^"]+)"', 720),
            ("SD", r'"browser_native_sd_url":"([^"]+)"', 480),
            ("SD", r'"playable_url":"([^"]+)"', 360),
            ("SD", r'"sd_src":"([^"]+)"', 360),
            ("SD", r'"sd_src_no_ratelimit":"([^"]+)"', 360),
        ]

        for label, pattern, default_quality in stream_patterns:
            for m in re.finditer(pattern, html_text):
                clean_u = sanitize_stream_url(m.group(1))
                if not clean_u or not clean_u.startswith("http") or clean_u in seen_urls:
                    continue

                efg_info = parse_efg(clean_u)
                tag = efg_info.get("vencode_tag", "")
                vid = str(efg_info.get("video_id") or "")
                if target_video_id and vid and vid != target_video_id:
                    continue
                if "audio" in tag.lower():
                    continue

                seen_urls.add(clean_u)
                qualities_set.add(default_quality)
                videos.append({
                    "id": f"fb_video_{len(videos) + 1}",
                    "label": f"Video {label} ({default_quality}p)",
                    "quality_label": label,
                    "quality": default_quality,
                    "url": clean_u,
                })

        # 3. DASH BaseURL with FBQualityLabel (fallback if no progressive video found)
        if not videos:
            dash_matches = re.finditer(
                r'FBQualityLabel=\\?"(\d+)p?\\?">(?:\\u003C|<)BaseURL>(.*?)(?:\\u003C|<)(?:\\/|/)BaseURL>',
                html_text,
            )
            for m in dash_matches:
                q = int(m.group(1))
                clean_u = sanitize_stream_url(m.group(2))
                if not clean_u or not clean_u.startswith("http") or clean_u in seen_urls:
                    continue
                efg_info = parse_efg(clean_u)
                tag = efg_info.get("vencode_tag", "")
                vid = str(efg_info.get("video_id") or "")
                if target_video_id and vid and vid != target_video_id:
                    continue
                if "audio" in tag.lower():
                    continue

                seen_urls.add(clean_u)
                qualities_set.add(q)
                videos.append({
                    "id": f"fb_video_{len(videos) + 1}",
                    "label": f"Video ({q}p)",
                    "quality_label": "HD" if q >= 720 else "SD",
                    "quality": q,
                    "url": clean_u,
                })

        # 4. Fallback to og:video if no stream found
        if not videos:
            og_video = self._extract_og_meta(html_text, "og:video:url") or self._extract_og_meta(html_text, "og:video")
            if og_video and og_video.startswith("http") and og_video not in seen_urls:
                clean_u = sanitize_stream_url(og_video)
                seen_urls.add(clean_u)
                qualities_set.add(720)
                videos.append({
                    "id": "fb_video_og",
                    "label": "Video (HD 720p)",
                    "quality_label": "HD",
                    "quality": 720,
                    "url": clean_u,
                })

        sorted_qualities = sorted(qualities_set, reverse=True)
        return videos, sorted_qualities

    def _is_content_photo(self, url: str, width: Optional[int], height: Optional[int]) -> bool:
        """Check if an image URL is a real post photo rather than an icon, avatar, sticker, or ad."""
        if not url or not url.startswith("http"):
            return False
        lower = url.lower()
        if any(x in lower for x in [".ico", "rsrc.php", "emoji.php", "/emoji/", "/static/", "logo", "icon"]):
            return False
        # /t15. is Facebook video thumbnail / preview frame cache
        if "/t15." in lower:
            return False
        # /t45. is Facebook sponsored ads CDN
        if "/t45." in lower:
            return False
        # Profile avatar picture: -1/ suffix (e.g. /t39.30808-1/, /t1.30497-1/)
        if re.search(r"/t\d+\.\d+-1/", lower):
            return False
        # Avatar or tiny sticker square crop thumbnails
        if any(x in lower for x in ["s148x148", "s100x100", "s80x80", "s75x225", "s50x50", "s32x32"]):
            return False
        if width and height:
            # Skip small icons / stickers / avatars (< 250px)
            if width < 250 and height < 250:
                return False
        return True

    def _normalize_fb_cdn(self, url: str) -> str:
        """Extract filename or core path to deduplicate identical Facebook images across CDNs."""
        try:
            parsed = urllib.parse.urlparse(url)
            path = parsed.path
            return path.split("/")[-1]
        except Exception:
            return url

    def _clean_url(self, raw_url: str) -> str:
        """Unescape JSON-escaped slashes and HTML entities in URLs."""
        if not raw_url:
            return ""
        u = raw_url.replace(r"\/", "/").replace(r"\u0025", "%").replace(r"\u0026", "&")
        return html.unescape(u).strip()

    def _unescape_unicode(self, text: str) -> str:
        """Safely unescape JSON unicode sequences like \u00e0, \n, etc."""
        if not text:
            return ""
        try:
            return json.loads(f'"{text}"')
        except Exception:
            return text.replace(r"\n", "\n").replace(r"\t", " ").replace(r'\"', '"')

    def _parse_count_str(self, text: str) -> int:
        """Parse human strings like '1.2K', '3.5M' into integers."""
        if not text:
            return 0
        clean = text.strip().upper().replace(",", ".")
        try:
            if "K" in clean:
                num = float(clean.replace("K", "").strip())
                return int(num * 1000)
            if "M" in clean:
                num = float(clean.replace("M", "").strip())
                return int(num * 1000000)
            digits = re.sub(r"[^\d]", "", clean)
            return int(digits) if digits else 0
        except Exception:
            return 0
