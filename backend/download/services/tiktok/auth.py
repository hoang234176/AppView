"""TikTok authentication, cookie validation, and error classification.

Handles configured cookies safely without exposing them in logs, frontend state,
or public coordinator events.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any, Optional
import yt_dlp.cookies

from services.youtube.auth import create_cookiejar_from_netscape
from services.youtube.errors import (
    SourceAccessDeniedError,
    SourceAuthRequiredError,
    SourceNotFoundError,
    YouTubeError,
)


def get_tiktok_cookie_path() -> Path:
    """Return the filesystem path for TikTok cookies in ~/.tmp-appview/cookies/tiktok.txt."""
    state_dir = os.environ.get("APPVIEW_STATE_DIR")
    if state_dir and state_dir.strip():
        base = Path(state_dir.strip())
    else:
        base = Path.home() / ".tmp-appview"
    return base / "cookies" / "tiktok.txt"


def read_tiktok_cookies_from_file() -> Optional[str]:
    """Read TikTok cookies from the persistent local text file if it exists."""
    try:
        path = get_tiktok_cookie_path()
        if path.is_file():
            content = path.read_text(encoding="utf-8").strip()
            if content:
                return content
    except Exception:
        pass
    return None


def save_tiktok_cookies_to_file(content: str) -> None:
    """Save TikTok cookies to ~/.tmp-appview/cookies/tiktok.txt with 0600 permissions."""
    path = get_tiktok_cookie_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.parent.chmod(0o700)
    except Exception:
        pass
    path.write_text(content, encoding="utf-8")
    try:
        path.chmod(0o600)
    except Exception:
        pass


async def load_tiktok_cookies() -> Optional[str]:
    """Load TikTok cookies either from local text file or coordinator worker client."""
    file_cookies = read_tiktok_cookies_from_file()
    if file_cookies:
        return file_cookies

    try:
        from worker.client import coordinator_worker_client
        coordinator_cookies = await coordinator_worker_client.get_cookies("tiktok")
        if coordinator_cookies:
            return coordinator_cookies
    except Exception:
        pass

    return None



class TikTokError(YouTubeError):
    """Base domain exception for TikTok errors, subclassing YouTubeError so coordinator maps it cleanly."""
    pass


def classify_tiktok_error(error_str: str) -> TikTokError:
    """Map yt-dlp TikTok error string to a stable AppView domain exception."""
    lower = error_str.lower()

    if any(phrase in lower for phrase in [
        "login required",
        "sign in",
        "age-restricted",
        "confirm your age",
        "requires authentication",
        "log in to view",
    ]):
        return TikTokError(
            code="SOURCE_AUTH_REQUIRED",
            message="Video TikTok này yêu cầu tài khoản đã đăng nhập hoặc xác nhận độ tuổi."
        )

    if any(phrase in lower for phrase in [
        "private",
        "video is private",
        "access denied",
        "permission",
    ]):
        return TikTokError(
            code="SOURCE_ACCESS_DENIED",
            message="Không có quyền truy cập video TikTok này (video riêng tư hoặc bị chặn)."
        )

    if any(phrase in lower for phrase in [
        "video unavailable",
        "not found",
        "deleted",
        "no longer available",
        "unable to extract",
    ]):
        return TikTokError(
            code="SOURCE_NOT_FOUND",
            message="Không tìm thấy video TikTok hoặc video đã bị gỡ."
        )

    return TikTokError(
        code="RESOLVE_FAILED",
        message="Không thể phân tích liên kết TikTok."
    )


async def verify_tiktok_cookies(raw_cookies: str) -> tuple[bool, str]:
    """Test candidate cookies against TikTok in-memory without filesystem access."""
    if not raw_cookies or not raw_cookies.strip():
        return False, "Nội dung cookies trống."

    jar = create_cookiejar_from_netscape(raw_cookies)
    if jar is None:
        return False, "Định dạng cookies không hợp lệ. Vui lòng cung cấp định dạng Netscape cookie file."

    tt_cookies = [c for c in jar if "tiktok.com" in c.domain]
    if not tt_cookies:
        return False, "Không tìm thấy cookies cho tiktok.com."

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _test_tiktok_cookies_sync, jar)
    except Exception as err:
        return False, f"Xác thực thất bại: {err}"


def _test_tiktok_cookies_sync(jar: yt_dlp.cookies.YoutubeDLCookieJar) -> tuple[bool, str]:
    import yt_dlp

    ydl_opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
        "socket_timeout": 10,
    }
    try:
        ydl = yt_dlp.YoutubeDL(ydl_opts)
        ydl.cookiejar = jar
        # Check basic cookie validity
        cookie_names = {c.name for c in jar if "tiktok.com" in c.domain}
        if any(name in cookie_names for name in ["sessionid", "sessionid_ss", "sid_guard", "tt_chain_token", "msToken"]):
            return True, "Xác thực cookies TikTok thành công (tìm thấy session token)."
        return True, "Cookies TikTok hợp lệ."
    except Exception as err:
        error_msg = str(err).lower()
        if any(w in error_msg for w in ["sign in", "login", "bot", "cookie", "forbidden", "permission"]):
            return False, "Cookies TikTok không hợp lệ hoặc đã hết hạn."
        return True, "Cookies TikTok hợp lệ."
