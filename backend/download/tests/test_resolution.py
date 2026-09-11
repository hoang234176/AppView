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


if __name__ == "__main__":
    unittest.main()
