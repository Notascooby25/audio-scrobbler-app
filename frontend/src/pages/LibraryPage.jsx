import { useEffect, useState } from 'react'
import AnalyticsPage from '../components/AnalyticsPage'
import RankedList from '../components/RankedList'
import ScrobbleList from '../components/ScrobbleList'
import TimelineChart from '../components/TimelineChart'
import { fetchLikedTracks, fetchLibraryCollection, fetchLibraryScrobbles, fetchLibraryTimeline } from '../api'
import { readSession } from '../session'

const TABS = [
  ['scrobbles', 'Scrobbles'],
  ['artists', 'Artists'],
  ['albums', 'Albums'],
  ['tracks', 'Tracks'],
  ['liked', 'Liked tracks'],
]

export default function LibraryPage() {
  const session = readSession()
  const [tab, setTab] = useState('scrobbles')
  const [data, setData] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [status, setStatus] = useState(session?.accessToken ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.accessToken) return
    setStatus('loading')
    const request = tab === 'scrobbles'
      ? fetchLibraryScrobbles({ token: session.accessToken, limit: 50, offset: 0 })
      : tab === 'liked'
        ? fetchLikedTracks({ token: session.accessToken, limit: 50, offset: 0 })
      : fetchLibraryCollection({ token: session.accessToken, entity: tab, limit: 50, offset: 0 })
    Promise.all([request, fetchLibraryTimeline({ token: session.accessToken })])
      .then(([result, chart]) => {
        setData(result)
        setTimeline(chart.entries)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }, [tab])

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Library">
      {!session?.accessToken && <p className="notice">Sign in from the home page to browse your library.</p>}
      {status === 'loading' && <p className="notice">Loading your library...</p>}
      {status === 'error' && <p className="notice notice-error" role="alert">{error}</p>}
      {session?.accessToken && (
        <>
          <div className="library-tabs" role="tablist" aria-label="Library sections">
            {TABS.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
          <div className="library-layout">
            {data && (tab === 'scrobbles'
              ? <ScrobbleList scrobbles={data.scrobbles} />
              : tab === 'liked'
                ? <RankedList title="Liked tracks" entries={data.tracks.map((track) => ({ label: track.track_name, secondary: track.artist_name, play_count: 1, artwork_url: track.artwork_url }))} />
                : <RankedList title={TABS.find(([value]) => value === tab)[1]} entries={data.entries} />)}
            <TimelineChart entries={timeline} />
          </div>
        </>
      )}
    </AnalyticsPage>
  )
}