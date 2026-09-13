"""Unit tests for Instagram extraction, resolver, and cookie management."""

import json
from unittest.mock import MagicMock, patch
import pytest

from services.instagram.auth import (
    load_instagram_cookies,
    parse_cookies_to_dict,
    parse_cookies_to_header,
)
from services.instagram.errors import (
    InstagramAuthRequiredError,
    InstagramError,
    InstagramNotFoundError,
    InstagramUnsupportedPostError,
)
from services.instagram.extractor import (
    InstagramExtractor,
    parse_instagram_url,
    shortcode_to_media_id,
)
from services.instagram.resolver import InstagramResolver


def test_shortcode_to_media_id():
    # Known test case
    assert shortcode_to_media_id("C-5w4tFvFv-") == 3438994793411927038
    assert shortcode_to_media_id("B") == 1
    assert shortcode_to_media_id("") == 0


def test_parse_instagram_url():
    kind, sc = parse_instagram_url("https://www.instagram.com/p/C-5w4tFvFv-/?igsh=123")
    assert kind == "post"
    assert sc == "C-5w4tFvFv-"

    kind, sc = parse_instagram_url("https://www.instagram.com/reel/Chunk8-jurw/")
    assert kind == "video"
    assert sc == "Chunk8-jurw"

    kind, sc = parse_instagram_url("https://instagr.am/p/ABC123xyz/")
    assert kind == "post"
    assert sc == "ABC123xyz"

    with pytest.raises(InstagramUnsupportedPostError):
        parse_instagram_url("https://www.instagram.com/explore/")


def test_cookie_parsing():
    netscape = """# Netscape HTTP Cookie File
.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t12345%3Aabc%3A1
.instagram.com\tTRUE\t/\tTRUE\t2147483647\tds_user_id\t987654
"""
    cookie_dict = parse_cookies_to_dict(netscape)
    assert cookie_dict.get("sessionid") == "12345%3Aabc%3A1"
    assert cookie_dict.get("ds_user_id") == "987654"

    header = parse_cookies_to_header(netscape)
    assert "sessionid=12345%3Aabc%3A1" in header
    assert "ds_user_id=987654" in header


def test_resolver_supports():
    resolver = InstagramResolver()
    assert resolver.supports("https://www.instagram.com/p/C-5w4tFvFv-/") is True
    assert resolver.supports("https://instagram.com/reel/Chunk8-jurw/") is True
    assert resolver.supports("https://instagr.am/p/ABC123xyz/") is True
    assert resolver.supports("https://www.facebook.com/reel/123456") is False
    assert resolver.supports("https://www.tiktok.com/@user/video/123") is False


def test_normalize_photo_only():
    extractor = InstagramExtractor()
    gql_payload = {
        "type": "graphql",
        "data": {
            "__typename": "GraphImage",
            "display_url": "https://cdninstagram.com/photo1.jpg",
            "dimensions": {"width": 1080, "height": 1080},
            "edge_media_to_caption": {"edges": [{"node": {"text": "A beautiful photo"}}]},
            "owner": {"username": "photographer", "full_name": "Photo Pro"},
            "taken_at_timestamp": 1700000000,
        }
    }
    steps = []
    res = extractor._normalize_post(gql_payload, "C-5w4tFvFv-", "https://instagram.com/p/C-5w4tFvFv-/", steps)
    assert res["type"] == "photo"
    assert res["has_video"] is False
    assert len(res["photos"]) == 1
    assert len(res["videos"]) == 0
    assert len(res["items"]) == 1
    assert res["items"][0]["type"] == "photo"
    assert res["uploader"] == "photographer"


def test_normalize_video_only():
    extractor = InstagramExtractor()
    gql_payload = {
        "type": "graphql",
        "data": {
            "__typename": "GraphVideo",
            "is_video": True,
            "video_url": "https://cdninstagram.com/video1.mp4",
            "display_url": "https://cdninstagram.com/thumb1.jpg",
            "video_duration": 15.5,
            "dimensions": {"width": 1080, "height": 1920},
            "edge_media_to_caption": {"edges": [{"node": {"text": "A cool reel"}}]},
            "owner": {"username": "videocreator"},
            "taken_at_timestamp": 1700000000,
        }
    }
    steps = []
    res = extractor._normalize_post(gql_payload, "Chunk8-jurw", "https://instagram.com/reel/Chunk8-jurw/", steps)
    assert res["type"] == "video"
    assert res["has_video"] is True
    assert res["has_photos"] is False
    assert len(res["videos"]) == 1
    assert len(res["photos"]) == 0
    assert len(res["images"]) == 0  # Crucial: video thumbnail must NOT be included in images
    assert len(res["items"]) == 1
    assert res["items"][0]["type"] == "video"
    assert res["items"][0]["duration"] == 15.5




