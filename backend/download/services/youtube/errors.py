"""YouTube-specific error models for AppView."""

class YouTubeError(Exception):
    """Base exception for YouTube operations."""
    code: str = "SOURCE_RESOLVE_FAILED"

    def __init__(self, message: str = "Không thể phân tích video YouTube.", code: str | None = None):
        super().__init__(message)
        if code:
            self.code = code
        self.message = message


class SourceAuthRequiredError(YouTubeError):
    """Raised when YouTube video requires authenticated login or age confirmation."""
    code: str = "SOURCE_AUTH_REQUIRED"

    def __init__(self, message: str = "This YouTube video requires an authenticated account with permission to access it."):
        super().__init__(message, code=self.code)


class SourceAccessDeniedError(YouTubeError):
    """Raised when YouTube video is private or access is restricted."""
    code: str = "SOURCE_ACCESS_DENIED"

    def __init__(self, message: str = "Video này là riêng tư hoặc bị từ chối truy cập."):
        super().__init__(message, code=self.code)


class SourceNotFoundError(YouTubeError):
    """Raised when YouTube video cannot be found or has been removed."""
    code: str = "SOURCE_NOT_FOUND"

    def __init__(self, message: str = "Không tìm thấy video YouTube này (video có thể đã bị xóa hoặc không tồn tại)."):
        super().__init__(message, code=self.code)


class PlaylistNotSupportedError(YouTubeError):
    """Raised when a playlist URL is supplied."""
    code: str = "PLAYLIST_NOT_SUPPORTED"

    def __init__(self, message: str = "Danh sách phát (playlist) chưa được hỗ trợ. Vui lòng cung cấp liên kết video đơn lẻ."):
        super().__init__(message, code=self.code)


class NoDownloadableMediaError(YouTubeError):
    """Raised when no suitable playable video or audio streams were found."""
    code: str = "NO_DOWNLOADABLE_MEDIA"

    def __init__(self, message: str = "Không tìm thấy luồng dữ liệu tải xuống phù hợp cho video YouTube này."):
        super().__init__(message, code=self.code)


class UnsupportedSourceError(YouTubeError):
    """Raised when URL is not a recognized or supported YouTube URL."""
    code: str = "UNSUPPORTED_SOURCE"

    def __init__(self, message: str = "Nguồn tải không được hỗ trợ."):
        super().__init__(message, code=self.code)
