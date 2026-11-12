from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Base, MusicRecommendation, Notification, User


def test_music_recommendation_model_attributes():
    rec = MusicRecommendation(
        sender_id=1,
        receiver_id=2,
        item_type="track",
        title="Glasgow",
        artist_name="The Snuts",
        album_name="W.L.",
        image_url="https://example.com/art.jpg",
        spotify_uri="spotify:track:12345",
        spotify_url="https://open.spotify.com/track/12345",
        note="Listen to the guitar riff!",
        status="pending",
    )
    assert rec.sender_id == 1
    assert rec.receiver_id == 2
    assert rec.item_type == "track"
    assert rec.title == "Glasgow"
    assert rec.artist_name == "The Snuts"
    assert rec.album_name == "W.L."
    assert rec.image_url == "https://example.com/art.jpg"
    assert rec.spotify_uri == "spotify:track:12345"
    assert rec.spotify_url == "https://open.spotify.com/track/12345"
    assert rec.note == "Listen to the guitar riff!"
    assert rec.status == "pending"


def test_notification_model_link_attribute():
    notif = Notification(
        user_id=1,
        title="Music Recommendation",
        message="Friend recommended a song",
        type="recommendation",
        link="/play",
    )
    assert notif.link == "/play"
