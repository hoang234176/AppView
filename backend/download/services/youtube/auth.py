"""YouTube authentication and error classification.

Handles configured cookies safely without exposing them in logs, frontend state,
or public coordinator events.
"""

from __future__ import annotations

import os
import tempfile
from typing import Any, Optional

from services.youtube.errors import (
    PlaylistNotSupportedError,
    SourceAccessDeniedError,
    SourceAuthRequiredError,
    SourceNotFoundError,
    YouTubeError,
)

_TEMP_COOKIE_FILE: Optional[str] = None


def get_youtube_cookies_path() -> Optional[str]:
    """Return path to YouTube cookie file if configured, otherwise None."""
    global _TEMP_COOKIE_FILE

    # 1. Directly configured path via environment variable
    configured_path = os.environ.get("YOUTUBE_COOKIES_FILE")
    if configured_path and os.path.isfile(configured_path):
        return configured_path

    # 2. Raw cookie content passed via environment variable
    raw_cookies = os.environ.get("YOUTUBE_COOKIES")
    if raw_cookies and raw_cookies.strip():
        if _TEMP_COOKIE_FILE and os.path.isfile(_TEMP_COOKIE_FILE):
            return _TEMP_COOKIE_FILE
        # Write to secure temporary file with 0600 permissions
        fd, path = tempfile.mkstemp(prefix="yt_cookies_", suffix=".txt")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(raw_cookies.strip())
            os.chmod(path, 0o600)
            _TEMP_COOKIE_FILE = path
            return path
        except Exception:
            return None

    return None


def get_youtube_ydl_auth_opts() -> dict[str, Any]:
    """Return yt-dlp authentication options without exposing raw contents."""
    cookie_path = get_youtube_cookies_path()
    if cookie_path:
        return {"cookiefile": cookie_path}
    return {}


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
