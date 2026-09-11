import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from services.tiktok.auth import classify_tiktok_error, verify_tiktok_cookies
from services.tiktok.extractor import TikTokExtractor, sanitize_raw_info
from worker.client import CoordinatorWorkerClient
from worker.protocol import COOKIE_VERIFY


class TestTikTokIntegration(unittest.IsolatedAsyncioTestCase):
    def test_classify_tiktok_error(self):
        err = classify_tiktok_error("Video unavailable. This video is private.")
        self.assertEqual(err.code, "SOURCE_ACCESS_DENIED")

        err = classify_tiktok_error("Login required to view this age-restricted video.")
        self.assertEqual(err.code, "SOURCE_AUTH_REQUIRED")

        err = classify_tiktok_error("Not found or deleted by author")
        self.assertEqual(err.code, "SOURCE_NOT_FOUND")

        err = classify_tiktok_error("Random network error")
        self.assertEqual(err.code, "RESOLVE_FAILED")

    def test_sanitize_raw_info(self):
        raw = {
            "title": "Cute Cat Video",
            "sessionid": "secret123",
            "token": "tokenabc",
            "http_headers": {
                "User-Agent": "Mozilla/5.0",
                "Cookie": "secret_cookie_val",
                "Authorization": "Bearer 123",
            },
            "formats": [
                {"format_id": "1", "url": "https://tiktok.com/stream.mp4"}
            ]
        }
        sanitized = sanitize_raw_info(raw)
        self.assertEqual(sanitized["title"], "Cute Cat Video")
        self.assertEqual(sanitized["sessionid"], "[REDACTED]")
        self.assertEqual(sanitized["token"], "[REDACTED]")
        self.assertEqual(sanitized["http_headers"]["Cookie"], "[REDACTED]")
        self.assertEqual(sanitized["http_headers"]["Authorization"], "[REDACTED]")
        self.assertEqual(sanitized["http_headers"]["User-Agent"], "Mozilla/5.0")
        self.assertEqual(sanitized["formats"][0]["url"], "https://tiktok.com/stream.mp4")

    async def test_verify_tiktok_cookies(self):
        # Empty
        valid, msg = await verify_tiktok_cookies("")
        self.assertFalse(valid)
        self.assertIn("trống", msg)

        # Missing tiktok.com
        other_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\tval\n"
        )
        valid, msg = await verify_tiktok_cookies(other_netscape)
        self.assertFalse(valid)
        self.assertIn("Không tìm thấy cookies cho tiktok.com", msg)

        # Missing sessionid / sessionid_ss
        no_session_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".tiktok.com\tTRUE\t/\tTRUE\t2147483647\ttt_chain_token\tval\n"
        )
        valid, msg = await verify_tiktok_cookies(no_session_netscape)
        self.assertFalse(valid)
        self.assertIn("Thiếu token phiên đăng nhập", msg)

        # Mocked success from TikTok passport API
        with patch("services.tiktok.auth._test_tiktok_cookies_sync") as mock_test:
            mock_test.return_value = (True, "Xác thực cookies TikTok thành công (tài khoản: testuser).")
            tiktok_netscape = (
                "# Netscape HTTP Cookie File\n"
                ".tiktok.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\tabc123xyz\n"
            )
            valid, msg = await verify_tiktok_cookies(tiktok_netscape)
            self.assertTrue(valid)
            self.assertIn("thành công", msg)

    def test_tiktok_cookies_sync_direct(self):
        from services.tiktok.auth import _test_tiktok_cookies_sync, create_cookiejar_from_netscape
        import io

        tiktok_netscape = (
            "# Netscape HTTP Cookie File\n"
            ".tiktok.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\tabc123xyz\n"
        )
        jar = create_cookiejar_from_netscape(tiktok_netscape)

        # 1. Success case
        mock_resp_data = json.dumps({
            "message": "success",
            "data": {"user_id": "123456", "username": "valid_user"}
        }).encode("utf-8")

        mock_resp = io.BytesIO(mock_resp_data)
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = lambda s, *args: None

        with patch("urllib.request.urlopen", return_value=mock_resp):
            valid, msg = _test_tiktok_cookies_sync(jar)
            self.assertTrue(valid)
            self.assertIn("valid_user", msg)

        # 2. Expired session case
        mock_fail_data = json.dumps({
            "message": "error",
            "data": {"description": "Session expired"}
        }).encode("utf-8")

        mock_fail = io.BytesIO(mock_fail_data)
        mock_fail.__enter__ = lambda s: s
        mock_fail.__exit__ = lambda s, *args: None

        with patch("urllib.request.urlopen", return_value=mock_fail):
            valid, msg = _test_tiktok_cookies_sync(jar)
            self.assertFalse(valid)
            self.assertIn("hết hạn", msg)

    async def test_worker_client_tiktok_cookie_verify(self):
        client = CoordinatorWorkerClient()
        client.send = AsyncMock()

        envelope = {
            "type": "cookie.verify",
            "taskId": "task-tt-1",
            "payload": {
                "platform": "tiktok",
                "cookies": (
                    "# Netscape HTTP Cookie File\n"
                    ".tiktok.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\ttestval\n"
                ),
            },
        }
        with patch("services.tiktok.auth.verify_tiktok_cookies", new=AsyncMock(return_value=(True, "Xác thực cookies TikTok thành công."))):
            await client._handle_cookie_verify(envelope)
        client.send.assert_awaited_once()
        call_args = client.send.call_args[0][0]
        self.assertEqual(call_args["type"], COOKIE_VERIFY)
        self.assertEqual(call_args["taskId"], "task-tt-1")
        self.assertTrue(call_args["result"]["valid"])

    @patch("services.tiktok.scraper.TikTokWebScraper.scrape", new_callable=AsyncMock)
    async def test_extractor_slideshow_processing(self, mock_scrape):
        extractor = TikTokExtractor()
        # Mock slideshow data returned by TikTokWebScraper
        mock_scrape.return_value = {
            "source": "tiktok",
            "type": "slideshow",
            "id": "123456",
            "title": "Photo Slideshow Post",
            "uploader": "testuser",
            "duration": None,
            "thumbnail": "https://p16.tiktokcdn.com/img1.jpg",
            "images": [
                "https://p16.tiktokcdn.com/img1.jpg",
                "https://p16.tiktokcdn.com/img2.jpg",
                "https://p16.tiktokcdn.com/img3.jpg",
            ],
            "slideshow_images": [
                "https://p16.tiktokcdn.com/img1.jpg",
                "https://p16.tiktokcdn.com/img2.jpg",
                "https://p16.tiktokcdn.com/img3.jpg",
            ],
            "qualities": [],
            "raw_info": {"id": "123456", "title": "Photo Slideshow Post"},
        }

        res = await extractor.inspect("https://www.tiktok.com/@testuser/photo/123456")
        self.assertEqual(res["type"], "slideshow")
        self.assertEqual(len(res["images"]), 3)
        self.assertEqual(res["uploader"], "testuser")

    def test_process_info_slideshow_format(self):
        extractor = TikTokExtractor()
        slideshow_payload = {
            "id": "123456",
            "title": "Photo Slideshow Post",
            "uploader": "testuser",
            "entries": [
                {"url": "https://p16.tiktokcdn.com/img1.jpg"},
                {"url": "https://p16.tiktokcdn.com/img2.jpg"},
            ],
            "formats": [
                {"format_id": "photo-0", "ext": "jpg", "url": "https://p16.tiktokcdn.com/img1.jpg"},
                {"format_id": "photo-1", "ext": "jpg", "url": "https://p16.tiktokcdn.com/img2.jpg"},
            ],
        }
        res = extractor._process_info(slideshow_payload)
        self.assertEqual(res["type"], "slideshow")
        self.assertEqual(len(res["slideshow_images"]), 2)
    def test_process_info_mixed_post(self):
        extractor = TikTokExtractor()
        mixed_payload = {
            "id": "mixed-123",
            "title": "Mixed Video and Photo Post",
            "uploader": "testuser",
            "formats": [
                {"format_id": "h264_540p", "vcodec": "h264", "width": 576, "height": 1024, "url": "https://v16.tiktokcdn.com/video.mp4"},
                {"format_id": "photo-0", "ext": "jpg", "url": "https://p16.tiktokcdn.com/slide1.jpg"},
            ],
            "thumbnails": [
                {"id": "cover", "url": "https://p16.tiktokcdn.com/cover.jpg"},
            ],
            "entries": [
                {"url": "https://p16.tiktokcdn.com/slide1.jpg"},
                {"url": "https://p16.tiktokcdn.com/slide2.jpg"},
            ],
        }
        res = extractor._process_info(mixed_payload)
        self.assertEqual(res["type"], "mixed")
        self.assertIsNotNone(res["video_url"])
        self.assertEqual(len(res["slideshow_images"]), 2)
        self.assertEqual(len(res["covers"]), 1)
        self.assertEqual(len(res["all_images"]), 3)

    def test_process_info_video_does_not_leak_covers_as_images(self):
        extractor = TikTokExtractor()
        # Video payload matching user's exact structure
        video_payload = {
            "id": "7683865133659082004",
            "title": "Bay-Bay-Bay",
            "uploader": "spicygirlswibu",
            "duration": 12,
            "ext": "mp4",
            "thumbnail": "https://p16-common-sign.tiktokcdn.com/originCover.jpg",
            "thumbnails": [
                {"id": "dynamicCover", "url": "https://p16-common-sign.tiktokcdn.com/dynamicCover.jpg"},
                {"id": "cover", "url": "https://p16-common-sign.tiktokcdn.com/cover.jpg"},
                {"id": "originCover", "url": "https://p16-common-sign.tiktokcdn.com/originCover.jpg"},
            ],
            "formats": [
                {"format_id": "audio", "vcodec": "none", "acodec": "mp3", "url": "https://v16m.tiktokcdn.com/audio.mp3"},
                {"format_id": "h264_540p", "vcodec": "h264", "width": 576, "height": 1024, "url": "https://v16.tiktokcdn.com/540p.mp4", "tbr": 2010},
                {"format_id": "bytevc1_720p", "vcodec": "h265", "width": 720, "height": 1280, "url": "https://v16.tiktokcdn.com/720p.mp4", "tbr": 953},
            ],
            "url": "https://v19-webapp-prime.tiktok.com/video.mp4",
        }
        res = extractor._process_info(video_payload)
        self.assertEqual(res["type"], "video")
        # Ensure 3 covers are captured and categorized as covers
        self.assertEqual(len(res["covers"]), 3)
        self.assertEqual(res["covers"][0]["id"], "dynamicCover")
        self.assertEqual(res["covers"][1]["id"], "cover")
        self.assertEqual(res["covers"][2]["id"], "originCover")
        self.assertEqual(len(res["all_images"]), 3)
        self.assertEqual(res["all_images"][0]["type"], "cover")
        self.assertIsNotNone(res["video_url"])
        self.assertEqual(res["qualities"], [720, 576])

    def test_tiktok_web_scraper_format_item(self):
        from services.tiktok.scraper import TikTokWebScraper
        scraper = TikTokWebScraper()
        item = {
            "id": "7636585528929881352",
            "desc": "Cosplay Photo Slideshow",
            "author": {"nickname": "TestCreator", "uniqueId": "testcreator"},
            "imagePost": {
                "images": [
                    {"imageURL": {"urlList": ["https://tiktokcdn.com/photo1.jpg"]}},
                    {"imageURL": {"urlList": ["https://tiktokcdn.com/photo2.jpg"]}},
                ],
                "cover": {"imageURL": {"urlList": ["https://tiktokcdn.com/cover.jpg"]}},
            },
            "music": {"playUrl": "https://tiktokcdn.com/music.mp3"},
        }
        res = scraper._format_item(item, "")
        self.assertEqual(res["type"], "slideshow")
        self.assertEqual(len(res["slideshow_images"]), 2)
        self.assertEqual(res["slideshow_images"][0], "https://tiktokcdn.com/photo1.jpg")
        self.assertEqual(res["audio_url"], "https://tiktokcdn.com/music.mp3")
        self.assertEqual(res["uploader"], "TestCreator")

    def test_tiktok_web_scraper_mixed_post(self):
        from services.tiktok.scraper import TikTokWebScraper
        scraper = TikTokWebScraper()
        item = {
            "id": "7636585528929881399",
            "desc": "Mixed Post with Video and Photos",
            "author": {"nickname": "MultiCreator", "uniqueId": "multicreator"},
            "video": {
                "playAddr": "https://tiktokcdn.com/video.mp4",
                "width": 720,
                "height": 1280,
                "duration": 15,
                "originCover": "https://tiktokcdn.com/originCover.jpg",
            },
            "imagePost": {
                "images": [
                    {"imageURL": {"urlList": ["https://tiktokcdn.com/photo1.jpg"]}},
                    {"imageURL": {"urlList": ["https://tiktokcdn.com/photo2.jpg"]}},
                ],
            },
            "music": {"playUrl": "https://tiktokcdn.com/music.mp3"},
        }
        res = scraper._format_item(item, "")
        self.assertEqual(res["type"], "mixed")
        self.assertEqual(res["video_url"], "https://tiktokcdn.com/video.mp4")
        self.assertEqual(len(res["slideshow_images"]), 2)
        self.assertEqual(len(res["covers"]), 1)
        self.assertEqual(len(res["all_images"]), 3)

    def test_tiktok_cookies_file_read_and_save(self):
        import tempfile
        import os
        from services.tiktok.auth import save_tiktok_cookies_to_file, read_tiktok_cookies_from_file

        with tempfile.TemporaryDirectory() as tmpdir:
            orig_env = os.environ.get("APPVIEW_STATE_DIR")
            os.environ["APPVIEW_STATE_DIR"] = tmpdir
            try:
                self.assertIsNone(read_tiktok_cookies_from_file())
                cookie_content = "# Netscape HTTP Cookie File\n.tiktok.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\ttest_cookie_val\n"
                save_tiktok_cookies_to_file(cookie_content)
                self.assertEqual(read_tiktok_cookies_from_file(), cookie_content.strip())
            finally:
                if orig_env is not None:
                    os.environ["APPVIEW_STATE_DIR"] = orig_env
                else:
                    os.environ.pop("APPVIEW_STATE_DIR", None)

    async def test_tiktok_resolver_supports_and_preview(self):
        from services.tiktok.resolver import TikTokResolver
        resolver = TikTokResolver()
        self.assertTrue(resolver.supports("https://www.tiktok.com/@user/video/123456"))
        self.assertTrue(resolver.supports("https://vt.tiktok.com/ABCDEF/"))
        self.assertTrue(resolver.supports("https://m.tiktok.com/v/123456.html"))
        self.assertFalse(resolver.supports("https://youtube.com/watch?v=123"))

        with patch.object(resolver._extractor, "inspect", new_callable=AsyncMock) as mock_inspect:
            mock_inspect.return_value = {
                "source": "tiktok",
                "type": "slideshow",
                "title": "Photo Post",
                "thumbnail": "https://cdn/thumb.jpg",
                "uploader": "creator",
                "qualities": [],
                "all_images": [{"id": "1", "url": "https://cdn/1.jpg"}],
                "video_url": None,
                "audio_url": "https://cdn/audio.mp3",
            }
            preview = await resolver.preview("https://www.tiktok.com/@user/photo/123456")
            self.assertEqual(preview["source"], "tiktok")
            self.assertEqual(preview["type"], "slideshow")
            self.assertEqual(preview["title"], "Photo Post")
            self.assertTrue(preview["has_audio"])
            self.assertFalse(preview["has_video"])

    async def test_tiktok_resolver_resolve_slideshow_with_selection(self):
        from services.tiktok.resolver import TikTokResolver
        resolver = TikTokResolver()

        with patch.object(resolver._extractor, "inspect", new_callable=AsyncMock) as mock_inspect:
            mock_inspect.return_value = {
                "source": "tiktok",
                "type": "slideshow",
                "title": "Cosplay Photos",
                "slideshow_images": [
                    "https://cdn/img1.jpg",
                    "https://cdn/img2.jpg",
                    "https://cdn/img3.jpg",
                ],
                "audio_url": "https://cdn/audio.mp3",
                "video_url": None,
            }
            # Test selecting images 0 and 2
            resolved = await resolver.resolve("https://www.tiktok.com/@user/photo/123456", selected_indices=[0, 2])
            self.assertEqual(resolved.source, "tiktok")
            self.assertEqual(len(resolved.items), 2)  # exactly 2 selected images, NO audio
            self.assertEqual(resolved.items[0]["url"], "https://cdn/img1.jpg")
            self.assertEqual(resolved.items[1]["url"], "https://cdn/img3.jpg")
            self.assertEqual(resolved.items[0]["type"], "image")
            self.assertEqual(resolved.items[1]["type"], "image")
            self.assertIsNone(resolved.audio_url)

    async def test_source_router_tiktok_delegation(self):
        from services.source_router import source_router
        self.assertTrue(source_router.supports("https://www.tiktok.com/@user/video/7683865133659082004"))
        self.assertTrue(source_router.supports("https://www.tiktok.com/@user/photo/7636585528929881352"))


if __name__ == "__main__":
    unittest.main()


