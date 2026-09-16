import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import LibraryScrobbleList from './LibraryScrobbleList'

describe('LibraryScrobbleList', () => {
  afterEach(() => cleanup())

  it('groups rows by date and preserves source badges', () => {
    render(
      <LibraryScrobbleList
        token="token"
        view="list"
        scrobbles={[
          { id: 1, track_name: 'Video Games', artist_name: 'Lana Del Rey', source: 'spotify', played_at: new Date().toISOString(), spotify_track_id: 'track-1' },
          { id: 2, track_name: 'Daylight', artist_name: 'Matt Berninger', source: 'youtube', played_at: new Date().toISOString(), spotify_track_id: null },
        ]}
      />,
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('spotify')).toBeInTheDocument()
    expect(screen.getByText('youtube')).toBeInTheDocument()
  })
})