def test_ytdlp_audio_format_preferred():
    """Verify that yt-dlp format selection picks progressive format with audio instead of silent DASH stream."""
    extractor = InstagramExtractor()
    ytdlp_payload = {
        "type": "ytdlp",
        "data": {
            "vcodec": "h264",
            "formats": [
                # DASH format with higher tbr but NO audio (acodec == "none")
                {
                    "format_id": "dash-1080",
                    "vcodec": "avc1",
                    "acodec": "none",
                    "tbr": 4000,
                    "width": 1080,
                    "height": 1920,
                    "url": "https://cdninstagram.com/dash_no_audio.mp4",
                },
                # Progressive format with audio (acodec != "none")
                {
                    "format_id": "progressive-720",
                    "vcodec": "avc1",
                    "acodec": "mp4a.40.2",
                    "tbr": 2000,
                    "width": 720,
                    "height": 1280,
                    "url": "https://cdninstagram.com/progressive_with_sound.mp4",
                },
            ],
            "uploader": "testuser",
        }
    }
    steps = []
    res = extractor._normalize_post(ytdlp_payload, "TestYtDlp", "https://instagram.com/reel/TestYtDlp/", steps)
    assert res["has_video"] is True
    assert res["has_photos"] is False
    assert len(res["images"]) == 0
    assert res["videos"][0]["url"] == "https://cdninstagram.com/progressive_with_sound.mp4"


def test_normalize_mixed_media():
    """Test mixed post containing BOTH photos and videos in the same carousel."""
    extractor = InstagramExtractor()
    gql_payload = {
        "type": "graphql",
        "data": {
            "__typename": "GraphSidecar",
            "edge_sidecar_to_children": {
                "edges": [
                    {
                        "node": {
                            "__typename": "GraphImage",
                            "is_video": False,
                            "display_url": "https://cdninstagram.com/pic1.jpg",
                            "dimensions": {"width": 1080, "height": 1080},
                        }
                    },
                    {
                        "node": {
                            "__typename": "GraphVideo",
                            "is_video": True,
                            "video_url": "https://cdninstagram.com/clip1.mp4",
                            "display_url": "https://cdninstagram.com/thumb_clip1.jpg",
                            "video_duration": 10.0,
                            "dimensions": {"width": 1080, "height": 1350},
                        }
                    },
                    {
                        "node": {
                            "__typename": "GraphImage",
                            "is_video": False,
                            "display_url": "https://cdninstagram.com/pic2.jpg",
                            "dimensions": {"width": 1080, "height": 1080},
                        }
                    },
                ]
            },
            "edge_media_to_caption": {"edges": [{"node": {"text": "Mixed carousel post"}}]},
            "owner": {"username": "traveler"},
            "taken_at_timestamp": 1700000000,
        }
    }
    steps = []
    res = extractor._normalize_post(gql_payload, "Mixed123", "https://instagram.com/p/Mixed123/", steps)
    assert res["type"] == "mixed"
    assert res["has_video"] is True
    assert len(res["photos"]) == 2
    assert len(res["videos"]) == 1
    assert len(res["items"]) == 3
    assert res["items"][0]["type"] == "photo"
    assert res["items"][1]["type"] == "video"
    assert res["items"][2]["type"] == "photo"


@pytest.mark.anyio
async def test_guest_first_flow_403_triggers_cookie_load():
    """Verify that a 403 on Step 1 (Anonymous) triggers Step 2 (Cookie injection)."""
    extractor = InstagramExtractor()

    call_count = 0

    def mock_fetch(shortcode, cookie_header=""):
        nonlocal call_count
        call_count += 1
        if not cookie_header:
            raise InstagramAuthRequiredError("HTTP 403 Forbidden")
        # Step 2 with cookie succeeds
        return {
            "type": "graphql",
            "data": {
                "__typename": "GraphImage",
                "display_url": "https://cdninstagram.com/photo1.jpg",
                "owner": {"username": "private_user"},
            }
        }

    with patch.object(extractor, "_fetch_via_direct_apis", side_effect=mock_fetch):
        with patch("services.instagram.extractor.load_instagram_cookies", return_value="sessionid=abc123"):
            result = await extractor.inspect("https://www.instagram.com/p/TestShortcode/")
            assert call_count == 2
            assert result["uploader"] == "private_user"
            steps = result["execution_steps"]
            assert len(steps) == 2
            assert steps[0]["step"] == 1
            assert steps[0]["status"] == "failed"
            assert steps[1]["step"] == 2
            assert steps[1]["status"] == "success"


