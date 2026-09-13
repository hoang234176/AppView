"""Facebook package exports."""

from services.facebook.auth import verify_facebook_cookies, load_facebook_cookies
from services.facebook.errors import FacebookError, classify_facebook_error
from services.facebook.extractor import FacebookExtractor
from services.facebook.resolver import FacebookResolver

__all__ = [
    "FacebookError",
    "FacebookExtractor",
    "FacebookResolver",
    "classify_facebook_error",
    "verify_facebook_cookies",
    "load_facebook_cookies",
]
