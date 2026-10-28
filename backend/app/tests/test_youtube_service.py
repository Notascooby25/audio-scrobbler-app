from __future__ import annotations

from unittest.mock import MagicMock, patch

from backend.app.services.youtube_service import (
    extract_video_id,
    get_channel_recent_videos,
    parse_tracklist_from_description,
    resolve_channel_info,
)


def test_extract_video_id_various_formats():
    assert extract_video_id("https://www.youtube.com/watch?v=F4neLJQC1_E") == "F4neLJQC1_E"
    assert extract_video_id("https://youtu.be/F4neLJQC1_E") == "F4neLJQC1_E"
    assert extract_video_id("https://www.youtube.com/embed/F4neLJQC1_E") == "F4neLJQC1_E"
    assert extract_video_id("https://www.youtube.com/shorts/F4neLJQC1_E") == "F4neLJQC1_E"
    assert extract_video_id("F4neLJQC1_E") == "F4neLJQC1_E"
    assert extract_video_id("https://www.youtube.com/watch?v=F4neLJQC1_E&t=120s") == "F4neLJQC1_E"


def test_parse_tracklist_timestamped_lines():
    desc = """
    Live concert set:
    00:00 Training Season
    03:15 These Walls
    06:30 Happy For You
    09:45 Houdini
    """
    tracks = parse_tracklist_from_description(desc, default_artist="Dua Lipa", total_duration_seconds=700)
    assert len(tracks) == 4
    assert tracks[0]["title"] == "Training Season"
    assert tracks[0]["artist"] == "Dua Lipa"
    assert tracks[0]["offset_seconds"] == 0
    assert tracks[0]["duration_seconds"] == 195  # 3:15 - 0:00

    assert tracks[1]["title"] == "These Walls"
    assert tracks[1]["offset_seconds"] == 195
    assert tracks[1]["duration_seconds"] == 195  # 6:30 - 3:15

    assert tracks[3]["title"] == "Houdini"
    assert tracks[3]["offset_seconds"] == 585
    assert tracks[3]["duration_seconds"] == 115  # 700 - 585


def test_parse_tracklist_setlist_header_quotes():
    desc = """
    When Dua Lipa came to visit the Tiny Desk, she had nothing to prove.

    SET LIST
    “Training Season”
    “These Walls”
    “Happy for You”
    “Houdini”

    MUSICIANS
    Dua Lipa: vocals
    """
    tracks = parse_tracklist_from_description(desc, default_artist="Dua Lipa", total_duration_seconds=900)
    assert len(tracks) == 4
    assert tracks[0]["title"] == "Training Season"
    assert tracks[0]["artist"] == "Dua Lipa"
    assert tracks[1]["title"] == "These Walls"
    assert tracks[2]["title"] == "Happy for You"
    assert tracks[3]["title"] == "Houdini"
    assert tracks[0]["duration_seconds"] == 225  # 900 // 4


def test_parse_tracklist_kexp_songs_header():
    desc = """
    http://KEXP.ORG presents Fontaines D.C. performing live in the KEXP studio.

    Songs:
    Nabokov
    Big Shot
    How Cold Love Is
    Roman Holiday

    Host: Morgan
    """
    tracks = parse_tracklist_from_description(desc, default_artist="Fontaines D.C.", total_duration_seconds=800)
    assert len(tracks) == 4
    assert tracks[0]["title"] == "Nabokov"
    assert tracks[1]["title"] == "Big Shot"
    assert tracks[2]["title"] == "How Cold Love Is"
    assert tracks[3]["title"] == "Roman Holiday"


def test_parse_single_track_fallback():
    desc = "More incredible live music moments. Recorded for BBC Radio 1."
    video_title = "Bruno Mars - All I Ask (Adele cover) in the Radio 1 Live Lounge"
    tracks = parse_tracklist_from_description(desc, default_artist="BBC Radio 1", total_duration_seconds=240, video_title=video_title)
    assert len(tracks) == 1
    assert tracks[0]["artist"] == "Bruno Mars"
    assert "All I Ask" in tracks[0]["title"]
    assert tracks[0]["duration_seconds"] == 240


def test_get_channel_recent_videos_rss():
    xml_content = """<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
      <title>NPR Music</title>
      <entry>
        <id>yt:video:y38qQRg3UDI</id>
        <yt:videoId>y38qQRg3UDI</yt:videoId>
        <title>Dua Lipa: Tiny Desk Concert</title>
        <published>2024-10-25T16:00:00+00:00</published>
      </entry>
    </feed>
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = xml_content.encode("utf-8")
    mock_resp.text = xml_content

    with patch("requests.get", return_value=mock_resp):
        videos = get_channel_recent_videos("UC4eYXhJI4-7wSWc8UNUu4HA")
        assert len(videos) == 1
        assert videos[0]["video_id"] == "y38qQRg3UDI"
        assert videos[0]["title"] == "Dua Lipa: Tiny Desk Concert"
        assert "y38qQRg3UDI" in videos[0]["thumbnail_url"]


def test_resolve_channel_info():
    html_content = """
    <html>
      <meta property="og:title" content="NPR Music">
      <meta property="og:image" content="https://example.com/nprmusic.jpg">
      <meta itemprop="channelId" content="UC4eYXhJI4-7wSWc8UNUu4HA">
    </html>
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = html_content
    mock_resp.url = "https://www.youtube.com/@nprmusic"

    with patch("requests.get", return_value=mock_resp):
        info = resolve_channel_info("@nprmusic")
        assert info["channel_id"] == "UC4eYXhJI4-7wSWc8UNUu4HA"
        assert info["title"] == "NPR Music"
        assert info["image_url"] == "https://example.com/nprmusic.jpg"
