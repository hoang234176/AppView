"""Universal video resolution normalization for social media platforms."""

from __future__ import annotations

from typing import Any, Optional

# Standard video resolution scanline tiers (descending)
STANDARD_RESOLUTIONS = (4320, 2160, 1440, 1080, 720, 480, 360, 240, 144)

# Mapping from standard 16:9 long edges to resolution tiers for ultrawide (21:9 / 2.39:1)
# videos where letterboxing has been cropped out.
LONG_EDGE_MAP = {
    7680: 4320,
    3840: 2160,
    2560: 1440,
    1920: 1080,
    1280: 720,
    854: 480,
    640: 360,
    426: 240,
    256: 144,
}


def compute_video_resolution(
    width: Optional[int],
    height: Optional[int],
) -> Optional[int]:
    """
    Normalize video dimensions (horizontal, vertical, square, ultrawide) to a
    standard scanline resolution tag (e.g. 1080, 720).

    Algorithm:
    1. If both dimensions are missing or non-positive: return None.
    2. If only one dimension is available: use it directly.
    3. Identify short_edge = min(width, height) and long_edge = max(width, height).
    4. Match short_edge against STANDARD_RESOLUTIONS within tolerance (max(16px, 5%))
       to handle encoder macroblock padding (e.g. 1072x1920 -> 1080, 718x1280 -> 720).
    5. Check long_edge for ultrawide letterboxed videos (e.g. 1920x800 -> 1080).
    6. Fallback to short_edge rounded to the nearest even integer.
    """
    if not width and not height:
        return None

    w = int(width) if isinstance(width, (int, float)) and width > 0 else 0
    h = int(height) if isinstance(height, (int, float)) and height > 0 else 0

    if w <= 0 and h <= 0:
        return None
    if w <= 0:
        short_edge, long_edge = h, h
    elif h <= 0:
        for target_long, res in LONG_EDGE_MAP.items():
            tolerance = max(24, int(target_long * 0.03))
            if abs(w - target_long) <= tolerance:
                return res
        short_edge, long_edge = w, w
    else:
        short_edge, long_edge = min(w, h), max(w, h)

    # 1. Match short_edge to standard resolution tiers within tolerance
    for res in STANDARD_RESOLUTIONS:
        tolerance = max(16, int(res * 0.05))
        if abs(short_edge - res) <= tolerance:
            return res

    # 2. Check long_edge for unpadded ultrawide (21:9 / 2.39:1) master formats
    for target_long, res in LONG_EDGE_MAP.items():
        tolerance = max(24, int(target_long * 0.03))
        if abs(long_edge - target_long) <= tolerance and short_edge < res:
            return res

    # 3. Fallback to even short edge
    return (short_edge // 2) * 2


def extract_format_quality(format_dict: dict[str, Any]) -> Optional[int]:
    """Extract and normalize the resolution tag from a format dictionary."""
    if not isinstance(format_dict, dict):
        return None
    return compute_video_resolution(
        width=format_dict.get("width"),
        height=format_dict.get("height"),
    )


def format_matches_quality(format_dict: dict[str, Any], target_quality: int) -> bool:
    """Check if a format satisfies the requested normalized quality."""
    return extract_format_quality(format_dict) == target_quality
