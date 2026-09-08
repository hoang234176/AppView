"""Intermediate representations for YouTube-resolved media."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class YouTubeMediaItem:
    """Represents a single resolvable media stream or item."""
    id: str
    download_url: str
    filename: str
    extension: str
    type: str = "video"
    audio_url: Optional[str] = None
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    size_bytes: Optional[int] = None
    http_headers: Optional[dict[str, str]] = None


@dataclass(frozen=True)
class YouTubePost:
    """Represents a normalized YouTube post / video structure."""
    id: str
    title: str
    canonical_url: str
    items: list[YouTubeMediaItem] = field(default_factory=list)
    uploader: Optional[str] = None
    source: str = "youtube"
