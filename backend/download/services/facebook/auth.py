"""Facebook authentication, cookie validation, and session verification.

Safely handles Facebook cookies without exposing sensitive tokens or secrets in logs.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error
import ssl
import json
import re

from logger import log_error, log_info, log_warning
from services.facebook.errors import FacebookError


def get_facebook_cookie_path() -> Path:
    """Return the filesystem path for Facebook cookies in ~/.tmp-appview/cookies/facebook.txt."""
    state_dir = os.environ.get("APPVIEW_STATE_DIR")
    if state_dir and state_dir.strip():
        base = Path(state_dir.strip())
    else:
        base = Path.home() / ".tmp-appview"
    return base / "cookies" / "facebook.txt"


def read_facebook_cookies_from_file() -> Optional[str]:
    """Read Facebook cookies from ~/.tmp-appview/cookies/facebook.txt if it exists."""
    try:
        path = get_facebook_cookie_path()
        if path.is_file():
            content = path.read_text(encoding="utf-8").strip()
            if content:
                return content
    except Exception:
        pass
    return None


def parse_cookies_to_dict(raw_cookies: str) -> dict[str, str]:
    """Parse raw cookies (Netscape format or key=value; format) into a dictionary."""
    if not raw_cookies or not raw_cookies.strip():
        return {}

    result: dict[str, str] = {}
    lines = raw_cookies.splitlines()

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Netscape format tab-separated line
        if "\t" in line and not line.startswith("#"):
            parts = line.split("\t")
            if len(parts) >= 7:
                name = parts[5].strip()
                val = parts[6].strip()
                if name:
                    result[name] = val
            continue

        # Standard header or key=value; format
        if "=" in line and not line.startswith("#"):
            # Could be multiple cookies separated by ;
            tokens = line.split(";")
            for token in tokens:
                token = token.strip()
                if "=" in token:
                    k, v = token.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    if k:
                        result[k] = v

    return result


def parse_cookies_to_header(raw_cookies: str) -> str:
    """Convert Netscape cookie text or key=value string to standard Cookie header string."""
    cookie_dict = parse_cookies_to_dict(raw_cookies)
    if not cookie_dict:
        return ""
    # Place c_user and xs first if present
    pairs: list[str] = []
    seen: set[str] = set()
    priority = ["c_user", "xs", "datr", "fr", "sb", "presence"]
    for p in priority:
        if p in cookie_dict:
            pairs.append(f"{p}={cookie_dict[p]}")
            seen.add(p)
    for k, v in cookie_dict.items():
        if k not in seen:
            pairs.append(f"{k}={v}")
    return "; ".join(pairs)


async def verify_facebook_cookies(raw_cookies: str) -> tuple[bool, str]:
    """Test candidate Facebook cookies in-memory without persisting to disk."""
    if not raw_cookies or not raw_cookies.strip():
        return False, "Nội dung cookies Facebook trống."

    cookie_dict = parse_cookies_to_dict(raw_cookies)
    if not cookie_dict:
        return False, "Định dạng cookies không hợp lệ. Vui lòng nhập các thuộc tính như c_user, xs, datr..."

    # Check essential Facebook session cookies
    c_user = cookie_dict.get("c_user")
    xs = cookie_dict.get("xs")
    if not c_user or not xs:
        return False, "Thiếu thuộc tính phiên đăng nhập bắt buộc: c_user hoặc xs."

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _test_facebook_cookies_sync, cookie_dict)
    except Exception as err:
        log_error("FACEBOOK_AUTH", f"Lỗi xác thực cookies Facebook: {err}")
        return False, f"Xác thực thất bại: {err}"


def _test_facebook_cookies_sync(cookie_dict: dict[str, str]) -> tuple[bool, str]:
    """Synchronous test request to Facebook to verify if session cookies are active."""
    c_user = cookie_dict.get("c_user", "").strip()
    xs = cookie_dict.get("xs", "").strip()
    cookie_header = parse_cookies_to_header("; ".join(f"{k}={v}" for k, v in cookie_dict.items()))

    # Use Safari UA so Facebook accepts the request without HTTP 400 Bad Request
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cookie": cookie_header,
    }

    ssl_context = ssl._create_unverified_context()
    https_handler = urllib.request.HTTPSHandler(context=ssl_context)
    opener = urllib.request.build_opener(https_handler)

    log_info("FACEBOOK_AUTH", f"Đang gửi yêu cầu xác thực cookie đến Facebook (c_user={c_user[:4]}***)...")

    # 1. Fast test via mbasic.facebook.com/me (lightweight, responds in 1-3 seconds)
    try:
        fast_req = urllib.request.Request(
            "https://mbasic.facebook.com/me",
            headers={**headers, "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}
        )
        with opener.open(fast_req, timeout=8) as resp:
            final_url = resp.geturl().lower()
            set_cookies = resp.headers.get_all("Set-Cookie") or []

            for sc in set_cookies:
                if "c_user=deleted" in sc or "c_user=;" in sc:
                    log_warning("FACEBOOK_AUTH", "Xác thực thất bại: Facebook trả về Set-Cookie: c_user=deleted.")
                    return False, "Cookies Facebook không hợp lệ hoặc đã hết hạn (Facebook đã xóa c_user)."

            if "/login" in final_url or "checkpoint" in final_url:
                log_warning("FACEBOOK_AUTH", f"Xác thực thất bại: Bị chuyển hướng đến trang đăng nhập ({final_url}).")
                return False, "Cookies Facebook đã hết hạn hoặc không hợp lệ (chuyển hướng login)."

            if "mbasic.facebook.com" in final_url and "/login" not in final_url:
                body_chunk = resp.read(65536).decode("utf-8", errors="replace")
                if 'name="pass"' not in body_chunk and 'id="pass"' not in body_chunk:
                    log_info("FACEBOOK_AUTH", f"✓ Xác thực cookies Facebook thành công (User ID: {c_user})")
                    return True, f"Xác thực cookies Facebook thành công (User ID: {c_user})."
    except Exception as fast_err:
        log_info("FACEBOOK_AUTH", f"Fast check qua mbasic bỏ qua ({fast_err}), tiếp tục qua www.facebook.com...")

    # 2. Fallback test via www.facebook.com
    test_url = "https://www.facebook.com/"
    req = urllib.request.Request(test_url, headers=headers)

    try:
        with opener.open(req, timeout=25) as resp:
            final_url = resp.geturl().lower()
            set_cookies = resp.headers.get_all("Set-Cookie") or []
            body = resp.read().decode("utf-8", errors="replace")

            # 1. If Facebook explicitly sends c_user=deleted or c_user=; in Set-Cookie, session is invalid
            for sc in set_cookies:
                if "c_user=deleted" in sc or "c_user=;" in sc:
                    log_warning("FACEBOOK_AUTH", "Xác thực thất bại: Facebook trả về Set-Cookie: c_user=deleted.")
                    return False, "Cookies Facebook không hợp lệ hoặc đã hết hạn (Facebook đã xóa c_user)."

            # 2. Check if redirected to login or checkpoint
            if "/login" in final_url or "checkpoint" in final_url:
                log_warning("FACEBOOK_AUTH", f"Xác thực thất bại: Bị chuyển hướng đến trang đăng nhập ({final_url}).")
                return False, "Cookies Facebook đã hết hạn hoặc không hợp lệ (chuyển hướng login)."

            # 3. Check for positive presence of user ID in response
            user_patterns = [
                f'"{c_user}"',
                f'"USER_ID":"{c_user}"',
                f'"ACCOUNT_ID":"{c_user}"',
                f'"actorID":"{c_user}"',
            ]
            if any(pat in body for pat in user_patterns):
                log_info("FACEBOOK_AUTH", f"✓ Xác thực cookies Facebook thành công (User ID: {c_user})")
                return True, f"Xác thực cookies Facebook thành công (User ID: {c_user})."

            # 4. Check for presence of password field or login button which indicates unauthenticated login screen
            has_login_input = ('name="pass"' in body or 'id="pass"' in body or 'data-testid="royal_login_button"' in body)
            if has_login_input:
                log_warning("FACEBOOK_AUTH", "Xác thực thất bại: Trang trả về chứa form đăng nhập.")
                return False, "Cookies Facebook không hợp lệ hoặc đã hết hạn."

            # 5. If not explicitly rejected and no login input was shown, accept valid session
            log_info("FACEBOOK_AUTH", f"✓ Xác thực cookies Facebook thành công (User ID: {c_user})")
            return True, f"Xác thực cookies Facebook thành công (User ID: {c_user})."

    except urllib.error.HTTPError as http_err:
        if http_err.code in (301, 302, 303, 307):
            location = http_err.headers.get("Location", "").lower()
            if "/login" in location or "checkpoint" in location:
                return False, "Cookies Facebook đã hết hạn (chuyển hướng login)."
            return True, f"Xác thực cookies Facebook thành công (User ID: {c_user})."
        log_warning("FACEBOOK_AUTH", f"Lỗi HTTP xác thực Facebook: {http_err.code}")
        return False, f"Máy chủ Facebook trả về mã HTTP {http_err.code}."
    except Exception as err:
        log_error("FACEBOOK_AUTH", f"Lỗi kết nối Facebook: {err}")
        return False, f"Không thể kết nối đến máy chủ Facebook: {err}"
