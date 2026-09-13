"""Unit tests for Facebook extraction, authentication, and resolution."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from services.facebook.auth import (
    parse_cookies_to_dict,
    parse_cookies_to_header,
    verify_facebook_cookies,
)
from services.facebook.errors import (
    FacebookAuthRequiredError,
    FacebookNotFoundError,
    classify_facebook_error,
)
from services.facebook.extractor import FacebookExtractor, clean_facebook_url, format_timestamp
from services.facebook.resolver import FacebookResolver
from services.source_router import SourceRouter


SAMPLE_FACEBOOK_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Nguyễn Văn A - Hôm nay thời tiết thật đẹp! | Facebook</title>
    <meta property="og:title" content="Nguyễn Văn A - Hôm nay thời tiết thật đẹp!">
    <meta property="og:description" content="Hôm nay thời tiết thật đẹp!\nĐi chụp ảnh cùng mọi người thôi.">
    <meta property="og:image" content="https://scontent.fhan1-1.fna.fbcdn.net/v/t39.30808-6/456789_cover.jpg?stp=dst-jpg_s960x960">
    <meta property="og:video" content="https://video.fhan1-1.fna.fbcdn.net/v/t42.1790-2/123456_sd.mp4">
</head>
<body>
    <script type="application/json" data-sjs>
    {"require":[["ScheduledServerJS","handleServerJS",null,[{"story":{"creation_time":1726052400,"actors":[{"__typename":"User","id":"100012345678901","name":"Nguyễn Văn A","profile_picture":{"uri":"https://scontent.fhan1-1.fna.fbcdn.net/avatar.jpg"}}],"message":{"text":"Hôm nay thời tiết thật đẹp!\nĐi chụp ảnh cùng mọi người thôi."},"feedback":{"reaction_count":{"count":1250},"comment_count":{"total_count":340},"share_count":{"count":89}},"attachments":[{"media":{"__typename":"Photo","id":"1001","image":{"uri":"https://scontent.fhan1-1.fna.fbcdn.net/photo1.jpg","width":1080,"height":1350}}},{"media":{"__typename":"Photo","id":"1002","image":{"uri":"https://scontent.fhan1-1.fna.fbcdn.net/photo2.jpg","width":1080,"height":1080}}},{"media":{"__typename":"Video","browser_native_hd_url":"https://video.fhan1-1.fna.fbcdn.net/video_hd.mp4","browser_native_sd_url":"https://video.fhan1-1.fna.fbcdn.net/video_sd.mp4"}}]}}]]}
    </script>
</body>
</html>
"""


