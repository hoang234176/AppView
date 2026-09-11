"""TikTok service package."""

from services.tiktok.auth import TikTokError, verify_tiktok_cookies, classify_tiktok_error
from services.tiktok.extractor import TikTokExtractor

__all__ = [
    "TikTokError",
    "verify_tiktok_cookies",
    "classify_tiktok_error",
    "TikTokExtractor",
]
