"""Source router delegating download URLs to registered platform resolvers."""

from __future__ import annotations

from typing import Optional

from archive.contracts import DownloadResolver, ResolvedDownload
from archive.mediafire import MediaFireResolver
from services.youtube.errors import UnsupportedSourceError
from services.youtube.resolver import YouTubeResolver


class SourceRouter(DownloadResolver):
    """Routes an incoming download URL to the appropriate platform resolver."""

    def __init__(self, resolvers: Optional[list[DownloadResolver]] = None):
        self._resolvers: list[DownloadResolver] = resolvers or [
            YouTubeResolver(),
            MediaFireResolver(),
        ]

    def register(self, resolver: DownloadResolver) -> None:
        """Register a new platform resolver."""
        self._resolvers.append(resolver)

    def supports(self, url: str) -> bool:
        """Check if any registered resolver supports this URL."""
        for resolver in self._resolvers:
            supports_fn = getattr(resolver, "supports", None)
            if callable(supports_fn) and supports_fn(url):
                return True
        return False

    async def preview(self, url: str) -> dict:
        for resolver in self._resolvers:
            if isinstance(resolver, YouTubeResolver) and resolver.supports(url):
                return await resolver.preview(url)
        raise UnsupportedSourceError("Liên kết không được hỗ trợ. Hiện chỉ hỗ trợ video YouTube.")

    async def resolve(self, url: str, *, quality: Optional[int] = None) -> ResolvedDownload:
        """Resolve the URL using the first supporting resolver."""
        clean_url = url.strip()
        for resolver in self._resolvers:
            supports_fn = getattr(resolver, "supports", None)
            if callable(supports_fn) and supports_fn(clean_url):
                if quality is not None:
                    if not isinstance(resolver, YouTubeResolver):
                        raise UnsupportedSourceError("Nguồn tải không hỗ trợ lựa chọn chất lượng.")
                    return await resolver.resolve(clean_url, quality=quality)
                return await resolver.resolve(clean_url)

        raise UnsupportedSourceError(
            "Nguồn tải không được hỗ trợ. Hiện chỉ hỗ trợ MediaFire và YouTube."
        )


# Global default instance
source_router = SourceRouter()
