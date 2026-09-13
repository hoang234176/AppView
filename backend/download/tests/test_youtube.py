"""Tests for YouTube resolver, extractor, auth, and error handling."""

import os
import unittest
from unittest.mock import MagicMock, patch

from archive.contracts import ResolvedDownload
from services.source_router import SourceRouter
from services.youtube.auth import (
    classify_extraction_error,
    get_youtube_cookies_path,
    get_youtube_ydl_auth_opts,
)
from services.youtube.errors import (
    NoDownloadableMediaError,
    PlaylistNotSupportedError,
    SourceAccessDeniedError,
    SourceAuthRequiredError,
    SourceNotFoundError,
    UnsupportedSourceError,
    YouTubeError,
)
from services.youtube.extractor import (
    YouTubeExtractor,
    filter_safe_headers,
    is_playlist_url,
    sanitize_filename,
)
from services.youtube.models import YouTubeMediaItem, YouTubePost
from services.youtube.resolver import YouTubeResolver
from worker.handler import DownloadWorkerHandler
from worker.protocol import TASK_ASSIGN, TASK_COMPLETED, TASK_FAILED


class TestYouTubeURLRouting(unittest.TestCase):
    def setUp(self):
        self.resolver = YouTubeResolver()

    def test_supports_standard_watch_urls(self):
        self.assertTrue(self.resolver.supports("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        self.assertTrue(self.resolver.supports("https://youtube.com/watch?v=dQw4w9WgXcQ"))
        self.assertTrue(self.resolver.supports("http://youtube.com/watch?v=dQw4w9WgXcQ"))

    def test_supports_short_urls(self):
        self.assertTrue(self.resolver.supports("https://youtu.be/dQw4w9WgXcQ"))
        self.assertTrue(self.resolver.supports("http://youtu.be/dQw4w9WgXcQ"))

    def test_supports_mobile_urls(self):
        self.assertTrue(self.resolver.supports("https://m.youtube.com/watch?v=dQw4w9WgXcQ"))

    def test_supports_shorts_and_live(self):
        self.assertTrue(self.resolver.supports("https://www.youtube.com/shorts/abc123xyz"))
        self.assertTrue(self.resolver.supports("https://www.youtube.com/live/abc123xyz"))

    def test_rejects_non_youtube_urls(self):
        self.assertFalse(self.resolver.supports("https://mediafire.com/?abc123xyz"))
        self.assertFalse(self.resolver.supports("https://facebook.com/video/123"))
        self.assertFalse(self.resolver.supports("https://instagram.com/p/123"))
        self.assertFalse(self.resolver.supports("https://tiktok.com/@user/video/123"))
        self.assertFalse(self.resolver.supports("https://example.com/video.mp4"))
        self.assertFalse(self.resolver.supports(""))
        self.assertFalse(self.resolver.supports("not a url"))

    def test_is_playlist_url(self):
        self.assertTrue(is_playlist_url("https://www.youtube.com/playlist?list=PL12345"))
        self.assertTrue(is_playlist_url("https://youtube.com/playlist?list=PL12345"))
        self.assertTrue(is_playlist_url("https://www.youtube.com/watch?list=PL12345"))
        # URL with both video id and list should NOT be treated as playlist-only
        self.assertFalse(is_playlist_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL12345"))
        self.assertFalse(is_playlist_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))


class TestYouTubeAuthAndErrorClassification(unittest.TestCase):
    def test_classify_age_restriction(self):
        err = classify_extraction_error("ERROR: Sign in to confirm your age. This video may be inappropriate.")
        self.assertIsInstance(err, SourceAuthRequiredError)
        self.assertEqual(err.code, "SOURCE_AUTH_REQUIRED")

    def test_classify_bot_or_login(self):
        err = classify_extraction_error("Sign in to confirm you’re not a bot")
        self.assertIsInstance(err, SourceAuthRequiredError)
        self.assertEqual(err.code, "SOURCE_AUTH_REQUIRED")

    def test_classify_private_video(self):
        err = classify_extraction_error("Private video. Sign in if you've been granted access.")
        self.assertIsInstance(err, SourceAccessDeniedError)
        self.assertEqual(err.code, "SOURCE_ACCESS_DENIED")

    def test_classify_video_unavailable(self):
        err = classify_extraction_error("Video unavailable. This video has been removed by the uploader")
        self.assertIsInstance(err, SourceNotFoundError)
        self.assertEqual(err.code, "SOURCE_NOT_FOUND")

    def test_cookie_handling_no_leakage(self):
        with patch.dict(os.environ, {}, clear=True):
            opts = get_youtube_ydl_auth_opts()
            self.assertEqual(opts, {})

        test_path = "/tmp/non_existent_cookies_appview_test.txt"
        with patch.dict(os.environ, {"YOUTUBE_COOKIES_FILE": test_path}):
            # Non-existent file is ignored safely
            self.assertIsNone(get_youtube_cookies_path())


class TestYouTubeExtractorNormalization(unittest.TestCase):
    def test_sanitize_filename(self):
        self.assertEqual(sanitize_filename("Normal Title"), "Normal Title")
        self.assertEqual(
            sanitize_filename("Title / With \\ Bad : Chars * ? < > |"),
            "Title _ With _ Bad _ Chars _ _ _ _ _",
        )
        self.assertEqual(sanitize_filename(""), "youtube_video")

    def test_filter_safe_headers_never_leaks_cookies(self):
        raw = {
            "User-Agent": "TestUA/1.0",
            "Referer": "https://www.youtube.com/",
            "Cookie": "PREF=f1=50000000; SID=secret123",
            "Authorization": "Bearer token123",
            "Accept": "*/*",
        }
        filtered = filter_safe_headers(raw)
        self.assertEqual(filtered.get("User-Agent"), "TestUA/1.0")
        self.assertEqual(filtered.get("Referer"), "https://www.youtube.com/")
        self.assertEqual(filtered.get("Accept"), "*/*")
        self.assertNotIn("Cookie", filtered)
        self.assertNotIn("Authorization", filtered)

    def test_select_best_streams_progressive(self):
        extractor = YouTubeExtractor()
        formats = [
            {
                "url": "https://googlevideo.com/videoplayback?id=18",
                "ext": "mp4",
                "height": 720,
                "vcodec": "avc1.4d401f",
                "acodec": "mp4a.40.2",
                "filesize": 1000000,
                "http_headers": {"User-Agent": "AppView"},
            }
        ]
        item = extractor._select_best_streams("vid123", "Test_Video", formats)
        self.assertEqual(item.download_url, "https://googlevideo.com/videoplayback?id=18")
        self.assertIsNone(item.audio_url)
        self.assertEqual(item.filename, "[YouTube]_Test_Video.mp4")
        self.assertEqual(item.size_bytes, 1000000)

    def test_select_best_streams_adaptive_video_and_audio(self):
        extractor = YouTubeExtractor()
        formats = [
            # 360p progressive
            {
                "url": "https://googlevideo.com/videoplayback?id=18",
                "ext": "mp4",
                "height": 360,
                "vcodec": "avc1.42001e",
                "acodec": "mp4a.40.2",
                "filesize": 500000,
            },
            # 1080p video only
            {
                "url": "https://googlevideo.com/videoplayback?id=137",
                "ext": "mp4",
                "height": 1080,
                "vcodec": "avc1.640028",
                "acodec": "none",
                "filesize": 3000000,
                "http_headers": {"User-Agent": "AppView"},
            },
            # audio only
            {
                "url": "https://googlevideo.com/videoplayback?id=140",
                "ext": "m4a",
                "height": None,
                "vcodec": "none",
                "acodec": "mp4a.40.2",
                "abr": 128,
                "filesize": 400000,
            },
        ]
        item = extractor._select_best_streams("vid123", "High_Quality", formats)
        # Should select the 1080p stream as primary video and audio stream for muxing
        self.assertEqual(item.download_url, "https://googlevideo.com/videoplayback?id=137")
        self.assertEqual(item.audio_url, "https://googlevideo.com/videoplayback?id=140")
        self.assertEqual(item.height, 1080)
        self.assertEqual(item.size_bytes, 3400000)


class TestSourceRouter(unittest.IsolatedAsyncioTestCase):
    async def test_router_delegates_youtube_and_mediafire(self):
        mock_yt = MagicMock()
        mock_yt.supports.side_effect = lambda u: "youtube.com" in u
        mock_yt.resolve = unittest.mock.AsyncMock(
            return_value=ResolvedDownload("https://youtube.com/watch?v=1", "https://dl.youtube", "v.mp4", ".mp4", source="youtube")
        )

        mock_mf = MagicMock()
        mock_mf.supports.side_effect = lambda u: "mediafire.com" in u
        mock_mf.resolve = unittest.mock.AsyncMock(
            return_value=ResolvedDownload("https://mediafire.com/?abc", "https://dl.mf", "a.zip", ".zip", source="mediafire")
        )

        router = SourceRouter(resolvers=[mock_yt, mock_mf])
        self.assertTrue(router.supports("https://www.youtube.com/watch?v=1"))
        self.assertTrue(router.supports("https://mediafire.com/?abc"))
        self.assertFalse(router.supports("https://facebook.com/123"))

        yt_res = await router.resolve("https://www.youtube.com/watch?v=1")
        self.assertEqual(yt_res.source, "youtube")
        mock_yt.resolve.assert_awaited_once()

        mf_res = await router.resolve("https://mediafire.com/?abc")
        self.assertEqual(mf_res.source, "mediafire")
        mock_mf.resolve.assert_awaited_once()

        with self.assertRaises(UnsupportedSourceError):
            await router.resolve("https://facebook.com/123")


class TestWorkerHandlerYouTube(unittest.IsolatedAsyncioTestCase):
    async def test_handler_forwards_auth_required_error(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve = unittest.mock.AsyncMock(
            side_effect=SourceAuthRequiredError("This YouTube video requires an authenticated account with permission to access it.")
        )
        handler = DownloadWorkerHandler(resolver=mock_resolver)

        sent = []
        async def send(msg):
            sent.append(msg)

        envelope = {
            "type": TASK_ASSIGN,
            "taskId": "task-auth-test",
            "action": "resolve_download",
            "payload": {"url": "https://www.youtube.com/watch?v=age_restricted"},
        }
        await handler.handle(envelope, send)

        self.assertEqual(len(sent), 2)
        # First message is TASK_ACCEPTED
        self.assertEqual(sent[0]["type"], "task.accepted")
        # Second message is TASK_FAILED with SOURCE_AUTH_REQUIRED
        self.assertEqual(sent[1]["type"], TASK_FAILED)
        self.assertEqual(sent[1]["taskId"], "task-auth-test")
        self.assertEqual(sent[1]["error"]["code"], "SOURCE_AUTH_REQUIRED")
        self.assertIn("authenticated account", sent[1]["error"]["message"])

    async def test_handler_forwards_audio_url_and_headers_in_result(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve = unittest.mock.AsyncMock(
            return_value=ResolvedDownload(
                original_url="https://www.youtube.com/watch?v=123",
                download_url="https://googlevideo.com/v123",
                filename="Video.mp4",
                extension=".mp4",
                audio_url="https://googlevideo.com/a123",
                headers={"User-Agent": "TestAppView"},
                source="youtube",
            )
        )
        handler = DownloadWorkerHandler(resolver=mock_resolver)

        sent = []
        async def send(msg):
            sent.append(msg)

        envelope = {
            "type": TASK_ASSIGN,
            "taskId": "task-success-test",
            "action": "resolve_download",
            "payload": {"url": "https://www.youtube.com/watch?v=123"},
        }
        await handler.handle(envelope, send)

        self.assertEqual(len(sent), 2)
        self.assertEqual(sent[1]["type"], TASK_COMPLETED)
        result = sent[1]["result"]
        self.assertEqual(result["downloadUrl"], "https://googlevideo.com/v123")
        self.assertEqual(result["audioUrl"], "https://googlevideo.com/a123")
        self.assertEqual(result["headers"], {"User-Agent": "TestAppView"})
        self.assertEqual(result["source"], "youtube")


class TestYouTubeCancellation(unittest.IsolatedAsyncioTestCase):
    async def test_extract_cancellation_terminates_underlying_thread(self):
        import asyncio
        import threading
        import time

        extractor = YouTubeExtractor()
        thread_started = threading.Event()
        thread_finished = threading.Event()
        urlopen_called = threading.Event()

        # Intercept _CancellableYoutubeDL to simulate active network activity
        orig_extract_sync = extractor._extract_sync

        def blocking_extract_sync(url, cancel_event, ydl_ref, finished):
            thread_started.set()
            try:
                # Simulate work that checks cancel_event during urlopen
                # We also invoke orig_extract_sync with a mock or simulate
                def fake_urlopen(req):
                    urlopen_called.set()
                    # Wait until cancelled or timeout
                    for _ in range(50):
                        if cancel_event.is_set():
                            raise Exception("Simulated cancel in urlopen")
                        time.sleep(0.02)
                    return MagicMock()

                from services.youtube.extractor import _CancellableYoutubeDL
                ydl = _CancellableYoutubeDL({"quiet": True}, cancel_event=cancel_event)
                ydl.urlopen = fake_urlopen
                ydl_ref[0] = ydl
                fake_urlopen("dummy_req")
            finally:
                thread_finished.set()
                if finished is not None:
                    finished.set()

        extractor._extract_sync = blocking_extract_sync

        task = asyncio.create_task(extractor.extract("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        # Wait for thread to start and reach network call
        for _ in range(50):
            if thread_started.is_set() and urlopen_called.is_set():
                break
            await asyncio.sleep(0.01)

        self.assertTrue(thread_started.is_set())
        self.assertTrue(urlopen_called.is_set())
        self.assertFalse(thread_finished.is_set(), "Thread should be running before cancel")

        # Cancel the awaiting task
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task

        # The underlying thread MUST be terminated immediately upon cancellation return
        self.assertTrue(
            thread_finished.is_set(),
            "Underlying extraction thread must be terminated when task cancellation completes",
        )


if __name__ == "__main__":
    unittest.main()
