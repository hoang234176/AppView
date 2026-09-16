"""Source router delegating download URLs to registered platform resolvers."""

from __future__ import annotations

from typing import Optional

from archive.contracts import DownloadResolver, ResolvedDownload
from archive.mediafire import MediaFireResolver
from logger import log_info, safe_url
from services.facebook.resolver import FacebookResolver
from services.instagram.resolver import InstagramResolver
from services.tiktok.resolver import TikTokResolver
from services.x.resolver import XResolver
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
            XResolver(),
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
        clean_url = url.strip()
        log_info("INSPECT", f"Bắt đầu kiểm tra link: {safe_url(clean_url)}")
        for resolver in self._resolvers:
            supports_fn = getattr(resolver, "supports", None)
            preview_fn = getattr(resolver, "preview", None)
            if callable(supports_fn) and supports_fn(clean_url) and callable(preview_fn):
                platform_name = resolver.__class__.__name__.replace("Resolver", "")
                log_info("INSPECT", f"Nhận diện nền tảng: {platform_name}")
                res = await preview_fn(clean_url)
                title = res.get("title") or "Không có tiêu đề"
                log_info("INSPECT", f"✓ Kiểm tra link thành công: \"{title}\" ({platform_name})")
                return res
        raise UnsupportedSourceError("Liên kết không được hỗ trợ. Hiện hỗ trợ YouTube, TikTok, Facebook, Instagram và X (Twitter).")

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
        log_info("RESOLVER", f"Bắt đầu giải mã luồng tải: {safe_url(clean_url)}")
        for resolver in self._resolvers:
            supports_fn = getattr(resolver, "supports", None)
            if callable(supports_fn) and supports_fn(clean_url):
                platform_name = resolver.__class__.__name__.replace("Resolver", "")
                log_info("RESOLVER", f"Nền tảng xử lý: {platform_name}")
                kwargs = {}
                if quality is not None:
                    kwargs["quality"] = quality
                if selected_indices is not None:
                    kwargs["selected_indices"] = selected_indices
                if media_type is not None:
                    kwargs["media_type"] = media_type

                if kwargs:
                    try:
                        resolved = await resolver.resolve(clean_url, **kwargs)
                    except TypeError:
                        resolved = await resolver.resolve(clean_url)
                else:
                    resolved = await resolver.resolve(clean_url)

                log_info("RESOLVER", f"✓ Giải mã link thành công:")
                log_info("RESOLVER", f"  • Tên file: {resolved.filename}")
                log_info("RESOLVER", f"  • Định dạng: {resolved.extension}")
                if getattr(resolved, "items", None):
                    log_info("RESOLVER", f"  • Số lượng tệp con: {len(resolved.items)}")
                return resolved

        raise UnsupportedSourceError(
            "Nguồn tải không được hỗ trợ. Hiện hỗ trợ MediaFire, YouTube, TikTok, Facebook, Instagram và X (Twitter)."
        )


# Global default instance
source_router = SourceRouter()