@pytest.mark.anyio
async def test_guest_first_flow_403_without_cookie_file_raises():
    """Verify that if Step 1 gets 403 and no cookie exists in storage, InstagramAuthRequiredError is raised."""
    extractor = InstagramExtractor()

    def mock_fetch(shortcode, cookie_header=""):
        raise InstagramAuthRequiredError("HTTP 403 Forbidden")

    with patch.object(extractor, "_fetch_via_direct_apis", side_effect=mock_fetch):
        with patch("services.instagram.extractor.load_instagram_cookies", return_value=None):
            with pytest.raises(InstagramAuthRequiredError) as exc_info:
                await extractor.inspect("https://www.instagram.com/p/TestShortcode/")
            assert "403" in str(exc_info.value) or "cookie" in str(exc_info.value)


def test_avatar_extraction_multiple_sources():
    extractor = InstagramExtractor()
    # GraphQL avatar
    gql_payload = {
        "type": "graphql",
        "data": {
            "__typename": "GraphImage",
            "display_url": "https://cdninstagram.com/photo1.jpg",
            "owner": {"username": "test_user", "profile_pic_url_hd": "https://cdninstagram.com/avatar_hd.jpg"},
        }
    }
    res = extractor._normalize_post(gql_payload, "sc1", "https://instagram.com/p/sc1/", [])
    assert res["author"]["avatar"] == "https://cdninstagram.com/avatar_hd.jpg"

    # yt-dlp avatar
    ytdlp_payload = {
        "type": "ytdlp",
        "data": {
            "uploader": "test_uploader",
            "uploader_thumbnail": "https://cdninstagram.com/ytdlp_avatar.jpg",
            "url": "https://cdninstagram.com/photo.jpg",
        }
    }
    res2 = extractor._normalize_post(ytdlp_payload, "sc2", "https://instagram.com/p/sc2/", [])
    assert res2["author"]["avatar"] == "https://cdninstagram.com/ytdlp_avatar.jpg"


def test_update_instagram_session_cookies_from_headers():
    from services.instagram.auth import update_instagram_session_cookies_from_headers

    with patch("services.instagram.auth.save_instagram_cookies_via_storage") as mock_save:
        headers = [
            "mid=new_mid_value_123; Domain=.instagram.com; Path=/",
            "rur=\"PRN\\054999\"; Domain=.instagram.com; Path=/",
            "sessionid=\"\"; Domain=instagram.com; Path=/",  # Should not overwrite with empty
        ]
        updated = update_instagram_session_cookies_from_headers(headers)
        assert updated is True
        assert mock_save.called
        saved_content = mock_save.call_args[0][0]
        assert "new_mid_value_123" in saved_content
        assert "PRN" in saved_content


@pytest.mark.anyio
async def test_verify_instagram_cookies_calls_instagram():
    from services.instagram.auth import verify_instagram_cookies

    # Mock real response returning status fail
    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps({"status": "fail", "message": "checkpoint_required"}).encode()
    mock_resp.headers.get_all.return_value = []

    with patch("urllib.request.build_opener") as mock_opener_cls:
        mock_opener = MagicMock()
        mock_opener.open.return_value.__enter__.return_value = mock_resp
        mock_opener_cls.return_value = mock_opener

        valid, msg = await verify_instagram_cookies("sessionid=1234567890123")
        assert valid is False
        assert "checkpoint_required" in msg or "thất bại" in msg


