"""YouTube authentication and error classification.

Handles configured cookies safely without exposing them in logs, frontend state,
or public coordinator events.
"""

from __future__ import annotations

import asyncio
import io
import os
from typing import Any, Optional

import yt_dlp.cookies

from services.youtube.errors import (
	PlaylistNotSupportedError,
	SourceAccessDeniedError,
	SourceAuthRequiredError,
	SourceNotFoundError,
	YouTubeError,
)


def get_youtube_cookies_path() -> Optional[str]:
	"""Return path to YouTube cookie file if configured via file path, otherwise None."""
	configured_path = os.environ.get("YOUTUBE_COOKIES_FILE")
	if configured_path and os.path.isfile(configured_path):
		return configured_path
	return None


def get_youtube_ydl_auth_opts() -> dict[str, Any]:
	"""Return yt-dlp authentication options without exposing raw contents."""
	cookie_path = get_youtube_cookies_path()
	if cookie_path:
		return {"cookiefile": cookie_path}
	return {}


def create_cookiejar_from_netscape(cookie_content: str) -> Optional[yt_dlp.cookies.YoutubeDLCookieJar]:
	"""Parse Netscape cookie file content in-memory without touching the filesystem."""
	if not cookie_content or not cookie_content.strip():
		return None
	try:
		jar = yt_dlp.cookies.YoutubeDLCookieJar()
		jar._really_load(io.StringIO(cookie_content), "in_memory", ignore_discard=True, ignore_expires=True)
		if not list(jar):
			return None
		return jar
	except Exception:
		return None


async def verify_youtube_cookies(raw_cookies: str) -> tuple[bool, str]:
	"""Test candidate cookies against YouTube in-memory without filesystem access."""
	if not raw_cookies or not raw_cookies.strip():
		return False, "Nội dung cookies trống."

	jar = create_cookiejar_from_netscape(raw_cookies)
	if jar is None:
		return False, "Định dạng cookies không hợp lệ. Vui lòng cung cấp định dạng Netscape cookie file."

	yt_cookies = [c for c in jar if "youtube.com" in c.domain or "google.com" in c.domain]
	if not yt_cookies:
		return False, "Không tìm thấy cookies cho youtube.com hoặc google.com."

	loop = asyncio.get_running_loop()
	try:
		return await loop.run_in_executor(None, _test_youtube_cookies_sync, jar)
	except Exception as err:
		return False, f"Xác thực thất bại: {err}"


def _test_youtube_cookies_sync(jar: yt_dlp.cookies.YoutubeDLCookieJar) -> tuple[bool, str]:
	import re
	import yt_dlp

	ydl_opts: dict[str, Any] = {
		"quiet": True,
		"no_warnings": True,
		"skip_download": True,
		"socket_timeout": 10,
	}
	try:
		ydl = yt_dlp.YoutubeDL(ydl_opts)
		ydl.cookiejar = jar
		resp = ydl.urlopen("https://www.youtube.com/")
		html = resp.read().decode("utf-8", errors="ignore")

		logged_in_match = re.search(r'"LOGGED_IN"\s*:\s*(true|false)', html, re.IGNORECASE)
		if logged_in_match:
			is_logged_in = logged_in_match.group(1).lower() == "true"
			if not is_logged_in:
				return False, "Cookies YouTube đã hết hạn hoặc chưa đăng nhập tài khoản (LOGGED_IN: false). Vui lòng xuất cookies mới từ trình duyệt."

		return True, "Xác thực cookies YouTube thành công."
	except Exception as err:
		error_msg = str(err).lower()
		if any(w in error_msg for w in ["sign in", "login", "bot", "cookie", "forbidden", "permission"]):
			return False, "Cookies YouTube không hợp lệ hoặc đã hết hạn."
		return False, f"Không thể kết nối đến YouTube để xác thực cookies: {err}"


def classify_extraction_error(error_str: str) -> YouTubeError:
    """Map yt-dlp error string to a stable AppView domain exception."""
    lower = error_str.lower()

    if any(phrase in lower for phrase in [
        "sign in to confirm your age",
        "confirm your age",
        "age-restricted",
        "sign in to confirm you’re not a bot",
        "sign in to confirm you're not a bot",
        "requires authentication",
        "login required",
    ]):
        return SourceAuthRequiredError(
            "This YouTube video requires an authenticated account with permission to access it."
        )

    if any(phrase in lower for phrase in [
        "private video",
        "this video is private",
        "access denied",
        "permission to access",
    ]):
        return SourceAccessDeniedError("Video này là riêng tư hoặc bị từ chối truy cập.")

    if any(phrase in lower for phrase in [
        "video unavailable",
        "does not exist",
        "has been removed",
        "not found",
    ]):
        return SourceNotFoundError("Không tìm thấy video YouTube này (video có thể đã bị xóa hoặc không tồn tại).")

    if "playlist" in lower and "entries" in lower:
        return PlaylistNotSupportedError(
            "Danh sách phát (playlist) chưa được hỗ trợ. Vui lòng cung cấp liên kết video đơn lẻ."
        )

    return YouTubeError("Không thể phân tích video YouTube.")
