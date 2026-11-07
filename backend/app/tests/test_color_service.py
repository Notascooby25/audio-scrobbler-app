from __future__ import annotations

import io
import urllib.error
from unittest.mock import MagicMock, patch

from PIL import Image

from backend.app.services.color_service import extract_dominant_color, fetch_and_extract_color


def _create_test_image(color: tuple[int, int, int], size: tuple[int, int] = (64, 64), format: str = "PNG") -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def test_extract_dominant_color_solid():
    red_bytes = _create_test_image((255, 0, 0))
    green_bytes = _create_test_image((0, 255, 0))
    blue_bytes = _create_test_image((0, 0, 255))

    assert extract_dominant_color(red_bytes) == "#ff0000"
    assert extract_dominant_color(green_bytes) == "#00ff00"
    assert extract_dominant_color(blue_bytes) == "#0000ff"


def test_extract_dominant_color_prefers_vibrant_over_neutral_border():
    # 64x64 image with large white border and vibrant purple center
    img = Image.new("RGB", (64, 64), (255, 255, 255))
    for x in range(16, 48):
        for y in range(16, 48):
            img.putpixel((x, y), (128, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = buf.getvalue()

    color = extract_dominant_color(data)
    assert color is not None
    # Saturated color should be picked instead of pure white
    assert color.lower() != "#ffffff"


def test_extract_dominant_color_grayscale():
    gray_bytes = _create_test_image((128, 128, 128))
    color = extract_dominant_color(gray_bytes)
    assert color == "#808080"


def test_extract_dominant_color_invalid_and_empty():
    assert extract_dominant_color(b"") is None
    assert extract_dominant_color(b"corrupted-non-image-data") is None


def test_fetch_and_extract_color_success():
    blue_bytes = _create_test_image((0, 50, 200))
    mock_resp = MagicMock()
    mock_resp.read.return_value = blue_bytes
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        color = fetch_and_extract_color("https://images.example.com/cover.jpg")
        assert color is not None
        assert color.startswith("#")


def test_fetch_and_extract_color_handles_network_failure():
    with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("Connection refused")):
        assert fetch_and_extract_color("https://images.example.com/nonexistent.jpg") is None


def test_fetch_and_extract_color_invalid_url():
    assert fetch_and_extract_color("") is None
    assert fetch_and_extract_color("ftp://invalid.com/file.jpg") is None