class TestFacebookService(unittest.IsolatedAsyncioTestCase):
    def test_clean_facebook_url(self):
        dirty = "https://www.facebook.com/user/posts/123456789?fbclid=IwAR123&__cft__=xyz&ref=share"
        cleaned = clean_facebook_url(dirty)
        self.assertEqual(cleaned, "https://www.facebook.com/user/posts/123456789")

    def test_format_timestamp(self):
        ts = 1726052400
        formatted = format_timestamp(ts)
        self.assertTrue(len(formatted) > 5)
        self.assertEqual(format_timestamp(None), "Không rõ thời gian")

    def test_parse_cookies_to_dict_and_header(self):
        netscape_text = (
            "# Netscape HTTP Cookie File\n"
            ".facebook.com\tTRUE\t/\tTRUE\t2147483647\tc_user\t1000123456\n"
            ".facebook.com\tTRUE\t/\tTRUE\t2147483647\txs\tabcdef123456\n"
            ".facebook.com\tTRUE\t/\tTRUE\t2147483647\tdatr\txyz789\n"
        )
        d = parse_cookies_to_dict(netscape_text)
        self.assertEqual(d["c_user"], "1000123456")
        self.assertEqual(d["xs"], "abcdef123456")
        self.assertEqual(d["datr"], "xyz789")

        header = parse_cookies_to_header(netscape_text)
        self.assertIn("c_user=1000123456", header)
        self.assertIn("xs=abcdef123456", header)

    async def test_verify_facebook_cookies_missing(self):
        valid, msg = await verify_facebook_cookies("")
        self.assertFalse(valid)
        self.assertIn("trống", msg)

        valid, msg = await verify_facebook_cookies("datr=xyz;")
        self.assertFalse(valid)
        self.assertIn("Thiếu thuộc tính", msg)

    async def test_verify_facebook_cookies_mock(self):
        with patch("services.facebook.auth._test_facebook_cookies_sync", return_value=(True, "Xác thực cookies Facebook thành công (User ID: 1000123456).")):
            valid, msg = await verify_facebook_cookies("c_user=1000123456; xs=abcdef123456;")
            self.assertTrue(valid)
            self.assertIn("1000123456", msg)

    def test_extractor_parse_html(self):
        extractor = FacebookExtractor()
        data = extractor._parse_html(
            "https://www.facebook.com/nguyenvana/posts/123456789",
            SAMPLE_FACEBOOK_HTML,
            "https://www.facebook.com/nguyenvana/posts/123456789",
        )

        self.assertEqual(data["source"], "facebook")
        self.assertEqual(data["id"], "123456789")
        self.assertEqual(data["type"], "mixed")

        # Author
        self.assertEqual(data["author"]["name"], "Nguyễn Văn A")
        self.assertEqual(data["author"]["id"], "100012345678901")
        self.assertIn("avatar.jpg", data["author"]["avatar"])

        # Content / Status
        self.assertIn("Hôm nay thời tiết thật đẹp!", data["content"])
        self.assertIn("Đi chụp ảnh cùng mọi người thôi.", data["content"])

        # Reactions
        self.assertEqual(data["reactions"]["likes"], 1250)
        self.assertEqual(data["reactions"]["comments"], 340)
        self.assertEqual(data["reactions"]["shares"], 89)

        # Photos
        self.assertEqual(len(data["photos"]), 2)
        self.assertIn("photo1.jpg", data["photos"][0]["url"])
        self.assertEqual(data["photos"][0]["width"], 1080)
        self.assertEqual(data["photos"][0]["height"], 1350)

        # Videos
        self.assertEqual(len(data["videos"]), 2)
        self.assertIn("video_hd.mp4", data["videos"][0]["url"])
        self.assertIn(1080, data["qualities"])

    def test_resolver_supports(self):
        resolver = FacebookResolver()
        self.assertTrue(resolver.supports("https://www.facebook.com/user/posts/123"))
        self.assertTrue(resolver.supports("https://m.facebook.com/story.php?story_fbid=123"))
        self.assertTrue(resolver.supports("https://fb.watch/xyz123"))
        self.assertTrue(resolver.supports("https://web.facebook.com/photo/?fbid=456"))
        self.assertFalse(resolver.supports("https://www.tiktok.com/@user/video/123"))
        self.assertFalse(resolver.supports("https://youtube.com/watch?v=123"))

    async def test_resolver_preview_and_resolve(self):
        extractor = MagicMock()
        mock_data = {
            "source": "facebook",
            "id": "123",
            "title": "Facebook Post 123",
            "type": "slideshow",
            "content": "Hello status",
            "photos": [
                {"id": "p1", "url": "https://fbcdn.net/p1.jpg"},
                {"id": "p2", "url": "https://fbcdn.net/p2.jpg"},
            ],
            "videos": [],
            "images": ["https://fbcdn.net/p1.jpg", "https://fbcdn.net/p2.jpg"],
        }
        extractor.inspect = AsyncMock(return_value=mock_data)
        resolver = FacebookResolver(extractor=extractor)

        preview = await resolver.preview("https://www.facebook.com/post/123")
        self.assertEqual(preview["id"], "123")

        # Resolve images (all -> zip)
        resolved_zip = await resolver.resolve("https://www.facebook.com/post/123")
        self.assertEqual(resolved_zip.extension, ".zip")
        self.assertEqual(len(resolved_zip.items), 2)

        # Resolve single image -> jpeg
        resolved_single = await resolver.resolve("https://www.facebook.com/post/123", selected_indices=[0])
        self.assertEqual(resolved_single.extension, ".jpeg")
        self.assertEqual(len(resolved_single.items), 1)

    def test_extractor_parse_reel_html(self):
        extractor = FacebookExtractor()
        reel_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Facebook Reel - Cosplay Channel</title>
            <meta property="og:title" content="Facebook Reel - Cosplay Channel">
        </head>
        <body>
            <script>
            {
                "dash_manifest_urls": [
                    {
                        "manifest_url": "https://www.facebook.com/dash_mpd_debug.mpd?v=999888777&dummy=.mpd",
                        "progressive_urls": [
                            {
                                "progressive_url": "https://fbcdn.net/video_sd.mp4?tag=sve_sd\\u003C/BaseURL>\\u003CSegmentBase",
                                "metadata": {"quality": "SD"}
                            },
                            {
                                "progressive_url": "https://fbcdn.net/video_hd.mp4?tag=dash_h264-basic-gen2_720p\\u003C/BaseURL>",
                                "metadata": {"quality": "HD"}
                            }
                        ]
                    },
                    {
                        "manifest_url": "https://www.facebook.com/dash_mpd_debug.mpd?v=111222333&dummy=.mpd",
                        "progressive_urls": [
                            {
                                "progressive_url": "https://fbcdn.net/feed_trailer.mp4",
                                "metadata": {"quality": "HD"}
                            }
                        ]
                    }
                ],
                "preferred_thumbnail": {
                    "image": {
                        "uri": "https://fbcdn.net/v/t15.5256-10/poster.jpg"
                    }
                },
                "actors": [{"name": "Cosplay Channel", "id": "1000999"}]
            }
            </script>
        </body>
        </html>
        """
        data = extractor._parse_html(
            "https://www.facebook.com/share/r/shortCode/",
            reel_html,
            "https://www.facebook.com/reel/999888777/?rdid=123",
        )

        self.assertEqual(data["source"], "facebook")
        self.assertEqual(data["id"], "999888777")
        self.assertEqual(data["type"], "video")
        self.assertEqual(data["author"]["name"], "Cosplay Channel")
        self.assertEqual(data["photos"], [])
        self.assertEqual(data["images"], [])
        self.assertEqual(len(data["videos"]), 2)

        # Video streams must be sanitized of closing tags
        for v in data["videos"]:
            self.assertNotIn("BaseURL", v["url"])
            self.assertNotIn("SegmentBase", v["url"])

        # Must not contain feed trailer video (111222333)
        urls = [v["url"] for v in data["videos"]]
        self.assertFalse(any("feed_trailer" in u for u in urls))

    def test_source_router_supports_facebook(self):
        router = SourceRouter()
        self.assertTrue(router.supports("https://www.facebook.com/user/posts/123"))
        self.assertTrue(router.supports("https://fb.watch/short123"))

    def test_resolver_resolve_video(self):
        resolver = FacebookResolver()
        mock_info = {
            "id": "12345",
            "title": "Facebook Video Test",
            "videos": [
                {"id": "v1", "quality": 720, "url": "https://fbcdn.net/hd.mp4"},
                {"id": "v2", "quality": 480, "url": "https://fbcdn.net/sd.mp4"},
            ],
            "has_video": True,
        }
        res = resolver.resolve_video("https://www.facebook.com/watch/?v=12345", mock_info, quality=720)
        self.assertEqual(res.source, "facebook")
        self.assertEqual(res.extension, ".mp4")
        self.assertEqual(res.filename, "[Facebook]_Facebook Video Test.mp4")
        self.assertEqual(res.download_url, "https://fbcdn.net/hd.mp4")

    def test_resolver_resolve_single_photo(self):
        resolver = FacebookResolver()
        mock_info = {
            "id": "67890",
            "title": "Single Photo Post",
            "photos": [
                {"id": "p1", "url": "https://fbcdn.net/single.jpg", "width": 1080, "height": 1350},
            ],
            "has_photos": True,
        }
        res = resolver.resolve_images("https://www.facebook.com/photo/?fbid=67890", mock_info)
        self.assertEqual(res.source, "facebook")
        self.assertEqual(res.extension, ".jpeg")
        self.assertEqual(res.filename, "[Facebook]_Single Photo Post_01.jpeg")
        self.assertEqual(len(res.items), 1)
        self.assertEqual(res.items[0]["url"], "https://fbcdn.net/single.jpg")
        self.assertEqual(res.items[0]["filename"], "[Facebook]_Single Photo Post_01.jpeg")

    def test_resolver_resolve_album_photos(self):
        resolver = FacebookResolver()
        mock_info = {
            "id": "album123",
            "title": "Album Post",
            "photos": [
                {"id": "p1", "url": "https://fbcdn.net/img1.jpg"},
                {"id": "p2", "url": "https://fbcdn.net/img2.jpg"},
                {"id": "p3", "url": "https://fbcdn.net/img3.jpg"},
            ],
        }
        res = resolver.resolve_images("https://www.facebook.com/album/123", mock_info, selected_indices=[0, 2])
        self.assertEqual(res.source, "facebook")
        self.assertEqual(res.extension, ".zip")
        self.assertEqual(res.filename, "[Facebook]_Album Post.zip")
        self.assertEqual(len(res.items), 2)
        self.assertEqual(res.items[0]["url"], "https://fbcdn.net/img1.jpg")
        self.assertEqual(res.items[0]["filename"], "[Facebook]_Album Post_01.jpeg")
        self.assertEqual(res.items[1]["url"], "https://fbcdn.net/img3.jpg")
        self.assertEqual(res.items[1]["filename"], "[Facebook]_Album Post_02.jpeg")


if __name__ == "__main__":
    unittest.main()
