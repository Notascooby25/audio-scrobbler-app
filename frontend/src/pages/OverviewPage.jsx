import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalyticsPage from '../components/AnalyticsPage'
import RankedList from '../components/RankedList'
import SummaryStatsBar from '../components/SummaryStatsBar'
import { backfillArtwork, fetchStatsChart, fetchStatsSummary, syncLikedTracks } from '../api'
import { readSession } from '../session'

export default function OverviewPage() {
  const session = readSession()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')
  const [syncStatus, setSyncStatus] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    Promise.all([
      fetchStatsSummary({ token: session.accessToken }),
      fetchStatsChart({ token: session.accessToken, entity: 'artists', limit: 5 }),
      fetchStatsChart({ token: session.accessToken, entity: 'albums', limit: 5 }),
      fetchStatsChart({ token: session.accessToken, entity: 'tracks', limit: 8 }),
    ]).then(([summary, artists, albums, tracks]) => {
      setData({ summary, artists: artists.entries, albums: albums.entries, tracks: tracks.entries })
      setStatus('ready')
    }).catch((requestError) => {
      setError(requestError.message)
      setStatus('error')
    })
  }, [])

  const refreshSpotifyLibrary = async () => {
    setSyncStatus('Syncing Spotify library...')
    try {
      const [liked, artwork] = await Promise.all([
        syncLikedTracks({ token: session.accessToken }),
        backfillArtwork({ token: session.accessToken }),
      ])
      setSyncStatus(`${liked.inserted + liked.updated} liked tracks synced; ${artwork.artwork_updated} scrobbles enriched.`)
    } catch (requestError) {
      setSyncStatus(requestError.message)
    }
  }

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Overview">
      {!session?.accessToken && <p className="notice">Sign in from the <Link to="/">home page</Link> to see your listening overview.</p>}
      {status === 'loading' && <p className="notice">Loading your listening overview...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      {data && (
        <>
          <SummaryStatsBar stats={data.summary} />
          <div className="library-sync">
            <button type="button" onClick={refreshSpotifyLibrary}>Sync Spotify library</button>
            {syncStatus && <p className="panel-meta" role="status">{syncStatus}</p>}
          </div>
          <div className="overview-grid">
            <RankedList title="Top artists" entries={data.artists} />
            <RankedList title="Top albums" entries={data.albums} />
            <RankedList title="Top tracks" entries={data.tracks} />
          </div>
          <p className="page-link"><Link to="/library">Explore the full library</Link></p>
        </>
      )}
    </AnalyticsPage>
  )
}