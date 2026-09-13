"""Instagram authentication, cookie validation, and session verification.

Safely handles Instagram cookies without exposing sensitive tokens in logs.
Supports live verification with Instagram and automatically synchronizes
updated session cookies into Go storage (~/.tmp-appview/cookies/instagram.txt).
"""

from __future__ import annotations

import asyncio
import http.cookiejar
import json
import os
from pathlib import Path
import re
import ssl
from typing import Any, Optional
import urllib.error
import urllib.request

from logger import log_error, log_info, log_warning


def get_instagram_cookie_path() -> Path:
    """Return the filesystem path for Instagram cookies in ~/.tmp-appview/cookies/instagram.txt."""
    state_dir = os.environ.get("APPVIEW_STATE_DIR")
    if state_dir and state_dir.strip():
        base = Path(state_dir.strip())
    else:
        base = Path.home() / ".tmp-appview"
    return base / "cookies" / "instagram.txt"


def read_instagram_cookies_from_file() -> Optional[str]:
    """Read Instagram cookies from ~/.tmp-appview/cookies/instagram.txt if it exists."""
    try:
        path = get_instagram_cookie_path()
        if path.is_file():
            content = path.read_text(encoding="utf-8").strip()
            if content:
                return content
    except Exception as err:
        log_warning("INSTAGRAM_AUTH", f"Không thể đọc file cookie Instagram: {err}")
    return None


def save_instagram_cookies_to_file(content: str) -> None:
    """Save Instagram cookies directly to ~/.tmp-appview/cookies/instagram.txt with 0600 permissions."""
    path = get_instagram_cookie_path()
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


def save_instagram_cookies_via_storage(netscape_content: str) -> None:
    """Save or update Instagram cookies into persistent storage through Go Storage worker / Coordinator."""
    if not netscape_content or not netscape_content.strip():
        return

    # 1. Update directly to persistent file with 0600 permissions
    save_instagram_cookies_to_file(netscape_content)

    # 2. Try saving through Coordinator HTTP API to invoke Go Storage worker
    coordinator_base = os.environ.get("COORDINATOR_URL", "http://127.0.0.1:8090")
    if coordinator_base.startswith("ws://"):
        coordinator_base = "http://" + coordinator_base[5:].split("/")[0]
    elif coordinator_base.startswith("wss://"):
        coordinator_base = "https://" + coordinator_base[6:].split("/")[0]
    if not coordinator_base.startswith("http"):
        coordinator_base = f"http://{coordinator_base}"

    try:
        save_url = f"{coordinator_base.rstrip('/')}/api/v1/cookies/save"
        payload = json.dumps({"platform": "instagram", "cookies": netscape_content}).encode("utf-8")
        req = urllib.request.Request(
            save_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx, timeout=4) as resp:
            if resp.status == 200:
                log_info("INSTAGRAM_AUTH", "✓ Đã đồng bộ cookie Instagram vào Go storage qua Coordinator HTTP API.")
                return
    except Exception:
        pass

    # 3. If running in an active asyncio loop with connected worker client, trigger WS save
    try:
        loop = asyncio.get_running_loop()
        from worker.client import coordinator_worker_client
        if coordinator_worker_client._websocket is not None:
            loop.create_task(coordinator_worker_client.save_cookies("instagram", netscape_content))
    except Exception:
        pass


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

    pairs: list[str] = []
    seen: set[str] = set()
    priority = ["sessionid", "ds_user_id", "csrftoken", "mid", "ig_did", "rur", "datr"]
    for p in priority:
        if p in cookie_dict:
            pairs.append(f"{p}={cookie_dict[p]}")
            seen.add(p)
    for k, v in cookie_dict.items():
        if k not in seen:
            pairs.append(f"{k}={v}")
    return "; ".join(pairs)


