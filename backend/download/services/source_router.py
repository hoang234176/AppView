"""Source router delegating download URLs to registered platform resolvers."""

from __future__ import annotations

from typing import Optional

from archive.contracts import DownloadResolver, ResolvedDownload
from archive.mediafire import MediaFireResolver
from services.facebook.resolver import FacebookResolver
from services.instagram.resolver import InstagramResolver
from services.tiktok.resolver import TikTokResolver
from services.youtube.errors import UnsupportedSourceError
from services.youtube.resolver import YouTubeResolver


class SourceRouter(DownloadResolver):
    """Routes an incoming download URL to the appropriate platform resolver."""

    def __init__(self, resolvers: Optional[list[DownloadResolver]] = None):
        self._resolvers: list[DownloadResolver] = resolvers or [
            YouTubeResolver(),
            TikTokResolver(),
            FacebookResolver(),
            InstagramResolver(),
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
            supports_fn = getattr(resolver, "supports", None)
            preview_fn = getattr(resolver, "preview", None)
            if callable(supports_fn) and supports_fn(url) and callable(preview_fn):
                return await preview_fn(url)
        raise UnsupportedSourceError("Liên kết không được hỗ trợ. Hiện hỗ trợ YouTube, TikTok, Facebook và Instagram.")

    async def resolve(
        self,
        url: str,
        *,
        quality: Optional[int] = None,
        selected_indices: Optional[list[int]] = None,
        media_type: Optional[str] = None,
    ) -> ResolvedDownload:
        """Resolve the URL using the first supporting resolver."""
        clean_url = url.strip()
        for resolver in self._resolvers:
            supports_fn = getattr(resolver, "supports", None)
            if callable(supports_fn) and supports_fn(clean_url):
                kwargs = {}
                if quality is not None:
                    kwargs["quality"] = quality
                if selected_indices is not None:
                    kwargs["selected_indices"] = selected_indices
                if media_type is not None:
                    kwargs["media_type"] = media_type

                if kwargs:
                    try:
                        return await resolver.resolve(clean_url, **kwargs)
                    except TypeError:
                        pass
                return await resolver.resolve(clean_url)

        raise UnsupportedSourceError(
            "Nguồn tải không được hỗ trợ. Hiện hỗ trợ MediaFire, YouTube, TikTok, Facebook và Instagram."
        )


# Global default instance
source_router = SourceRouter()
