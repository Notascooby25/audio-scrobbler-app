from __future__ import annotations

import json
import re
from typing import Any
import xml.etree.ElementTree as ET

import requests

YOUTUBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+478",
}


def extract_video_id(url_or_id: str) -> str:
    cleaned = url_or_id.strip()
    if re.match(r"^[a-zA-Z0-9_-]{11}$", cleaned):
        return cleaned

    patterns = [
        r"(?:v=|\/v\/|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})",
        r"(?:watch\?.*v=)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            return match.group(1)

    raise ValueError(f"Could not extract a valid YouTube video ID from: {url_or_id}")


def _parse_timestamp_to_seconds(ts_str: str) -> int:
    parts = [int(p) for p in ts_str.strip().split(":")]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0


def _clean_track_title(text: str) -> str:
    cleaned = text.strip()
    # Strip quotes
    cleaned = re.sub(r'^[“"\'`]+|[”"\'`]+$', "", cleaned).strip()
    # Strip leading list counters like 1., 1 -, 01.
    cleaned = re.sub(r"^\d+[\.\-\)]\s*", "", cleaned).strip()
    # Strip leading dashes or bullets
    cleaned = re.sub(r"^[-–—•\*\s]+", "", cleaned).strip()
    # Strip trailing quotes or punctuation
    cleaned = re.sub(r'^[“"\'`]+|[”"\'`]+$', "", cleaned).strip()
    return cleaned


def _extract_artist_from_video_title(title: str, author: str) -> str:
    # Common concert title patterns:
    # "Dua Lipa: Tiny Desk Concert" -> "Dua Lipa"
    # "Fontaines D.C. - Full Performance (Live on KEXP)" -> "Fontaines D.C."
    # "Bruno Mars - All I Ask in the Radio 1 Live Lounge" -> "Bruno Mars"
    if ":" in title:
        candidate = title.split(":")[0].strip()
        if len(candidate) > 1 and "live" not in candidate.lower():
            return candidate
    if " - " in title:
        candidate = title.split(" - ")[0].strip()
        if len(candidate) > 1 and "live" not in candidate.lower() and candidate.lower() != author.lower():
            return candidate
    return author


def parse_tracklist_from_description(
    description: str,
    default_artist: str = "",
    total_duration_seconds: int | None = None,
    video_title: str = "",
) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    lines = [line.strip() for line in description.splitlines() if line.strip()]

    # 1. Try finding timestamped lines e.g. 00:00 Song Title or Song Title 00:00
    timestamp_pattern_prefix = re.compile(
        r"^(?:\[|\()?(?P<time>\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?\s*[-–—:]?\s*(?P<title>.+)$"
    )
    timestamp_pattern_suffix = re.compile(
        r"^(?P<title>.+?)\s*[-–—:]?\s*(?:\[|\()?(?P<time>\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?$"
    )

    found_timestamps: list[tuple[int, str]] = []
    for line in lines:
        m_pre = timestamp_pattern_prefix.match(line)
        if m_pre:
            sec = _parse_timestamp_to_seconds(m_pre.group("time"))
            title = _clean_track_title(m_pre.group("title"))
            if title and not re.match(r"^(intro|start|applause|interview)$", title.lower()):
                found_timestamps.append((sec, title))
            continue

        m_suf = timestamp_pattern_suffix.match(line)
        if m_suf:
            sec = _parse_timestamp_to_seconds(m_suf.group("time"))
            title = _clean_track_title(m_suf.group("title"))
            if title and not re.match(r"^(intro|start|applause|interview)$", title.lower()):
                found_timestamps.append((sec, title))

    if len(found_timestamps) >= 2:
        for idx, (offset, raw_title) in enumerate(found_timestamps):
            artist = default_artist
            track_name = raw_title
            if " - " in raw_title:
                parts = raw_title.split(" - ", 1)
                artist = parts[0].strip()
                track_name = parts[1].strip()

            duration = None
            if idx + 1 < len(found_timestamps):
                next_offset = found_timestamps[idx + 1][0]
                if next_offset > offset:
                    duration = next_offset - offset
            elif total_duration_seconds and total_duration_seconds > offset:
                duration = total_duration_seconds - offset

            tracks.append({
                "segment_id": f"seg_{idx}",
                "artist": artist or "Unknown Artist",
                "title": _clean_track_title(track_name),
                "offset_seconds": offset,
                "duration_seconds": duration,
                "spotify_uri": None,
                "image_url": None,
            })
        return tracks

    # 2. Check for Setlist headers (SET LIST, Songs:, Tracks:, Tracklist:)
    setlist_headers = [
        re.compile(r"^set\s*list:?$", re.IGNORECASE),
        re.compile(r"^songs:?$", re.IGNORECASE),
        re.compile(r"^track\s*list(?:ing)?:?$", re.IGNORECASE),
        re.compile(r"^tracks:?$", re.IGNORECASE),
        re.compile(r"^music:?$", re.IGNORECASE),
    ]

    stop_headers = [
        "musicians", "credits", "tiny desk team", "host:", "recorded", "producer",
        "audio engineer", "cameras", "editor", "special thanks", "band:", "personnel",
    ]

    in_setlist_section = False
    setlist_lines: list[str] = []

    for line in lines:
        lower_line = line.lower()
        if any(h.match(line) for h in setlist_headers):
            in_setlist_section = True
            continue

        if in_setlist_section:
            if any(sh in lower_line for sh in stop_headers) or lower_line.startswith("http") or lower_line.startswith("#"):
                break
            clean_l = _clean_track_title(line)
            if clean_l and len(clean_l) < 100:
                setlist_lines.append(clean_l)

    if setlist_lines:
        avg_dur = (total_duration_seconds // len(setlist_lines)) if total_duration_seconds else 210
        for idx, s_line in enumerate(setlist_lines):
            artist = default_artist
            track_name = s_line
            if " - " in s_line:
                parts = s_line.split(" - ", 1)
                artist = parts[0].strip()
                track_name = parts[1].strip()

            tracks.append({
                "segment_id": f"seg_{idx}",
                "artist": artist or "Unknown Artist",
                "title": _clean_track_title(track_name),
                "offset_seconds": idx * avg_dur,
                "duration_seconds": avg_dur,
                "spotify_uri": None,
                "image_url": None,
            })
        return tracks

    # 3. Fallback: Single track parsed from video title
    if video_title:
        clean_vtitle = re.sub(
            r"\((?:live[^)]*|official[^)]*|video[^)]*|audio[^)]*|radio 1[^)]*|cover[^)]*)\)",
            "",
            video_title,
            flags=re.IGNORECASE,
        )
        clean_vtitle = re.sub(
            r"\[(?:live[^\]]*|official[^\]]*|video[^\]]*|audio[^\]]*)\]",
            "",
            clean_vtitle,
            flags=re.IGNORECASE,
        )
        clean_vtitle = re.sub(r"in the Radio 1 Live Lounge.*$", "", clean_vtitle, flags=re.IGNORECASE)
        clean_vtitle = re.sub(r"Live on KEXP.*$", "", clean_vtitle, flags=re.IGNORECASE)
        clean_vtitle = re.sub(r"Tiny Desk.*$", "", clean_vtitle, flags=re.IGNORECASE)
        clean_vtitle = re.sub(r"@\w+", "", clean_vtitle).strip()

        artist = default_artist
        song = clean_vtitle.strip(" -:")
        if " - " in clean_vtitle:
            parts = clean_vtitle.split(" - ", 1)
            artist = parts[0].strip()
            song = parts[1].strip()

        tracks.append({
            "segment_id": "seg_0",
            "artist": artist or "Unknown Artist",
            "title": _clean_track_title(song),
            "offset_seconds": 0,
            "duration_seconds": total_duration_seconds or 210,
            "spotify_uri": None,
            "image_url": None,
        })

    return tracks


def resolve_channel_info(url_or_handle: str) -> dict[str, str | None]:
    cleaned = url_or_handle.strip()
    if cleaned.startswith("http"):
        target_url = cleaned
    elif cleaned.startswith("@"):
        target_url = f"https://www.youtube.com/{cleaned}"
    elif cleaned.startswith("UC") and len(cleaned) == 24:
        target_url = f"https://www.youtube.com/channel/{cleaned}"
    else:
        target_url = f"https://www.youtube.com/@{cleaned}"

    resp = requests.get(target_url, headers=YOUTUBE_HEADERS, timeout=12)
    resp.raise_for_status()

    # Extract channelId
    channel_id = None
    m_cid = re.search(r'itemprop="channelId"\s+content="([^"]+)"', resp.text)
    if m_cid:
        channel_id = m_cid.group(1)
    else:
        m_feed = re.search(r'channel_id=([a-zA-Z0-9_-]+)', resp.text)
        if m_feed:
            channel_id = m_feed.group(1)

    if not channel_id and "/channel/UC" in resp.url:
        m_url = re.search(r"/channel/(UC[a-zA-Z0-9_-]{22})", resp.url)
        if m_url:
            channel_id = m_url.group(1)

    # Extract title
    title = None
    m_title = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', resp.text)
    if m_title:
        title = m_title.group(1)
    elif "<title>" in resp.text:
        m_html_title = re.search(r"<title>(.*?)(?: - YouTube)?</title>", resp.text)
        if m_html_title:
            title = m_html_title.group(1).strip()

    # Extract image / avatar
    image_url = None
    m_img = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', resp.text)
    if m_img:
        image_url = m_img.group(1)

    channel_handle = None
    if "@" in resp.url:
        m_h = re.search(r"(@[a-zA-Z0-9_.-]+)", resp.url)
        if m_h:
            channel_handle = m_h.group(1)
    elif cleaned.startswith("@"):
        channel_handle = cleaned

    return {
        "channel_id": channel_id or cleaned,
        "channel_handle": channel_handle,
        "title": title or cleaned,
        "image_url": image_url,
    }


def get_channel_recent_videos(channel_id: str) -> list[dict[str, Any]]:
    feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    resp = requests.get(feed_url, headers=YOUTUBE_HEADERS, timeout=10)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
    }

    videos: list[dict[str, Any]] = []
    for entry in root.findall("atom:entry", ns):
        vid_elem = entry.find("yt:videoId", ns)
        title_elem = entry.find("atom:title", ns)
        pub_elem = entry.find("atom:published", ns)

        if vid_elem is not None and vid_elem.text:
            v_id = vid_elem.text.strip()
            v_title = title_elem.text.strip() if title_elem is not None and title_elem.text else f"Video {v_id}"
            v_pub = pub_elem.text.strip() if pub_elem is not None and pub_elem.text else ""
            videos.append({
                "video_id": v_id,
                "title": v_title,
                "published_at": v_pub,
                "thumbnail_url": f"https://i.ytimg.com/vi/{v_id}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={v_id}",
            })

    return videos


def search_youtube_videos(query: str, channel_title: str | None = None) -> list[dict[str, Any]]:
    full_query = f"{channel_title} {query}".strip() if channel_title else query.strip()
    url = f"https://www.youtube.com/results?search_query={requests.utils.quote(full_query)}"
    resp = requests.get(url, headers=YOUTUBE_HEADERS, timeout=12)
    resp.raise_for_status()

    m = re.search(r"var ytInitialData\s*=\s*({.+?});</script>", resp.text)
    if not m:
        return []

    try:
        data = json.loads(m.group(1))
        contents = (
            data.get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [])
        )
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    for section in contents:
        items = section.get("itemSectionRenderer", {}).get("contents", [])
        for item in items:
            vr = item.get("videoRenderer")
            if not vr:
                continue

            vid = vr.get("videoId")
            if not vid:
                continue

            title_runs = vr.get("title", {}).get("runs", [])
            title = "".join(t.get("text", "") for t in title_runs) or "YouTube Video"

            owner_runs = vr.get("ownerText", {}).get("runs", [])
            owner = "".join(t.get("text", "") for t in owner_runs) or ""

            length = vr.get("lengthText", {}).get("simpleText", "")

            results.append({
                "video_id": vid,
                "title": title,
                "channel_title": owner,
                "duration": length,
                "thumbnail_url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={vid}",
            })
            if len(results) >= 20:
                break
        if len(results) >= 20:
            break

    return results