def test_highest_bitrate_and_resolution_selection():
    extractor = InstagramExtractor()

    # GraphQL candidate selection
    gql_payload = {
        "type": "graphql",
        "data": {
            "__typename": "GraphVideo",
            "video_url": "https://cdninstagram.com/low_v.mp4",
            "display_url": "https://cdninstagram.com/low_img.jpg",
            "dimensions": {"width": 640, "height": 640},
            "video_resources": [
                {"src": "https://cdninstagram.com/low_v.mp4", "config_width": 640, "config_height": 640},
                {"src": "https://cdninstagram.com/high_v.mp4", "config_width": 1080, "config_height": 1080},
            ],
            "display_resources": [
                {"src": "https://cdninstagram.com/low_img.jpg", "config_width": 640, "config_height": 640},
                {"src": "https://cdninstagram.com/high_img.jpg", "config_width": 1080, "config_height": 1080},
            ],
            "owner": {"username": "test_user"},
        }
    }
    res = extractor._normalize_post(gql_payload, "vid1", "https://instagram.com/reel/vid1/", [])
    assert res["videos"][0]["url"] == "https://cdninstagram.com/high_v.mp4"
    assert res["videos"][0]["width"] == 1080

    # REST candidate selection
    rest_payload = {
        "type": "rest",
        "data": {
            "media_type": 2,
            "video_versions": [
                {"url": "https://cdninstagram.com/rest_low.mp4", "width": 480, "height": 480, "bandwidth": 500000},
                {"url": "https://cdninstagram.com/rest_high.mp4", "width": 1080, "height": 1920, "bandwidth": 2500000},
            ],
            "image_versions2": {
                "candidates": [
                    {"url": "https://cdninstagram.com/thumb_low.jpg", "width": 320, "height": 320},
                    {"url": "https://cdninstagram.com/thumb_high.jpg", "width": 1080, "height": 1080},
                ]
            },
            "user": {"username": "rest_user"},
        }
    }
    res2 = extractor._normalize_post(rest_payload, "vid2", "https://instagram.com/p/vid2/", [])
    assert res2["videos"][0]["url"] == "https://cdninstagram.com/rest_high.mp4"
    assert res2["videos"][0]["width"] == 1080
    assert res2["videos"][0]["bitrate"] == 2500000


@pytest.mark.anyio
async def test_resolver_single_video_and_multiple_photos_and_mixed():
    resolver = InstagramResolver()

    # 1. Single video
    video_info = {
        "id": "reel123",
        "title": "My Reel",
        "type": "video",
        "videos": [{"url": "https://cdn.com/reel.mp4", "width": 1080}],
        "photos": [],
        "has_video": True,
    }
    resolved = resolver.resolve_video("https://instagram.com/reel/reel123/", video_info)
    assert resolved.extension == ".mp4"
    assert resolved.filename == "[Instagram]_My Reel.mp4"
    assert resolved.download_url == "https://cdn.com/reel.mp4"
    assert resolved.items is None
    assert resolved.source == "instagram"

    # 2. Multiple photos
    photos_info = {
        "id": "post123",
        "title": "My Album",
        "type": "photo",
        "photos": [
            {"url": "https://cdn.com/p1.jpg"},
            {"url": "https://cdn.com/p2.jpg"},
        ],
        "videos": [],
        "has_video": False,
    }
    resolved_photos = resolver.resolve_images("https://instagram.com/p/post123/", photos_info)
    assert resolved_photos.extension == ".zip"
    assert len(resolved_photos.items) == 2
    assert resolved_photos.items[0]["filename"] == "[Instagram]_My Album_01.jpeg"
    assert resolved_photos.items[1]["filename"] == "[Instagram]_My Album_02.jpeg"

    # 3. Mixed media post
    mixed_info = {
        "id": "mix123",
        "title": "Mixed Carousel",
        "type": "mixed",
        "items": [
            {"url": "https://cdn.com/p1.jpg", "type": "photo"},
            {"url": "https://cdn.com/v1.mp4", "type": "video"},
        ],
        "photos": [{"url": "https://cdn.com/p1.jpg"}],
        "videos": [{"url": "https://cdn.com/v1.mp4"}],
        "has_video": True,
    }
    resolved_mixed = resolver.resolve_mixed("https://instagram.com/p/mix123/", mixed_info)
    assert resolved_mixed.extension == ".zip"
    assert resolved_mixed.filename == "[Instagram]_Mixed Carousel.zip"
    assert len(resolved_mixed.items) == 2
    assert resolved_mixed.items[0]["type"] == "image"
    assert resolved_mixed.items[0]["filename"] == "[Instagram]_Mixed Carousel_01.jpeg"
    assert resolved_mixed.items[1]["type"] == "video"
    assert resolved_mixed.items[1]["filename"] == "[Instagram]_Mixed Carousel_02.mp4"
