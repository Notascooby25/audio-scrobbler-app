from __future__ import annotations

import io
import logging
import urllib.request

from PIL import Image

logger = logging.getLogger(__name__)


def extract_dominant_color(image_bytes: bytes) -> str | None:
    """Extract a representative dominant hex color (#rrggbb) from image bytes.

    Uses adaptive quantization on a resized thumbnail. If vibrant/saturated colors
    exist in the top palette, selects the most prominent one; otherwise falls back
    to the most frequent color. Returns None if decoding fails.
    """
    if not image_bytes:
        return None

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Convert to RGB mode (handles RGBA, Palette, Grayscale)
            rgb_img = img.convert("RGB")
            # Downscale to 64x64 for fast analysis
            small_img = rgb_img.resize((64, 64), Image.Resampling.BILINEAR)

            # Quantize down to 8 dominant adaptive palette colors
            quantized = small_img.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
            palette = quantized.getpalette()
            if not palette:
                return None

            raw_counts = quantized.getcolors()
            if not raw_counts:
                return None

            # Sort by frequency descending: list of (count, palette_index)
            sorted_counts = sorted(raw_counts, key=lambda item: item[0], reverse=True)

            candidates: list[tuple[int, int, int, int]] = []
            for count, idx in sorted_counts:
                r = palette[idx * 3]
                g = palette[idx * 3 + 1]
                b = palette[idx * 3 + 2]
                candidates.append((count, r, g, b))

            if not candidates:
                return None

            # Check if there is a vibrant/saturated color among the top candidates
            # Saturated: difference between max and min channel >= 36, and not near-black/near-white
            vibrant_candidate = None
            for count, r, g, b in candidates:
                saturation = max(r, g, b) - min(r, g, b)
                brightness = (r + g + b) / 3
                if saturation >= 36 and 20 <= brightness <= 235:
                    vibrant_candidate = (r, g, b)
                    break

            if vibrant_candidate:
                r, g, b = vibrant_candidate
            else:
                # Fall back to the most frequent color
                _, r, g, b = candidates[0]

            return f"#{r:02x}{g:02x}{b:02x}"
    except Exception as exc:
        logger.debug("Failed to extract dominant color from image bytes: %s", exc)
        return None


def fetch_and_extract_color(image_url: str, timeout: float = 2.5) -> str | None:
    """Fetch image bytes from URL and extract dominant hex color with a strict timeout.

    Safely returns None on any network error, HTTP error, or timeout.
    """
    if not image_url or not image_url.startswith(("http://", "https://")):
        return None

    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "AudioScrobbler/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read()
            return extract_dominant_color(data)
    except Exception as exc:
        logger.debug("Failed to fetch or extract color for %s: %s", image_url, exc)
        return None
