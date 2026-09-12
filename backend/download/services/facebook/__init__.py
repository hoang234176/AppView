"""Facebook package exports."""

from services.facebook.auth import verify_facebook_cookies, get_facebook_cookie_path, read_facebook_cookies_from_file
from services.facebook.errors import FacebookError, classify_facebook_error
from services.facebook.extractor import FacebookExtractor
from services.facebook.resolver import FacebookResolver

__all__ = [
    "FacebookError",
    "FacebookExtractor",
    "FacebookResolver",
    "classify_facebook_error",
    "verify_facebook_cookies",
    "get_facebook_cookie_path",
    "read_facebook_cookies_from_file",
]
