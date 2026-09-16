import unittest
from unittest.mock import patch, MagicMock

from services.x.extractor import XExtractor, calculate_twitter_token
from services.x.resolver import XResolver
from services.x.errors import XNotFoundError, XUnsupportedUrlError


class TestXService(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.extractor = XExtractor()
        self.resolver = XResolver(extractor=self.extractor)

    def test_supports_urls(self):
        # Valid X/Twitter URLs
        self.assertTrue(self.resolver.supports("https://x.com/elonmusk/status/1585341984679469056"))
        self.assertTrue(self.resolver.supports("https://twitter.com/jack/status/20"))
        self.assertTrue(self.resolver.supports("https://mobile.twitter.com/user/status/123456789"))
        self.assertTrue(self.resolver.supports("https://mobile.x.com/user/status/123456789?s=20"))

        # Invalid URLs
        self.assertFalse(self.resolver.supports("https://x.com/home"))
        self.assertFalse(self.resolver.supports("https://x.com/explore"))
        self.assertFalse(self.resolver.supports("https://facebook.com/watch/?v=123"))
        self.assertFalse(self.resolver.supports("https://youtube.com/watch?v=123"))
        self.assertFalse(self.resolver.supports(""))
        self.assertFalse(self.resolver.supports(None))

    def test_extract_status_id(self):
        self.assertEqual(
            XExtractor.extract_status_id("https://x.com/elonmusk/status/1585341984679469056"),
            "1585341984679469056",
        )
        self.assertEqual(
            XExtractor.extract_status_id("https://twitter.com/jack/status/20?t=abc"),
            "20",
        )
        self.assertIsNone(XExtractor.extract_status_id("https://x.com/user"))

    def test_calculate_token(self):
        token = calculate_twitter_token("1585341984679469056")
        self.assertTrue(isinstance(token, str))
        self.assertTrue(len(token) > 0)
        self.assertTrue(token.startswith("3uchycv2wqc"))

    def test_normalize_post_with_video(self):
        mock_data = {
            "id_str": "12345",
            "text": "Hello X video post\nSecond line",
            "created_at": "2024-01-01T00:00:00.000Z",
            "favorite_count": 100,
            "conversation_count": 25,
            "user": {
                "name": "Elon Musk",
                "screen_name": "elonmusk",
                "profile_image_url_https": "https://pbs.twimg.com/profile_images/123_normal.jpg",
                "verified": True,
            },
            "mediaDetails": [
                {
                    "type": "video",
                    "media_url_https": "https://pbs.twimg.com/media/thumb.jpg",
                    "video_info": {
                        "variants": [
                            {"content_type": "video/mp4", "bitrate": 256000, "url": "https://video.twimg.com/low.mp4"},
                            {"content_type": "video/mp4", "bitrate": 2176000, "url": "https://video.twimg.com/high.mp4"},
                        ]
                    }
                }
            ]
        }

        normalized = self.extractor._normalize_post(mock_data, "12345", "https://x.com/elonmusk/status/12345")
        self.assertEqual(normalized["id"], "12345")
        self.assertEqual(normalized["source"], "x")
        self.assertEqual(normalized["media_type"], "video")
        self.assertEqual(normalized["author"]["name"], "Elon Musk")
        self.assertEqual(normalized["author"]["screen_name"], "elonmusk")
        self.assertEqual(normalized["metrics"]["likes"], 100)
        self.assertEqual(normalized["metrics"]["replies"], 25)

        self.assertEqual(len(normalized["items"]), 1)
        item = normalized["items"][0]
        self.assertEqual(item["type"], "video")
        self.assertEqual(item["download_url"], "https://video.twimg.com/high.mp4")
        self.assertTrue(item["filename"].startswith("[X]_"))
        self.assertTrue(item["filename"].endswith(".mp4"))

    def test_normalize_post_with_photos(self):
        mock_data = {
            "id_str": "67890",
            "text": "Photos gallery demo",
            "created_at": "2024-01-01T00:00:00.000Z",
            "user": {
                "name": "Photographer",
                "screen_name": "photo_guy",
            },
            "mediaDetails": [
                {"type": "photo", "media_url_https": "https://pbs.twimg.com/media/pic1.jpg"},
                {"type": "photo", "media_url_https": "https://pbs.twimg.com/media/pic2.jpg"},
            ]
        }

        normalized = self.extractor._normalize_post(mock_data, "67890", "https://x.com/photo_guy/status/67890")
        self.assertEqual(normalized["media_type"], "carousel")
        self.assertEqual(len(normalized["items"]), 2)
        self.assertEqual(normalized["items"][0]["type"], "photo")
        self.assertEqual(normalized["items"][0]["download_url"], "https://pbs.twimg.com/media/pic1.jpg?name=orig")
        self.assertTrue(normalized["items"][0]["filename"].startswith("[X]_"))
        self.assertTrue(normalized["items"][0]["filename"].endswith(".jpeg"))

    @patch("services.x.extractor.XExtractor.inspect")
    async def test_resolver_resolve_video(self, mock_inspect):
        mock_inspect.return_value = {
            "id": "111",
            "title": "demo_video",
            "items": [
                {
                    "index": 1,
                    "type": "video",
                    "download_url": "https://video.twimg.com/test.mp4",
                    "filename": "[X]_demo_video.mp4",
                }
            ]
        }

        resolved = await self.resolver.resolve("https://x.com/user/status/111")
        self.assertEqual(resolved.source, "x")
        self.assertEqual(resolved.download_url, "https://video.twimg.com/test.mp4")
        self.assertEqual(resolved.filename, "[X]_demo_video.mp4")
        self.assertEqual(resolved.extension, ".mp4")
        self.assertIn("User-Agent", resolved.headers)

    def test_cookie_helpers(self):
        from services.x.auth import (
            parse_cookies_to_dict,
            parse_cookies_to_header,
            dict_to_netscape_cookies,
        )

        raw = "auth_token=abc12345; ct0=xyz9876; guest_id=v1%3A123;"
        d = parse_cookies_to_dict(raw)
        self.assertEqual(d["auth_token"], "abc12345")
        self.assertEqual(d["ct0"], "xyz9876")
        self.assertEqual(d["guest_id"], "v1%3A123")

        hdr = parse_cookies_to_header(raw)
        self.assertIn("auth_token=abc12345", hdr)
        self.assertIn("ct0=xyz9876", hdr)

        netscape = dict_to_netscape_cookies(d)
        self.assertIn(".x.com\tTRUE\t/\tTRUE\t2147483647\tauth_token\tabc12345", netscape)
        self.assertIn(".twitter.com\tTRUE\t/\tTRUE\t2147483647\tauth_token\tabc12345", netscape)

    async def test_verify_cookies_missing_auth_token(self):
        from services.x.auth import verify_x_cookies
        valid, msg = await verify_x_cookies("ct0=12345")
        self.assertFalse(valid)
        self.assertIn("auth_token", msg)

    @patch("services.x.extractor.XExtractor.inspect")
    async def test_resolver_resolve_photos_and_text(self, mock_inspect):
        mock_inspect.return_value = {
            "id": "222",
            "title": "photo_demo",
            "text": "Beautiful sunset in Tokyo!",
            "author": {"name": "Photographer", "screen_name": "photo_tokyo"},
            "items": [
                {
                    "index": 1,
                    "type": "photo",
                    "download_url": "https://pbs.twimg.com/media/pic1.jpg?name=orig",
                    "filename": "[X]_photo_demo_01.jpeg",
                },
                {
                    "index": 2,
                    "type": "photo",
                    "download_url": "https://pbs.twimg.com/media/pic2.jpg?name=orig",
                    "filename": "[X]_photo_demo_02.jpeg",
                },
            ],
        }

        resolved = await self.resolver.resolve("https://x.com/photo_tokyo/status/222")
        self.assertEqual(resolved.source, "x")
        self.assertEqual(resolved.extension, ".jpeg")
        self.assertIsNotNone(resolved.items)
        # 2 photos + 1 companion text file
        self.assertEqual(len(resolved.items), 3)
        self.assertEqual(resolved.items[0]["filename"], "[X]_photo_demo_01.jpeg")
        self.assertEqual(resolved.items[1]["filename"], "[X]_photo_demo_02.jpeg")
        self.assertEqual(resolved.items[2]["filename"], "[X]_photo_demo_post.txt")
        self.assertTrue(resolved.items[2]["url"].startswith("data:text/plain"))

    @patch("services.x.extractor.XExtractor.inspect")
    async def test_resolver_resolve_text_only_post(self, mock_inspect):
        mock_inspect.return_value = {
            "id": "333",
            "title": "just_a_thought",
            "text": "Hello world from X!",
            "author": {"name": "Jack", "screen_name": "jack"},
            "items": [],
        }

        resolved = await self.resolver.resolve("https://x.com/jack/status/333")
        self.assertEqual(resolved.source, "x")
        self.assertEqual(resolved.extension, ".txt")
        self.assertEqual(resolved.filename, "[X]_just_a_thought.txt")
        self.assertTrue(resolved.download_url.startswith("data:text/plain"))