def dict_to_netscape_cookies(cookie_dict: dict[str, str]) -> str:
    """Convert dictionary of cookies to standard Netscape file content for Instagram."""
    lines = [
        "# Netscape HTTP Cookie File",
        "# https://curl.se/docs/http-cookies.html",
        "# This file was generated by AppView. Do not edit.\n",
    ]
    priority = ["sessionid", "ds_user_id", "csrftoken", "mid", "ig_did", "rur", "datr"]
    used = set()
    for key in priority:
        if key in cookie_dict and cookie_dict[key].strip():
            lines.append(f".instagram.com\tTRUE\t/\tTRUE\t2147483647\t{key}\t{cookie_dict[key].strip()}")
            used.add(key)
    for key, val in cookie_dict.items():
        if key not in used and val.strip():
            lines.append(f".instagram.com\tTRUE\t/\tTRUE\t2147483647\t{key}\t{val.strip()}")
    return "\n".join(lines) + "\n"


def update_instagram_session_cookies_from_headers(set_cookie_headers: list[str]) -> bool:
    """Parse Set-Cookie headers from Instagram responses, merge changes, and save through Go storage."""
    if not set_cookie_headers:
        return False

    updates: dict[str, str] = {}
    for sc in set_cookie_headers:
        if not sc or not sc.strip():
            continue
        first_part = sc.split(";")[0].strip()
        if "=" in first_part:
            k, v = first_part.split("=", 1)
            k, v = k.strip(), v.strip()
            # Ignore session deletion values
            if v in ("", '""', "deleted", "None"):
                continue
            updates[k] = v

    if not updates:
        return False

    # Merge with currently stored cookies
    current_raw = read_instagram_cookies_from_file() or ""
    current_dict = parse_cookies_to_dict(current_raw)
    changed = False
    for k, v in updates.items():
        if current_dict.get(k) != v:
            current_dict[k] = v
            changed = True

    if changed:
        netscape_content = dict_to_netscape_cookies(current_dict)
        save_instagram_cookies_via_storage(netscape_content)
        log_info("INSTAGRAM_AUTH", f"✓ Đã cập nhật {len(updates)} cookie từ Instagram vào Go storage: {list(updates.keys())}")
        return True

    return False


def create_cookiejar_from_netscape(raw_cookies: str) -> http.cookiejar.CookieJar:
    """Create an in-memory CookieJar from Netscape formatted cookies or dictionary string."""
    jar = http.cookiejar.CookieJar()
    cookie_dict = parse_cookies_to_dict(raw_cookies)

    for name, value in cookie_dict.items():
        cookie = http.cookiejar.Cookie(
            version=0,
            name=name,
            value=value,
            port=None,
            port_specified=False,
            domain=".instagram.com",
            domain_specified=True,
            domain_initial_dot=True,
            path="/",
            path_specified=True,
            secure=True,
            expires=2147483647,
            discard=False,
            comment=None,
            comment_url=None,
            rest={"HttpOnly": None},
        )
        jar.set_cookie(cookie)
    return jar


async def verify_instagram_cookies(raw_cookies: str) -> tuple[bool, str]:
    """Test candidate Instagram cookies by sending a real verification request to Instagram."""
    if not raw_cookies or not raw_cookies.strip():
        return False, "Nội dung cookies Instagram trống."

    cookie_dict = parse_cookies_to_dict(raw_cookies)
    if not cookie_dict:
        return False, "Định dạng cookies không hợp lệ. Vui lòng nhập các thuộc tính như sessionid, ds_user_id..."

    sessionid = cookie_dict.get("sessionid", "").strip()
    if not sessionid:
        return False, "Thiếu thuộc tính phiên đăng nhập bắt buộc: sessionid."

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _test_instagram_cookies_sync, cookie_dict)
    except Exception as err:
        log_error("INSTAGRAM_AUTH", f"Lỗi xác thực cookies Instagram: {err}")
        return False, f"Xác thực thất bại: {err}"


