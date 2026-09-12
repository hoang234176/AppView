"""Facebook extraction and authentication error definitions."""

from __future__ import annotations
from typing import Optional


class FacebookError(Exception):
    """Base exception for Facebook service errors."""

    def __init__(self, message: str, code: str = "FACEBOOK_ERROR"):
        super().__init__(message)
        self.code = code
        self.message = message


class FacebookAuthRequiredError(FacebookError):
    """Raised when access to Facebook post requires authentication/cookies."""

    def __init__(self, message: str = "Bài viết Facebook này yêu cầu đăng nhập hoặc cookies hợp lệ."):
        super().__init__(message, code="SOURCE_AUTH_REQUIRED")


class FacebookNotFoundError(FacebookError):
    """Raised when Facebook post is not found or has been removed."""

    def __init__(self, message: str = "Không tìm thấy bài viết Facebook hoặc bài viết đã bị gỡ."):
        super().__init__(message, code="SOURCE_NOT_FOUND")


class FacebookAccessDeniedError(FacebookError):
    """Raised when access to Facebook post is blocked or restricted."""

    def __init__(self, message: str = "Không có quyền truy cập bài viết Facebook này (bài viết riêng tư hoặc bị giới hạn)."):
        super().__init__(message, code="SOURCE_ACCESS_DENIED")


class FacebookUnsupportedPostError(FacebookError):
    """Raised when URL does not contain downloadable post media."""

    def __init__(self, message: str = "Liên kết không chứa bài viết Facebook hợp lệ."):
        super().__init__(message, code="UNSUPPORTED_POST")


def classify_facebook_error(err_msg: str) -> FacebookError:
    """Classify raw error message into normalized FacebookError."""
    lower = err_msg.lower()
    if any(k in lower for k in ["login", "đăng nhập", "checkpoint", "auth", "session", "requires authentication"]):
        return FacebookAuthRequiredError()
    if any(k in lower for k in ["not found", "không tìm thấy", "removed", "gỡ", "unavailable", "không khả dụng"]):
        return FacebookNotFoundError()
    if any(k in lower for k in ["private", "permission", "riêng tư", "access denied", "restricted", "giới hạn"]):
        return FacebookAccessDeniedError()
    return FacebookError(f"Lỗi đọc bài viết Facebook: {err_msg}", code="RESOLVE_FAILED")
