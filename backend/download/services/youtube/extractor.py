"""YouTube media extractor wrapping yt-dlp.

This module is strictly isolated to YouTube extraction. yt-dlp options and schema
do not leak outside this boundary.
"""

from __future__ import annotations

import asyncio
import re
import threading
from functools import partial
import urllib.parse
from typing import Any, Optional

import yt_dlp

from services.youtube.auth import classify_extraction_error, get_youtube_ydl_auth_opts
from services.youtube.errors import (
    NoDownloadableMediaError,
    PlaylistNotSupportedError,
    QualityUnavailableError,
    YouTubeError,
)
from services.youtube.models import YouTubeMediaItem, YouTubePost

# Safe headers that Storage can use when fetching media from Googlevideo
SAFE_HEADER_KEYS = {"user-agent", "referer", "accept", "accept-language"}


class _CancellableYoutubeDL(yt_dlp.YoutubeDL):
    """YoutubeDL subclass that checks a cancellation event before and during HTTP requests."""

    def __init__(self, *args, cancel_event: Optional[threading.Event] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._cancel_event = cancel_event

    def urlopen(self, req):
        if self._cancel_event and self._cancel_event.is_set():
            raise yt_dlp.utils.DownloadCancelled("YouTube extraction cancelled")
        return super().urlopen(req)


def sanitize_filename(name: str) -> str:
    """Sanitize title into a safe filename without path traversal or invalid characters."""
    name = re.sub(r'[\/\\:\*\?"<>\|\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "youtube_video"


def is_playlist_url(url: str) -> bool:
    """Detect if URL is explicitly a playlist without a primary video."""
    try:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.lower()
        query = urllib.parse.parse_qs(parsed.query)

        if "/playlist" in path:
            return True
        if "list" in query and "v" not in query:
            return True
        return False
    except Exception:
        return False


def filter_safe_headers(headers: Optional[dict[str, Any]]) -> dict[str, str]:
    """Extract only safe transfer headers, never passing cookies or tokens."""
    if not headers:
        return {}
    filtered = {}
    for key, value in headers.items():
        if key.lower() in SAFE_HEADER_KEYS and isinstance(value, str):
            filtered[key] = value
    return filtered


class YouTubeExtractor:
    """Isolates yt-dlp invocation and normalizes YouTube results into AppView models."""

    async def extract(self, url: str, *, quality: Optional[int] = None, preview: bool = False) -> YouTubePost:
        if is_playlist_url(url):
            raise PlaylistNotSupportedError(
                "Danh sách phát (playlist) chưa được hỗ trợ. Vui lòng cung cấp liên kết video đơn lẻ."
            )

        cancel_event = threading.Event()
        finished = threading.Event()
        ydl_ref: list[Optional[yt_dlp.YoutubeDL]] = [None]

        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(
            None,
            partial(self._extract_sync, quality=quality, preview=preview) if quality is not None or preview else self._extract_sync,
            url,
            cancel_event,
            ydl_ref,
            finished,
        )
        try:
            return await future
        except asyncio.CancelledError:
            cancel_event.set()
            ydl = ydl_ref[0]
            if ydl is not None:
                try:
                    ydl.close()
                except Exception:
                    pass
            # Preserve the bounded cleanup wait without blocking heartbeats
            # or depending on another free slot in the extraction executor.
            deadline = loop.time() + 5.0
            while not finished.is_set() and loop.time() < deadline:
                await asyncio.sleep(0.01)
            raise

    def _extract_sync(
        self,
        url: str,
        cancel_event: Optional[threading.Event] = None,
        ydl_ref: Optional[list[Optional[yt_dlp.YoutubeDL]]] = None,
        finished: Optional[threading.Event] = None,
        *,
        quality: Optional[int] = None,
        preview: bool = False,
    ) -> YouTubePost:
        try:
            if cancel_event and cancel_event.is_set():
                raise yt_dlp.utils.DownloadCancelled("YouTube extraction cancelled")

            ydl_opts: dict[str, Any] = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "extract_flat": False,
                "socket_timeout": 10,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["ios", "android", "web"],
                    }
                },
            }
            ydl_opts.update(get_youtube_ydl_auth_opts())

            try:
                with _CancellableYoutubeDL(ydl_opts, cancel_event=cancel_event) as ydl:
                    if ydl_ref is not None:
                        ydl_ref[0] = ydl
                    if cancel_event and cancel_event.is_set():
                        raise yt_dlp.utils.DownloadCancelled("YouTube extraction cancelled")
                    info = ydl.extract_info(url, download=False)
            except yt_dlp.utils.DownloadCancelled:
                raise
            except Exception as err:
                if cancel_event and cancel_event.is_set():
                    raise yt_dlp.utils.DownloadCancelled("YouTube extraction cancelled") from err
                raise classify_extraction_error(str(err)) from err

            if cancel_event and cancel_event.is_set():
                raise yt_dlp.utils.DownloadCancelled("YouTube extraction cancelled")
        finally:
            if finished is not None:
                finished.set()

        if not info:
            raise NoDownloadableMediaError("Không nhận được dữ liệu từ video YouTube.")

        if info.get("_type") == "playlist" or "entries" in info:
            raise PlaylistNotSupportedError(
                "Danh sách phát (playlist) chưa được hỗ trợ. Vui lòng cung cấp liên kết video đơn lẻ."
            )

        title = str(info.get("title") or info.get("id") or "video")
        clean_title = sanitize_filename(title)
        video_id = str(info.get("id") or "video")
        canonical_url = str(info.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}")
        uploader = info.get("uploader") or info.get("channel")

        formats = info.get("formats", [])
        if not formats and "url" in info:
            # Single direct format returned
            formats = [info]

        qualities = self.available_qualities(formats)
        if preview and not qualities:
            raise NoDownloadableMediaError()
        media_item = None if preview else self._select_best_streams(video_id, clean_title, formats, quality=quality)
        thumbnail = info.get("thumbnail")
        if not isinstance(thumbnail, str) or urllib.parse.urlparse(thumbnail).scheme not in ("http", "https"):
            thumbnail = None
        return YouTubePost(
            id=video_id,
            title=title,
            canonical_url=canonical_url,
            items=[media_item] if media_item else [],
            uploader=uploader,
            source="youtube",
            thumbnail=thumbnail,
            qualities=qualities,
        )

    @staticmethod
    def _transfer_formats(formats: list[dict[str, Any]]) -> list[dict[str, Any]]:
        # Storage downloads direct byte streams; manifests, storyboards and
        # DRM formats cannot be offered as downloadable renditions.
        return [f for f in formats if isinstance(f, dict)
                and isinstance(f.get("url"), str)
                and urllib.parse.urlparse(f["url"]).scheme in ("http", "https")
                and f.get("protocol", "https") in ("http", "https")
                and not f.get("has_drm")
                and f.get("ext") not in ("mhtml", "none")
                and not (f.get("format_note") or "").startswith("storyboard")]

    @classmethod
    def available_qualities(cls, formats: list[dict[str, Any]]) -> list[int]:
        return sorted({f["height"] for f in cls._transfer_formats(formats)
                       if f.get("vcodec") not in ("none", None)
                       and type(f.get("height")) is int and f["height"] > 0}, reverse=True)

    def _select_best_streams(
        self,
        video_id: str,
        clean_title: str,
        formats: list[dict[str, Any]],
        *,
        quality: Optional[int] = None,
    ) -> YouTubeMediaItem:
        """Select either the highest quality progressive stream or separate video+audio streams."""
        valid_formats = self._transfer_formats(formats)
        if quality is not None:
            if type(quality) is not int or quality not in self.available_qualities(valid_formats):
                raise QualityUnavailableError()
            # Keep the matching source video and all audio candidates. Never
            # select a larger source and rely on Storage to downscale it.
            valid_formats = [f for f in valid_formats if f.get("vcodec") in ("none", None) or f.get("height") == quality]

        # 1. Progressive streams (contain both video and audio)
        progressive = [
            f for f in valid_formats
            if f.get("vcodec") not in ("none", None) and f.get("acodec") not in ("none", None)
        ]
        # Sort progressive by resolution / height descending
        progressive.sort(
            key=lambda f: (f.get("height") or 0, f.get("tbr") or 0),
            reverse=True,
        )

        # 2. Video-only streams
        video_only = [
            f for f in valid_formats
            if f.get("vcodec") not in ("none", None) and f.get("acodec") in ("none", None)
        ]
        # Prefer MP4 container / H.264 when available at high resolution, sorted by height
        video_only.sort(
            key=lambda f: (
                f.get("height") or 0,
                1 if f.get("ext") == "mp4" else 0,
                f.get("tbr") or 0,
            ),
            reverse=True,
        )

        # 3. Audio-only streams
        audio_only = [
            f for f in valid_formats
            if f.get("vcodec") in ("none", None) and f.get("acodec") not in ("none", None)
        ]
        # Prefer m4a/aac or highest bitrate
        audio_only.sort(
            key=lambda f: (
                1 if f.get("ext") in ("m4a", "mp4") else 0,
                f.get("abr") or f.get("tbr") or 0,
            ),
            reverse=True,
        )

        # Strategy:
        # If we have separate video and audio, and the video height is >= progressive height (or no progressive):
        # We select best video + best audio so Storage can mux them without loss.
        # Otherwise, if progressive is equal or better, use progressive.
        chosen_video: Optional[dict[str, Any]] = None
        chosen_audio: Optional[dict[str, Any]] = None

        best_prog = progressive[0] if progressive else None
        best_prog_height = (best_prog.get("height") or 0) if best_prog else 0

        best_v = video_only[0] if video_only else None
        best_v_height = (best_v.get("height") or 0) if best_v else 0

        if best_v and audio_only and best_v_height > best_prog_height:
            chosen_video = best_v
            chosen_audio = audio_only[0]
        elif best_prog:
            chosen_video = best_prog
            chosen_audio = None
        elif best_v and audio_only:
            chosen_video = best_v
            chosen_audio = audio_only[0]
        elif best_v:
            # Video only (no audio available from source)
            chosen_video = best_v
            chosen_audio = None
        else:
            raise NoDownloadableMediaError(
                "Không tìm thấy luồng video phù hợp cho video YouTube này."
            )

        download_url = chosen_video["url"]
        audio_url = chosen_audio["url"] if chosen_audio else None

        # Build safe headers from the video format
        raw_headers = chosen_video.get("http_headers") or {}
        safe_headers = filter_safe_headers(raw_headers)

        # Determine actual file size if known (never estimate)
        v_size = chosen_video.get("filesize")
        a_size = chosen_audio.get("filesize") if chosen_audio else 0
        total_size: Optional[int] = None
        if isinstance(v_size, int) and v_size > 0:
            if chosen_audio is None:
                total_size = v_size
            elif isinstance(a_size, int) and a_size > 0:
                total_size = v_size + a_size

        return YouTubeMediaItem(
            id=video_id,
            type="video",
            download_url=download_url,
            audio_url=audio_url,
            filename=f"{clean_title}.mp4",
            extension=".mp4",
            mime_type=chosen_video.get("ext") or "mp4",
            width=chosen_video.get("width"),
            height=chosen_video.get("height"),
            duration=chosen_video.get("duration"),
            size_bytes=total_size,
            http_headers=safe_headers if safe_headers else None,
        )
