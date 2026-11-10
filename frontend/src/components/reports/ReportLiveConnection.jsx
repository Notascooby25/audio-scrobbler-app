import PropTypes from 'prop-types'

export default function ReportLiveConnection({ liveArtists }) {
  const attendedCount = liveArtists?.attended_artists_played || 0
  const totalScrobbles = liveArtists?.total_scrobbles || 0
  const topArtists = liveArtists?.top_artists || []

  return (
    <div className="report-crossover-card crossover-live" aria-label="Live Concert Artist Connection">
      <div className="crossover-header">
        <span className="crossover-badge badge-live">Live Artist Connection</span>
        <span className="crossover-meta">Concert History Sync</span>
      </div>
      <div className="crossover-title">
        {attendedCount} Seen-Live Artists Played
      </div>
      <p className="crossover-desc">
        {attendedCount > 0
          ? `${totalScrobbles} scrobbles for bands you've experienced in concert:`
          : 'Log your attended concerts in the Gigs tab to track scrobbles for bands you have seen live!'}
      </p>
      <div className="crossover-chips">
        {topArtists.length > 0 ? (
          topArtists.map((artist, idx) => (
            <span key={idx} className="crossover-chip chip-live">
              🎫 {artist.artist_name} ({artist.count})
            </span>
          ))
        ) : (
          <span className="crossover-chip-empty">No live concert artists heard this period</span>
        )}
      </div>
    </div>
  )
}

ReportLiveConnection.propTypes = {
  liveArtists: PropTypes.shape({
    attended_artists_played: PropTypes.number,
    total_scrobbles: PropTypes.number,
    top_artists: PropTypes.arrayOf(
      PropTypes.shape({
        artist_name: PropTypes.string,
        count: PropTypes.number,
      })
    ),
  }),
}