def _test_instagram_cookies_sync(cookie_dict: dict[str, str]) -> tuple[bool, str]:
    """Strictly query Instagram's servers to verify if the session is authentic and active.

    If Instagram returns updated cookies (Set-Cookie), they are automatically merged
    and saved into Go storage (~/.tmp-appview/cookies/instagram.txt).
    """
    sessionid = cookie_dict.get("sessionid", "").strip()
    user_id = cookie_dict.get("ds_user_id", "").strip()
    cookie_header = parse_cookies_to_header("; ".join(f"{k}={v}" for k, v in cookie_dict.items()))

    ssl_context = ssl._create_unverified_context()
    https_handler = urllib.request.HTTPSHandler(context=ssl_context)
    opener = urllib.request.build_opener(https_handler)

    log_info("INSTAGRAM_AUTH", f"Đang gửi yêu cầu xác thực phiên đăng nhập đến Instagram (user_id={user_id or 'unknown'})...")

    # Step 1: Test with Instagram mobile API: /api/v1/accounts/current_user/?edit=true
    mobile_headers = {
        "User-Agent": "Instagram 320.0.0.18.109 (iPhone14,3; iOS 17_0; en_US; en-US; scale=3.00; 1284x2778; 576974247)",
        "X-IG-App-ID": "124024574287414",
        "Cookie": cookie_header,
        "Accept": "*/*",
    }

    try:
        req = urllib.request.Request("https://i.instagram.com/api/v1/accounts/current_user/?edit=true", headers=mobile_headers)
        with opener.open(req, timeout=12) as resp:
            set_cookies = resp.headers.get_all("Set-Cookie") or []
            update_instagram_session_cookies_from_headers(set_cookies)

            body_bytes = resp.read()
            body_str = body_bytes.decode("utf-8", errors="ignore")
            if body_str.startswith("{"):
                res_data = json.loads(body_str)
                # If Instagram returns status == "fail" or something went wrong:
                if res_data.get("status") == "fail":
                    msg = res_data.get("message") or "Phiên đăng nhập không hợp lệ trên máy chủ Instagram."
                    log_warning("INSTAGRAM_AUTH", f"Instagram từ chối xác thực: {msg}")
                    return False, f"Xác thực thất bại từ Instagram: {msg}"

                if res_data.get("status") == "ok" or "user" in res_data:
                    user_info = res_data.get("user") or {}
                    username = user_info.get("username") or user_id or "Instagram User"
                    log_info("INSTAGRAM_AUTH", f"✓ Xác thực cookies Instagram thành công qua mobile API (@{username})")
                    return True, f"Xác thực cookies Instagram thành công (Tài khoản: @{username})."
    except urllib.error.HTTPError as http_err:
        set_cookies = http_err.headers.get_all("Set-Cookie") or []
        update_instagram_session_cookies_from_headers(set_cookies)
        if http_err.code in (401, 403):
            log_warning("INSTAGRAM_AUTH", f"Instagram trả về HTTP {http_err.code} Unauthorized/Forbidden.")
            return False, f"Cookies Instagram không hợp lệ hoặc đã hết hạn trên máy chủ Instagram (HTTP {http_err.code})."
    except Exception as err:
        log_info("INSTAGRAM_AUTH", f"Mobile API test bỏ qua ({err}), tiếp tục thử web API...")

    # Step 2: Test with Instagram web profile info API
    web_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "Cookie": cookie_header,
        "Accept": "*/*",
        "Referer": "https://www.instagram.com/",
    }

    try:
        req = urllib.request.Request("https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram", headers=web_headers)
        with opener.open(req, timeout=12) as resp:
            set_cookies = resp.headers.get_all("Set-Cookie") or []
            update_instagram_session_cookies_from_headers(set_cookies)

            # Check if session was deleted
            for sc in set_cookies:
                if 'sessionid=""' in sc or 'sessionid=deleted' in sc:
                    log_warning("INSTAGRAM_AUTH", "Instagram trả về Set-Cookie xóa sessionid.")
                    return False, "Cookies Instagram không hợp lệ hoặc đã bị Instagram hủy phiên."

            if resp.status == 200:
                log_info("INSTAGRAM_AUTH", "✓ Xác thực cookies Instagram thành công qua web profile API.")
                return True, "Xác thực cookies Instagram thành công với máy chủ Instagram."
    except urllib.error.HTTPError as http_err:
        set_cookies = http_err.headers.get_all("Set-Cookie") or []
        update_instagram_session_cookies_from_headers(set_cookies)
        if http_err.code in (401, 403):
            return False, f"Cookies Instagram không hợp lệ hoặc đã hết hạn (Máy chủ Instagram trả về HTTP {http_err.code})."
    except Exception as err:
        log_warning("INSTAGRAM_AUTH", f"Lỗi kết nối khi xác thực với Instagram: {err}")
        return False, f"Không thể kết nối đến máy chủ Instagram để xác thực: {err}"

    return False, "Máy chủ Instagram từ chối phiên đăng nhập cookie này."
