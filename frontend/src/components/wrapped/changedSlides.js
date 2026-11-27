// Which slides show an "updated" tag, given the snapshot's list of changed numbers
// (such as "music.estimated_minutes") from when the full-year version replaced the 31 December one.
const SLIDE_FOR_KEY = {
  "music.total_plays": "minutes",
  "music.estimated_minutes": "minutes",
  "music.months": "months",
  "music.busiest_month": "months",
  "music.top_artists": "artists",
  "music.top_songs": "songs",
  "music.top_albums": "albums",
  "music.top_genres": "genres",
  "music.busiest_hour": "clock",
  "music.busiest_weekday": "clock",
  "music.listener_label": "clock",
  "music.biggest_day": "biggest-day",
  "music.new_artists": "new-artists",
  "music.first_song": "new-artists",
  "gigs.nights": "gigs-glance",
  "gigs.artists": "gigs-glance",
  "gigs.venues": "gigs-glance",
  "gigs.new_venues": "gigs-glance",
  "gigs.festival_nights": "gigs-glance",
  "gigs.miles": "gigs-miles",
  "gigs.months_with_gigs": "gigs-calendar",
  "gigs.busiest_month": "gigs-calendar",
  "gigs.most_seen": "gigs-highlights",
  "gigs.first_night": "gigs-highlights",
  "gigs.last_night": "gigs-highlights",
  "gigs.longest_gap_days": "gigs-highlights",
  "gigs.songs_heard_live": "gigs-highlights",
};

export function changedSlideIds(changed) {
  return new Set((changed || []).map((key) => SLIDE_FOR_KEY[key]).filter(Boolean));
}
