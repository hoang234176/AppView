"""TikTok authentication, cookie validation, and error classification.

Handles configured cookies safely without exposing them in logs, frontend state,
or public coordinator events.
"""

from __future__ import annotations

import asyncio
import json
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


def update_tiktok_session_cookies(session_cookies: dict[str, str]) -> None:
    """Update or merge newly discovered or refreshed session cookies into the persistent cookie file."""
    if not session_cookies:
        return

    # Bỏ qua các token thử thách tạm thời WAF vì chúng hết hạn ngay lập tức gây 403 khi dùng lại
    IGNORED_COOKIES = {"_waftokenid", "msToken"}

    valid_updates = {
        str(k).strip(): str(v).strip()
        for k, v in session_cookies.items()
        if k and v and str(k).strip() not in IGNORED_COOKIES
    }
    if not valid_updates:
        return

    current_content = read_tiktok_cookies_from_file() or ""
    lines = current_content.splitlines() if current_content.strip() else ["# Netscape HTTP Cookie File"]
    updated_lines: list[str] = []
    seen_names: set[str] = set()

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            updated_lines.append(line)
            continue
        parts = line.split("\t")
        if len(parts) >= 7:
            name = parts[5].strip()
            seen_names.add(name)
            if name in valid_updates:
                parts[6] = valid_updates[name]
                updated_lines.append("\t".join(parts))
            elif name in IGNORED_COOKIES:
                continue
            else:
                updated_lines.append(line)
        else:
            updated_lines.append(line)

    # Thêm các cookie mới xuất hiện chưa từng có trong file txt
    for name, val in valid_updates.items():
        if name not in seen_names:
            updated_lines.append(f".tiktok.com\tTRUE\t/\tTRUE\t2147483647\t{name}\t{val}")

    save_tiktok_cookies_to_file("\n".join(updated_lines) + "\n")


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
    """Send an authenticated request to TikTok's passport API to verify session validity with TikTok servers."""
    import ssl
    import urllib.request
    import urllib.error
    from logger import log_info, log_warning, log_error

    cookie_pairs = [f"{c.name}={c.value}" for c in jar if "tiktok.com" in c.domain]
    if not cookie_pairs:
        log_warning("TIKTOK_AUTH", "Xác thực thất bại: Không tìm thấy cookies cho tiktok.com.")
        return False, "Không tìm thấy cookies cho tiktok.com."

    cookie_names = {c.name for c in jar if "tiktok.com" in c.domain}
    if "sessionid" not in cookie_names and "sessionid_ss" not in cookie_names:
        log_warning("TIKTOK_AUTH", "Xác thực thất bại: Thiếu token sessionid hoặc sessionid_ss.")
        return False, "Thiếu token phiên đăng nhập (cần ít nhất sessionid hoặc sessionid_ss)."

    cookie_header = "; ".join(cookie_pairs)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.tiktok.com/",
        "Origin": "https://www.tiktok.com",
        "Cookie": cookie_header,
    }

    ssl_context = ssl._create_unverified_context()
    req = urllib.request.Request("https://www.tiktok.com/passport/web/account/info/", headers=headers)

    log_info("TIKTOK_AUTH", "Đang gửi yêu cầu xác thực cookie đến máy chủ TikTok (passport/web/account/info)...")

    try:
        with urllib.request.urlopen(req, timeout=12, context=ssl_context) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            res = json.loads(body)

            msg = res.get("message")
            data = res.get("data") or {}

            # When authenticated, TikTok returns message == "success" and user_id / user_id_str
            if msg == "success" and (data.get("user_id") or data.get("user_id_str")):
                uid = str(data.get("user_id_str") or data.get("user_id"))
                username = data.get("username") or data.get("screen_name") or f"ID: {uid}"
                log_info("TIKTOK_AUTH", f"✓ Kết quả xác thực TikTok: HỢP LỆ (tài khoản: {username})")
                return True, f"Xác thực cookies TikTok thành công (tài khoản: {username})."

            desc = data.get("description") or "Phiên đăng nhập đã hết hạn hoặc không hợp lệ."
            if "session expired" in desc.lower():
                desc = "Phiên đăng nhập TikTok đã hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại và lấy cookie mới."
            log_warning("TIKTOK_AUTH", f"✕ Kết quả xác thực TikTok: KHÔNG HỢP LỆ ({desc})")
            return False, f"TikTok phản hồi: {desc}"

    except urllib.error.HTTPError as err:
        if err.code in (401, 403):
            log_warning("TIKTOK_AUTH", f"✕ Kết quả xác thực TikTok: Bị từ chối HTTP {err.code} (Cookie không hợp lệ hoặc đã hết hạn)")
            return False, "TikTok từ chối phiên đăng nhập (HTTP 401/403). Cookie không hợp lệ hoặc đã hết hạn."
        log_error("TIKTOK_AUTH", f"✕ Lỗi máy chủ TikTok khi kiểm tra cookie: HTTP {err.code}")
        return False, f"Lỗi máy chủ TikTok khi kiểm tra cookie (HTTP {err.code})."
    except urllib.error.URLError as err:
        log_error("TIKTOK_AUTH", f"✕ Lỗi mạng khi kết nối máy chủ TikTok: {err.reason}")
        return False, f"Không thể kết nối đến TikTok để xác thực cookie: {err.reason}"
    except Exception as err:
        log_error("TIKTOK_AUTH", f"✕ Lỗi ngoại lệ khi xác thực cookie TikTok: {err}")
        return False, f"Lỗi xác thực cookie TikTok: {err}"
