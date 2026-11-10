from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer


class MonthlySummaryEntry(BaseModel):
    month: str
    total_plays: int
    unique_tracks: int
    total_listening_minutes: int

    model_config = ConfigDict(from_attributes=True)


class MonthlySummaryResponse(BaseModel):
    user_id: int
    summary: list[MonthlySummaryEntry]
    total_months: int

    model_config = ConfigDict(from_attributes=True)


class ScrobbleListEntry(BaseModel):
    id: int
    track_name: str
    artist_name: str
    source: str
    played_at: datetime
    artwork_url: str | None = None
    artwork_color: str | None = None
    spotify_track_id: str | None = None
    is_liked: bool = False

    @field_serializer("played_at")
    def serialize_played_at(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    model_config = ConfigDict(from_attributes=True)


class ScrobbleListResponse(BaseModel):
    user_id: int
    scrobbles: list[ScrobbleListEntry]
    limit: int
    offset: int

    model_config = ConfigDict(from_attributes=True)


class ChartEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int
    artwork_url: str | None = None
    spotify_track_id: str | None = None
    spotify_album_id: str | None = None
    sources: list[str] = []
    is_liked: bool = False

    model_config = ConfigDict(from_attributes=True)


class ChartResponse(BaseModel):
    user_id: int
    entity: str
    range: str
    entries: list[ChartEntry]

    model_config = ConfigDict(from_attributes=True)


class LegacyChartEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int


class LegacyChartResponse(BaseModel):
    user_id: int
    entity: str
    range: str
    entries: list[LegacyChartEntry]


class StatsResponse(BaseModel):
    user_id: int
    total_scrobbles: int
    unique_artists: int


class LibraryEntry(BaseModel):
    label: str
    secondary: str | None = None
    play_count: int
    artwork_url: str | None = None
    sources: list[str] = []
    spotify_track_id: str | None = None
    spotify_album_id: str | None = None
    is_liked: bool = False


class LibraryResponse(BaseModel):
    user_id: int
    entries: list[LibraryEntry]
    limit: int
    offset: int
    total_count: int


class LibraryScrobbleEntry(ScrobbleListEntry):
    pass


class LibraryScrobbleResponse(BaseModel):
    user_id: int
    scrobbles: list[LibraryScrobbleEntry]
    limit: int
    offset: int
    total_count: int


class TimelineEntry(BaseModel):
    period: str
    count: int


class TimelineResponse(BaseModel):
    user_id: int
    entries: list[TimelineEntry]


class SourceBreakdownEntry(BaseModel):
    source: str
    count: int
    percent: float

    model_config = ConfigDict(from_attributes=True)


class DiscoveriesEntry(BaseModel):
    artists: int = 0
    albums: int = 0
    tracks: int = 0

    model_config = ConfigDict(from_attributes=True)


class PeakDayEntry(BaseModel):
    date: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class HeavyRotationEntry(BaseModel):
    track_name: str
    artist_name: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class DiscoveryVelocityEntry(BaseModel):
    new_artists: int = 0
    total_artists: int = 0
    new_artists_percent: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class Challenge1001Entry(BaseModel):
    completed_in_period: int = 0
    total_completed: int = 0
    recent_albums: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class LiveArtistItem(BaseModel):
    artist_name: str
    count: int

    model_config = ConfigDict(from_attributes=True)


class LiveArtistsEntry(BaseModel):
    attended_artists_played: int = 0
    total_scrobbles: int = 0
    top_artists: list[LiveArtistItem] = []

    model_config = ConfigDict(from_attributes=True)


class ReportSummaryResponse(BaseModel):
    user_id: int
    range: str
    total_scrobbles: int
    period_scrobbles: int
    previous_period_scrobbles: int
    comparison_percent: float
    listening_minutes: int
    previous_listening_minutes: int = 0
    listening_minutes_comparison_percent: float = 0.0
    average_per_day: float
    previous_average_per_day: float = 0.0
    average_per_day_comparison_percent: float = 0.0
    following_average_scrobbles: float | None = None
    unique_artists: int = 0
    unique_albums: int = 0
    unique_tracks: int = 0
    source_breakdown: list[SourceBreakdownEntry] = []
    new_discoveries: DiscoveriesEntry = DiscoveriesEntry()
    current_streak_days: int = 0
    period_best_streak_days: int = 0
    peak_day: PeakDayEntry | None = None
    heavy_rotation: HeavyRotationEntry | None = None
    persona: str = "Discovery Voyager"
    discovery_velocity: DiscoveryVelocityEntry = DiscoveryVelocityEntry()
    challenge_1001: Challenge1001Entry = Challenge1001Entry()
    live_artists: LiveArtistsEntry = LiveArtistsEntry()


class ReportPoint(BaseModel):
    label: str
    count: int


class HeatmapPoint(BaseModel):
    day: int
    hour: int
    count: int


class ReportChartsResponse(BaseModel):
    user_id: int
    range: str
    weekly_scrobbles: list[ReportPoint]
    listening_clock: list[ReportPoint]
    music_by_decade: list[ReportPoint]
    listening_heatmap: list[HeatmapPoint]


class RediscoverTrackEntry(BaseModel):
    track_name: str
    artist_name: str
    album_name: str | None = None
    artwork_url: str | None = None
    track_id: str
    play_count: int
    last_played_at: datetime
    context_badge: str | None = None

    @field_serializer("last_played_at")
    def serialize_last_played_at(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    model_config = ConfigDict(from_attributes=True)


class RediscoverResponse(BaseModel):
    user_id: int
    mode: str
    tracks: list[RediscoverTrackEntry]

    model_config = ConfigDict(from_attributes=True)


class CreateRediscoverPlaylistRequest(BaseModel):
    mode: str = "forgotten"
    title: str | None = None
    track_ids: list[str] | None = None


class CreateRediscoverPlaylistResponse(BaseModel):
    playlist_name: str
    playlist_url: str
    track_count: int
