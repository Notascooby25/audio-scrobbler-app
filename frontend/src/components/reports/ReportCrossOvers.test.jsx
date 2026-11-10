import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Report1001Milestone from './Report1001Milestone'
import ReportLiveConnection from './ReportLiveConnection'

describe('ReportCrossOvers components', () => {
  afterEach(() => cleanup())

  it('renders 1001 album challenge stats and album chips', () => {
    const challenge1001 = {
      completed_in_period: 3,
      total_completed: 72,
      recent_albums: ['The Queen Is Dead', 'Rumours', 'Disintegration'],
    }

    render(
      <MemoryRouter>
        <Report1001Milestone challenge1001={challenge1001} />
      </MemoryRouter>
    )

    expect(screen.getByText(/3 Completed This Period/i)).toBeInTheDocument()
    expect(screen.getByText(/72 \/ 1001/i)).toBeInTheDocument()
    expect(screen.getByText(/The Queen Is Dead/i)).toBeInTheDocument()
    expect(screen.getByText(/Rumours/i)).toBeInTheDocument()
  })

  it('renders live gig artist connection with attended artists', () => {
    const liveArtists = {
      attended_artists_played: 2,
      total_scrobbles: 80,
      top_artists: [
        { artist_name: 'Pulp', count: 42 },
        { artist_name: 'The Cure', count: 38 },
      ],
    }

    render(<ReportLiveConnection liveArtists={liveArtists} />)

    expect(screen.getByText(/2 Seen-Live Artists Played/i)).toBeInTheDocument()
    expect(screen.getByText(/80 scrobbles for bands/i)).toBeInTheDocument()
    expect(screen.getByText(/Pulp \(42\)/i)).toBeInTheDocument()
    expect(screen.getByText(/The Cure \(38\)/i)).toBeInTheDocument()
  })
})
