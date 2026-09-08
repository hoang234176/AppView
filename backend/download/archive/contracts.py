"""Các hợp đồng dùng chung cho mọi nguồn tải.

Thêm một nền tảng mới chỉ cần triển khai ``DownloadResolver``; downloader,
extractor và video pipeline không cần biết URL đến từ MediaFire hay nơi khác.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ResolvedDownload:
    original_url: str
    download_url: str
    filename: str
    extension: str


class DownloadResolver(Protocol):
    async def resolve(self, url: str) -> ResolvedDownload:
        """Chuyển URL của nền tảng thành URL tải trực tiếp an toàn."""
