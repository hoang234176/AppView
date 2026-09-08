"""Public YouTube resolver implementing the DownloadResolver protocol."""

from __future__ import annotations

import re
import urllib.parse
from typing import Optional

from archive.contracts import DownloadResolver, ResolvedDownload
from services.youtube.errors import NoDownloadableMediaError, UnsupportedSourceError
from services.youtube.extractor import YouTubeExtractor

# Matches youtube.com, www.youtube.com, m.youtube.com, youtu.be
YOUTUBE_HOST_PATTERN = re.compile(r"^(?:(?:www\.|m\.)?youtube\.com|youtu\.be)$", re.IGNORECASE)


class YouTubeResolver(DownloadResolver):
    """Resolves YouTube URLs into normalized AppView download contracts."""

    def __init__(self, extractor: Optional[YouTubeExtractor] = None):
        self._extractor = extractor or YouTubeExtractor()

    def supports(self, url: str) -> bool:
        """Check if URL belongs to YouTube."""
        try:
            parsed = urllib.parse.urlparse(url.strip())
            if parsed.scheme not in ("http", "https"):
                return False
            host = parsed.netloc.split(":")[0].lower()
            return bool(YOUTUBE_HOST_PATTERN.match(host))
        except Exception:
            return False

    async def preview(self, url: str) -> dict:
        if not self.supports(url):
            raise UnsupportedSourceError("URL không phải là liên kết YouTube hợp lệ.")
        post = await self._extractor.extract(url.strip(), preview=True)
        return {"source": post.source, "title": post.title, "thumbnail": post.thumbnail,
                "uploader": post.uploader, "qualities": post.qualities}

    async def resolve(self, url: str, *, quality: Optional[int] = None) -> ResolvedDownload:
        """Resolve YouTube URL to normalized media descriptor."""
        clean_url = url.strip()
        if not self.supports(clean_url):
            raise UnsupportedSourceError("URL không phải là liên kết YouTube hợp lệ.")

        post = await self._extractor.extract(clean_url, quality=quality) if quality is not None else await self._extractor.extract(clean_url)
        if not post.items:
            raise NoDownloadableMediaError("Không tìm thấy tệp phương tiện để tải xuống từ video YouTube này.")

        primary = post.items[0]
        return ResolvedDownload(
            original_url=clean_url,
            download_url=primary.download_url,
            filename=primary.filename,
            extension=primary.extension,
            audio_url=primary.audio_url,
            headers=primary.http_headers,
            source="youtube",
        )
