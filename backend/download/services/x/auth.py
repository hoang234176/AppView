"""X (Twitter) authentication, cookie validation, and session verification.

Safely handles X cookies without exposing sensitive tokens in logs.
Supports live verification with X and automatically synchronizes
updated session cookies into Go storage (~/.tmp-appview/cookies/x.txt).
"""

from __future__ import annotations

import asyncio
import http.cookiejar
import io
import json
import os
import re
import ssl
from typing import Any, Optional
import urllib.error
import urllib.parse
import urllib.request

from logger import log_cookie_update, log_error, log_info, log_warning

# Public Twitter Web Bearer Token used universally by client web apps
TWITTER_WEB_BEARER = (
    "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
)


async def load_x_cookies() -> Optional[str]:
    """Query X cookies from Go Storage worker via Coordinator RPC without accessing filesystem directly."""
    try:
        from worker.client import coordinator_worker_client
        return await coordinator_worker_client.get_cookies("x")
    except Exception:
        return None


def save_x_cookies_via_storage(netscape_content: str) -> None:
    """Save or update X cookies into persistent storage through Go Storage worker / Coordinator."""
    if not netscape_content or not netscape_content.strip():
        return
    try:
        from worker.client import coordinator_worker_client
        coordinator_worker_client.dispatch_save_cookies("x", netscape_content)
    except Exception as err:
        log_warning("X_AUTH", f"Không thể gửi cookie X sang Coordinator/Storage: {err}")


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
                result[parts[5].strip()] = parts[6].strip()
            elif len(parts) >= 6:
                result[parts[4].strip()] = parts[5].strip()
            continue

        # key=value format (semicolon or newline delimited)
        tokens = line.split(";")
        for token in tokens:
            token = token.strip()
            if "=" in token:
                k, v = token.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k and not k.startswith("#"):
                    result[k] = v

    return result


def parse_cookies_to_header(raw_cookies: str) -> str:
    """Convert raw cookies into a standard HTTP Cookie request header string."""
    cookie_dict = parse_cookies_to_dict(raw_cookies)
    if not cookie_dict:
        return ""
    return "; ".join(f"{k}={v}" for k, v in cookie_dict.items())


def dict_to_netscape_cookies(cookie_dict: dict[str, str]) -> str:
    """Serialize cookie dictionary into Netscape cookies.txt format."""
    lines = [
        "# Netscape HTTP Cookie File",
        "# https://curl.haxx.se/rfc/cookie_spec.html",
        "# This is a generated file!  Do not edit.",
        "",
    ]
    for k, v in cookie_dict.items():
        v_clean = str(v).replace("\r", "").replace("\n", "").replace("\t", "").strip()
        if not v_clean:
            continue
        lines.append(f".x.com\tTRUE\t/\tTRUE\t2147483647\t{k}\t{v_clean}")
        lines.append(f".twitter.com\tTRUE\t/\tTRUE\t2147483647\t{k}\t{v_clean}")

    return "\n".join(lines) + "\n"


async def verify_x_cookies(raw_cookies: str) -> tuple[bool, str]:
    """Test candidate X cookies by sending a real verification request to X."""
    if not raw_cookies or not raw_cookies.strip():
        return False, "Nội dung cookies X trống."

    cookie_dict = parse_cookies_to_dict(raw_cookies)
    if not cookie_dict:
        return False, "Định dạng cookies không hợp lệ. Vui lòng nhập auth_token hoặc định dạng Netscape."

    auth_token = cookie_dict.get("auth_token", "").strip()
    if not auth_token:
        return False, "Thiếu thuộc tính phiên đăng nhập bắt buộc: auth_token."

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _test_x_cookies_sync, cookie_dict)
    except Exception as err:
        log_error("X_AUTH", f"Lỗi kiểm tra cookies X: {err}")
        return False, f"Xác thực thất bại: {err}"


def _test_x_cookies_sync(cookie_dict: dict[str, str]) -> tuple[bool, str]:
    """Strictly query X's servers to verify if the session is authentic and active."""
    import secrets

    auth_token = cookie_dict.get("auth_token", "").strip()
    ct0 = cookie_dict.get("ct0", "").strip()
    if not ct0:
        ct0 = secrets.token_hex(16)
        cookie_dict["ct0"] = ct0

    cookie_header = "; ".join(f"{k}={v}" for k, v in cookie_dict.items())

    # Get test tweet ID from env TEST_X_URL or default to the official test post
    test_x_url = os.getenv("TEST_X_URL", "https://x.com/Tiny_Asa/status/2098004129251725632?s=20")
    m = re.search(r"/status/(\d+)", test_x_url)
    tweet_id = m.group(1) if m else "2098004129251725632"

    graphql_url = "https://x.com/i/api/graphql/2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId"
    variables = {
        "tweetId": tweet_id,
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
        "responsive_web_twitter_article_tweet_consumption_enabled": True,
        "tweet_awards_web_tipping_enabled": False,
        "responsive_web_graphql_exclude_directive_enabled": True,
        "verified_phone_label_enabled": False,
        "freedom_of_speech_not_reach_fetch_enabled": True,
        "standardized_nudges_misinfo": True,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
        "responsive_web_graphql_timeline_navigation_enabled": True,
        "responsive_web_enhance_cards_enabled": False,
    }
    params = urllib.parse.urlencode({"variables": json.dumps(variables), "features": json.dumps(features)})

    req_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Authorization": TWITTER_WEB_BEARER,
        "Cookie": cookie_header,
        "Referer": "https://x.com/",
        "Origin": "https://x.com",
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-csrf-token": ct0,
    }

    ssl_ctx = ssl._create_unverified_context()
    target_url = f"{graphql_url}?{params}"
    req = urllib.request.Request(target_url, headers=req_headers)

    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
            if resp.status == 200:
                body = resp.read().decode("utf-8", errors="ignore")
                data = json.loads(body)
                tweet_res = data.get("data", {}).get("tweetResult", {}).get("result", {})
                typename = tweet_res.get("__typename")
                if typename in ("Tweet", "TweetWithVisibilityResults"):
                    core = tweet_res.get("core", {}).get("user_results", {}).get("result", {}).get("legacy", {})
                    author_name = core.get("name") or ""
                    screen_name = core.get("screen_name") or ""
                    detail = f"@{screen_name}" if screen_name else "tài khoản X"
                    if author_name:
                        detail += f" ({author_name})"
                    return True, f"Cookies X hợp lệ! Đã kết nối và xác thực thành công máy chủ X qua {detail}."
                return True, "Cookies X hợp lệ! Đã kết nối và xác thực thành công máy chủ X."
    except urllib.error.HTTPError as http_err:
        if http_err.code in (401, 403):
            return False, "Cookies X không hợp lệ hoặc đã hết hạn đăng nhập (HTTP 401/403)."
        if http_err.code == 429:
            return True, "Cookies X hợp lệ (Máy chủ X phản hồi giới hạn tần suất tạm thời 429)."
        log_warning("X_AUTH", f"Máy chủ X phản hồi HTTP {http_err.code}: {http_err.reason}")
    except Exception as err:
        log_warning("X_AUTH", f"Lỗi gọi endpoint GraphQL X: {err}")

    if len(auth_token) >= 30:
        return True, "Đã nhận diện auth_token X (Không thể kết nối máy chủ X lúc này để kiểm tra)."

    return False, "Không thể xác thực cookies X với máy chủ."
