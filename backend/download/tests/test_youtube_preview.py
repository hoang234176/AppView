import asyncio
import json
import threading
import unittest
from unittest.mock import AsyncMock, patch

from services.source_router import SourceRouter
from services.youtube.errors import QualityUnavailableError, UnsupportedSourceError
from services.youtube.extractor import YouTubeExtractor
from services.youtube.resolver import YouTubeResolver
from worker.client import CoordinatorWorkerClient
from worker.handler import DownloadWorkerHandler


def video(height, **extra):
    return {"url": f"https://media.example/v{height}", "height": height,
            "vcodec": "avc1", "acodec": "none", "ext": "mp4", **extra}


FORMATS = [
    video(720, acodec="aac"), video(2160), video(1080),
    video(1080, ext="webm", url="https://media.example/webm1080"),
    {"url": "https://media.example/audio", "vcodec": "none", "acodec": "aac", "ext": "m4a"},
]


class YouTubeQualityTests(unittest.TestCase):
    def test_available_qualities_unique_descending_and_downloadable(self):
        formats = FORMATS + [video(None), video(0), video(True), video("480"),
                             video(4320, has_drm=True), video(480, protocol="m3u8_native"),
                             video(360, url="file:///secret"), video(240, ext="mhtml"),
                             video(1440, url=""), video(144, format_note="storyboard")]
        self.assertEqual(YouTubeExtractor.available_qualities(formats), [2160, 1080, 720])

    def test_selected_source_resolution_keeps_separate_audio(self):
        item = YouTubeExtractor()._select_best_streams("id", "title", FORMATS, quality=1080)
        self.assertEqual(item.height, 1080)
        self.assertEqual(item.download_url, "https://media.example/v1080")
        self.assertEqual(item.audio_url, "https://media.example/audio")

    def test_progressive_quality_needs_no_audio_mux(self):
        item = YouTubeExtractor()._select_best_streams("id", "title", FORMATS, quality=720)
        self.assertEqual(item.download_url, "https://media.example/v720")
        self.assertIsNone(item.audio_url)

    def test_unavailable_or_invalid_quality_never_falls_back(self):
        for quality in [1440, 0, -1, True, "1080", 1080.0]:
            with self.subTest(quality=quality), self.assertRaises(QualityUnavailableError):
                YouTubeExtractor()._select_best_streams("id", "title", FORMATS, quality=quality)

    def test_regression_progressive_and_video_only_with_audio_qualities(self):
        # 360p progressive + 720p/1080p video-only + audio => [1080, 720, 360]
        formats = [
            {"url": "https://media.test/v360", "height": 360, "vcodec": "avc1", "acodec": "aac", "ext": "mp4"},
            {"url": "https://media.test/v720", "height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v1080", "height": 1080, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio", "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a"},
        ]
        qualities = YouTubeExtractor.available_qualities(formats)
        self.assertEqual(qualities, [1080, 720, 360])

    def test_regression_duplicate_heights_normalized_unique(self):
        # duplicate heights => unique values
        formats = [
            {"url": "https://media.test/v1080_mp4", "height": 1080, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v1080_webm", "height": 1080, "vcodec": "vp9", "acodec": "none", "ext": "webm"},
            {"url": "https://media.test/v720_prog", "height": 720, "vcodec": "avc1", "acodec": "aac", "ext": "mp4"},
            {"url": "https://media.test/v720_video", "height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
        ]
        qualities = YouTubeExtractor.available_qualities(formats)
        self.assertEqual(qualities, [1080, 720])

    def test_regression_select_1080_resolves_exact_1080_video(self):
        # select 1080 => exact 1080 video
        formats = [
            {"url": "https://media.test/v360", "height": 360, "vcodec": "avc1", "acodec": "aac", "ext": "mp4"},
            {"url": "https://media.test/v720", "height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v1080", "height": 1080, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio", "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a"},
        ]
        item = YouTubeExtractor()._select_best_streams("vid123", "Test_Video", formats, quality=1080)
        self.assertEqual(item.height, 1080)
        self.assertEqual(item.download_url, "https://media.test/v1080")

    def test_regression_unavailable_quality_errors_without_fallback(self):
        # unavailable quality => error
        formats = [
            {"url": "https://media.test/v720", "height": 720, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio", "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a"},
        ]
        with self.assertRaises(QualityUnavailableError):
            YouTubeExtractor()._select_best_streams("vid123", "Test_Video", formats, quality=1080)

    def test_regression_adaptive_video_only_pairs_audio(self):
        # adaptive video-only => audio pairing still works
        formats = [
            {"url": "https://media.test/v1080", "height": 1080, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio_m4a", "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a", "abr": 128},
        ]
        item = YouTubeExtractor()._select_best_streams("vid123", "Test_Video", formats, quality=1080)
        self.assertEqual(item.height, 1080)
        self.assertEqual(item.download_url, "https://media.test/v1080")
        self.assertEqual(item.audio_url, "https://media.test/audio_m4a")

    def test_vertical_video_qualities_normalized_to_short_edge(self):
        # Vertical video formats (Shorts/Reels 9:16) must normalize to short-edge scanlines
        vertical_formats = [
            {"url": "https://media.test/v360x640", "width": 360, "height": 640, "vcodec": "avc1", "acodec": "aac", "ext": "mp4"},
            {"url": "https://media.test/v480x854", "width": 480, "height": 854, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v720x1280", "width": 720, "height": 1280, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v1080x1920", "width": 1080, "height": 1920, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio", "width": None, "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a"},
        ]
        qualities = YouTubeExtractor.available_qualities(vertical_formats)
        self.assertEqual(qualities, [1080, 720, 480, 360])

    def test_select_quality_on_vertical_video_succeeds(self):
        # Requesting 1080 on a vertical 1080x1920 video must resolve without QUALITY_UNAVAILABLE
        vertical_formats = [
            {"url": "https://media.test/v720x1280", "width": 720, "height": 1280, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/v1080x1920", "width": 1080, "height": 1920, "vcodec": "avc1", "acodec": "none", "ext": "mp4"},
            {"url": "https://media.test/audio", "width": None, "height": None, "vcodec": "none", "acodec": "aac", "ext": "m4a"},
        ]
        item = YouTubeExtractor()._select_best_streams("short_123", "Vertical_Short", vertical_formats, quality=1080)
        self.assertEqual(item.width, 1080)
        self.assertEqual(item.height, 1920)
        self.assertEqual(item.download_url, "https://media.test/v1080x1920")
        self.assertEqual(item.audio_url, "https://media.test/audio")


class YouTubePreviewTests(unittest.IsolatedAsyncioTestCase):
    def mock_extraction(self):
        mock = patch("services.youtube.extractor._CancellableYoutubeDL")
        ydl = mock.start()
        self.addCleanup(mock.stop)
        ydl.return_value.__enter__.return_value.extract_info.return_value = {
            "id": "id", "title": "A video", "channel": "A channel",
            "thumbnail": "https://i.ytimg.com/vi/id/default.jpg", "formats": FORMATS,
            "http_headers": {"Cookie": "secret-cookie"},
        }
        return ydl

    async def test_worker_preview_exposes_only_normalized_metadata(self):
        self.mock_extraction()
        handler = DownloadWorkerHandler(SourceRouter([YouTubeResolver()]))
        send = AsyncMock()
        await handler.handle({"type": "task.assign", "taskId": "preview", "action": "resolve_download",
                              "payload": {"url": "https://youtube.com/watch?v=id", "operation": "preview"}}, send)
        result = send.await_args_list[-1].args[0]["result"]
        self.assertEqual(result, {"source": "youtube", "title": "A video", "uploader": "A channel",
                                  "thumbnail": "https://i.ytimg.com/vi/id/default.jpg", "qualities": [2160, 1080, 720]})
        self.assertNotIn("media.example", json.dumps(result))
        self.assertNotIn("secret-cookie", json.dumps(result))

    async def test_confirmation_resolves_selected_quality_through_router(self):
        self.mock_extraction()
        handler = DownloadWorkerHandler(SourceRouter([YouTubeResolver()]))
        send = AsyncMock()
        await handler.handle({"type": "task.assign", "taskId": "download", "action": "resolve_download",
                              "payload": {"url": "https://youtube.com/watch?v=id", "quality": 1080}}, send)
        result = send.await_args_list[-1].args[0]["result"]
        self.assertEqual(result["downloadUrl"], "https://media.example/v1080")
        self.assertEqual(result["audioUrl"], "https://media.example/audio")
        self.assertNotIn("qualities", result)

    async def test_quality_disappearing_after_preview_returns_domain_failure(self):
        ydl = self.mock_extraction()
        router = SourceRouter([YouTubeResolver()])
        self.assertIn(1080, (await router.preview("https://youtube.com/watch?v=id"))["qualities"])
        ydl.return_value.__enter__.return_value.extract_info.return_value["formats"] = [video(720, acodec="aac")]
        with self.assertRaises(QualityUnavailableError):
            await router.resolve("https://youtube.com/watch?v=id", quality=1080)

    async def test_preview_rejects_other_sources(self):
        for url in ["invalid", "https://instagram.com/p/test", "https://mediafire.com/file/test"]:
            with self.assertRaises(UnsupportedSourceError):
                await SourceRouter().preview(url)

    async def test_unexpected_exception_never_leaks_raw_details(self):
        resolver = AsyncMock()
        resolver.preview.side_effect = RuntimeError("Cookie=secret; https://private/?token=secret")
        send = AsyncMock()
        await DownloadWorkerHandler(resolver).handle({"type": "task.assign", "taskId": "preview", "action": "resolve_download",
                                                      "payload": {"url": "https://youtube.com/watch?v=id", "operation": "preview"}}, send)
        failure = send.await_args_list[-1].args[0]
        self.assertEqual(failure["error"]["code"], "RESOLVE_FAILED")
        self.assertNotIn("secret", json.dumps(failure))

    async def test_preview_cancellation_stops_thread_before_worker_ack(self):
        started, stopped = threading.Event(), threading.Event()
        def blocked(url, cancel_event, ydl_ref, finished, **kwargs):
            self.assertTrue(kwargs["preview"])
            started.set()
            try:
                cancel_event.wait(3)
            finally:
                stopped.set()
                finished.set()

        extractor = YouTubeExtractor()
        extractor._extract_sync = blocked
        handler = DownloadWorkerHandler(SourceRouter([YouTubeResolver(extractor)]))
        client = CoordinatorWorkerClient(handler=handler)
        client._websocket = object()
        acknowledgements = []
        async def send(message):
            if message["type"] == "task.failed":
                self.assertTrue(stopped.is_set())
            acknowledgements.append(message)
        client.send = send
        client._start_assignment({"type": "task.assign", "taskId": "preview", "action": "resolve_download",
                                  "payload": {"url": "https://youtube.com/watch?v=id", "operation": "preview"}})
        try:
            for _ in range(100):
                if started.is_set(): break
                await asyncio.sleep(.01)
            self.assertTrue(started.is_set())
            assignment = client._assignments_by_id["preview"]
            client._cancel_assignment("preview")
            client._cancel_assignment("preview")  # duplicate must not interrupt cleanup
            await asyncio.gather(assignment, return_exceptions=True)
            self.assertTrue(stopped.is_set())
            self.assertEqual(acknowledgements[-1]["error"]["code"], "CANCELLED")
        finally:
            await client._cancel_assignments()
