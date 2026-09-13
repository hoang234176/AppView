"""Instagram extraction and download exception hierarchy."""

from __future__ import annotations


class InstagramError(Exception):
    """Base exception for Instagram operations."""
    pass


class InstagramAuthRequiredError(InstagramError):
    """Raised when an Instagram post requires authentication / login or returns 403."""
    pass


class InstagramNotFoundError(InstagramError):
    """Raised when an Instagram post or media is not found."""
    pass


class InstagramUnsupportedPostError(InstagramError):
    """Raised when an Instagram URL is not supported or not recognized."""
    pass
