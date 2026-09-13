"""Tests for universal video resolution normalization."""

import unittest

from services.resolution import (
    compute_video_resolution,
    extract_format_quality,
    format_matches_quality,
)


class TestResolutionNormalization(unittest.TestCase):
    def test_standard_horizontal_resolutions(self):
        cases = [
            (1920, 1080, 1080),
            (1280, 720, 720),
            (3840, 2160, 2160),
            (2560, 1440, 1440),
            (854, 480, 480),
            (640, 360, 360),
            (426, 240, 240),
            (256, 144, 144),
            (7680, 4320, 4320),
        ]
        for w, h, expected in cases:
            with self.subTest(w=w, h=h):
                self.assertEqual(compute_video_resolution(w, h), expected)

    def test_standard_vertical_resolutions(self):
        cases = [
            (1080, 1920, 1080),
            (720, 1280, 720),
            (2160, 3840, 2160),
            (1440, 2560, 1440),
            (480, 854, 480),
            (360, 640, 360),
            (240, 426, 240),
            (144, 256, 144),
        ]
        for w, h, expected in cases:
            with self.subTest(w=w, h=h):
                self.assertEqual(compute_video_resolution(w, h), expected)

    def test_square_aspect_ratio(self):
        cases = [
            (1080, 1080, 1080),
            (720, 720, 720),
            (480, 480, 480),
            (360, 360, 360),
        ]
        for w, h, expected in cases:
            with self.subTest(w=w, h=h):
                self.assertEqual(compute_video_resolution(w, h), expected)

    def test_ultrawide_horizontal_resolutions(self):
        cases = [
            (1920, 800, 1080),   # 1080p 2.40:1 Cinemascope
            (1920, 816, 1080),   # 1080p 2.35:1 Cinemascope
            (2560, 1080, 1080),  # 21:9 WFHD (1080 scanlines)
            (3440, 1440, 1440),  # 21:9 WQHD (1440 scanlines)
            (3840, 1600, 2160),  # 4K cropped letterbox
        ]
        for w, h, expected in cases:
            with self.subTest(w=w, h=h):
                self.assertEqual(compute_video_resolution(w, h), expected)

    def test_macroblock_and_aspect_deviation(self):
        cases = [
            (1072, 1920, 1080),  # encoder padding on vertical
            (718, 1280, 720),    # slight crop on vertical
            (852, 480, 480),     # standard 480p width variation
            (1080, 1916, 1080),  # non-mod16 height
        ]
        for w, h, expected in cases:
            with self.subTest(w=w, h=h):
                self.assertEqual(compute_video_resolution(w, h), expected)

    def test_missing_or_partial_dimensions(self):
        self.assertEqual(compute_video_resolution(None, 1080), 1080)
        self.assertEqual(compute_video_resolution(1920, None), 1080)
        self.assertEqual(compute_video_resolution(1080, None), 1080)
        self.assertIsNone(compute_video_resolution(None, None))
        self.assertIsNone(compute_video_resolution(0, 0))
        self.assertEqual(compute_video_resolution(-1080, 720), 720)

    def test_extract_and_match_format_quality(self):
        fmt_horiz = {"width": 1920, "height": 1080}
        fmt_vert = {"width": 1080, "height": 1920}
        fmt_audio = {"vcodec": "none"}

        self.assertEqual(extract_format_quality(fmt_horiz), 1080)
        self.assertEqual(extract_format_quality(fmt_vert), 1080)
        self.assertIsNone(extract_format_quality(fmt_audio))
        self.assertIsNone(extract_format_quality(None))

        self.assertTrue(format_matches_quality(fmt_horiz, 1080))
        self.assertTrue(format_matches_quality(fmt_vert, 1080))
        self.assertFalse(format_matches_quality(fmt_horiz, 720))
        self.assertFalse(format_matches_quality(fmt_vert, 1920))


class TestMediaFilenameContracts(unittest.TestCase):
    def test_photo_filename_formatting(self):
        from archive.contracts import format_photo_download_filename

        self.assertEqual(
            format_photo_download_filename("Facebook", "Ảnh demo", "123", 1),
            "[Facebook]_Ảnh demo_01.jpeg",
        )
        self.assertEqual(
            format_photo_download_filename("TikTok", "Cosplay Post", "456", 2),
            "[TikTok]_Cosplay Post_02.jpeg",
        )
        self.assertEqual(
            format_photo_download_filename("Instagram", "Sunset", "789", 1),
            "[Instagram]_Sunset_01.jpeg",
        )
        # Strips redundant platform prefixes
        self.assertEqual(
            format_photo_download_filename("facebook", "facebook_post_123", "123", 1),
            "[Facebook]_post_123_01.jpeg",
        )

    def test_video_filename_formatting(self):
        from archive.contracts import format_video_download_filename

        # Single video across all platforms
        self.assertEqual(
            format_video_download_filename("YouTube", "Bài giảng Python", "vid1"),
            "[YouTube]_Bài giảng Python.mp4",
        )
        self.assertEqual(
            format_video_download_filename("Facebook", "Video hài hước", "vid2"),
            "[Facebook]_Video hài hước.mp4",
        )
        self.assertEqual(
            format_video_download_filename("TikTok", "Dance Challenge", "vid3"),
            "[TikTok]_Dance Challenge.mp4",
        )
        self.assertEqual(
            format_video_download_filename("Instagram", "Reel demo", "vid4"),
            "[Instagram]_Reel demo.mp4",
        )

        # Multi-video carousel (with index)
        self.assertEqual(
            format_video_download_filename("Instagram", "Reel demo", "vid4", index=1),
            "[Instagram]_Reel demo_01.mp4",
        )
        self.assertEqual(
            format_video_download_filename("Instagram", "Reel demo", "vid4", index=2),
            "[Instagram]_Reel demo_02.mp4",
        )

        # Archive bundle
        self.assertEqual(
            format_video_download_filename("Instagram", "Reel demo", "vid4", ext=".zip"),
            "[Instagram]_Reel demo.zip",
        )

        # Redundant prefix stripping and empty fallback
        self.assertEqual(
            format_video_download_filename("youtube", "youtube_999", "999"),
            "[YouTube]_999.mp4",
        )
        self.assertEqual(
            format_video_download_filename("youtube", "", "999"),
            "[YouTube]_video_999.mp4",
        )


if __name__ == "__main__":
    unittest.main()
