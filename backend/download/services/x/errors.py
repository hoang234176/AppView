"""Domain error types for X (Twitter) resolution."""

from __future__ import annotations


class XPostError(Exception):
    """Base exception for X/Twitter extraction failures."""

    def __init__(self, message: str = "Không thể phân tích bài viết X (Twitter).", code: str = "X_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class XNotFoundError(XPostError):
    """Raised when the tweet is deleted, suspended, or does not exist."""

    def __init__(self, message: str = "Bài viết X (Twitter) không tồn tại hoặc đã bị xóa."):
        super().__init__(message, code="X_NOT_FOUND")


class XUnsupportedUrlError(XPostError):
    """Raised when the URL is not a recognized X or Twitter status link."""

    def __init__(self, message: str = "Liên kết không phải là bài viết X (Twitter) hợp lệ."):
        super().__init__(message, code="X_UNSUPPORTED_URL")


class XRateLimitError(XPostError):
    """Raised when rate limited by X/Twitter APIs."""

    def __init__(self, message: str = "Đã vượt quá giới hạn yêu cầu từ X (Twitter). Vui lòng thử lại sau."):
        super().__init__(message, code="X_RATE_LIMITED")


class XAuthRequiredError(XPostError):
    """Raised when access to X post requires authentication/cookies (NSFW, age-restricted, or protected)."""

    def __init__(
        self,
        message: str = "Bài viết X này yêu cầu đăng nhập (nội dung 18+ / nhạy cảm hoặc tài khoản riêng tư). Vui lòng cấu hình Cookie X.",
    ):
        super().__init__(message, code="X_AUTH_REQUIRED")