def fetch_youtube_video_details(video_url_or_id: str) -> dict[str, Any]:
    video_id = extract_video_id(video_url_or_id)
    watch_url = f"https://www.youtube.com/watch?v={video_id}"

    resp = requests.get(watch_url, headers=YOUTUBE_HEADERS, timeout=12)
    resp.raise_for_status()

    m_player = re.search(r"var ytInitialPlayerResponse\s*=\s*({.+?});(?:var|\x3c/script)", resp.text)
    if not m_player:
        raise ValueError(f"Could not load YouTube player response for video {video_id}")

    pdata = json.loads(m_player.group(1))
    vd = pdata.get("videoDetails", {})
    if not vd:
        raise ValueError(f"No video details found for video {video_id}")

    title = vd.get("title", f"YouTube Video: {video_id}")
    author = vd.get("author", "YouTube Channel")
    length_sec = int(vd.get("lengthSeconds", 0)) if vd.get("lengthSeconds") else None
    description = vd.get("shortDescription", "")
    thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    artist = _extract_artist_from_video_title(title, author)
    tracks = parse_tracklist_from_description(
        description=description,
        default_artist=artist,
        total_duration_seconds=length_sec,
        video_title=title,
    )

    return {
        "video_id": video_id,
        "title": title,
        "author": author,
        "artist": artist,
        "duration_seconds": length_sec,
        "thumbnail_url": thumbnail_url,
        "url": watch_url,
        "tracks": tracks,
    }
