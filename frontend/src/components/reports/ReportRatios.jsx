import PropTypes from 'prop-types'

export default function ReportRatios({ summary }) {
  const periodScrobbles = summary?.period_scrobbles || 0
  const uniqueArtists = Math.max(1, summary?.unique_artists || 1)
  const uniqueAlbums = Math.max(1, summary?.unique_albums || 1)
  const uniqueTracks = summary?.unique_tracks || 0
  const velocity = summary?.discovery_velocity

  const scrobblesPerArtist = (periodScrobbles / uniqueArtists).toFixed(1)
  const tracksPerAlbum = (uniqueTracks / uniqueAlbums).toFixed(1)
  const newPct = velocity?.new_artists_percent != null ? velocity.new_artists_percent.toFixed(1) : '0.0'
  const newArtists = velocity?.new_artists || 0

  return (
    <div className="report-ratios-grid" aria-label="Listening Ratios and Discovery">
      <div className="report-ratio-card">
        <span className="ratio-kicker">Music Ratio</span>
        <h3>Explorer vs. Repeater</h3>
        <div className="ratio-stat">
          <span className="ratio-value">{scrobblesPerArtist}</span>
          <span className="ratio-sub">Scrobbles per artist</span>
        </div>
        <p className="ratio-desc">
          Lower indicates discovering new artists; higher means looping favorites.
        </p>
      </div>

      <div className="report-ratio-card">
        <span className="ratio-kicker">Music Ratio</span>
        <h3>Singles vs. Albums</h3>
        <div className="ratio-stat">
          <span className="ratio-value">{tracksPerAlbum}</span>
          <span className="ratio-sub">Tracks per album</span>
        </div>
        <p className="ratio-desc">
          Lower indicates picking singles; higher means listening through full albums.
        </p>
      </div>

      <div className="report-ratio-card">
        <span className="ratio-kicker">Discovery Velocity</span>
        <h3>New vs. Familiar</h3>
        <div className="ratio-stat">
          <span className="ratio-value ratio-value-accent">{newPct}%</span>
          <span className="ratio-sub">First-time artists</span>
        </div>
        <p className="ratio-desc">
          {newArtists} artist{newArtists === 1 ? '' : 's'} heard for the first time in your scrobble history.
        </p>
      </div>
    </div>
  )
}

ReportRatios.propTypes = {
  summary: PropTypes.shape({
    period_scrobbles: PropTypes.number,
    unique_artists: PropTypes.number,
    unique_albums: PropTypes.number,
    unique_tracks: PropTypes.number,
    discovery_velocity: PropTypes.shape({
      new_artists: PropTypes.number,
      total_artists: PropTypes.number,
      new_artists_percent: PropTypes.number,
    }),
  }),
}
