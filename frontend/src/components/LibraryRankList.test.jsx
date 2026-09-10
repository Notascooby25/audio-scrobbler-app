import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import LibraryRankList from './LibraryRankList'

describe('LibraryRankList', () => {
  afterEach(() => cleanup())

  it('renders track metadata, rank offset, count bars, and hearts', () => {
    const { container } = render(
      <LibraryRankList
        entries={[{
          label: 'Slow Show',
          secondary: 'The National',
          play_count: 12,
          artwork_url: '/cover.jpg',
          spotify_track_id: 'track-1',
          is_liked: true,
        }]}
        kind="tracks"
        token="token"
        page={2}
        pageSize={50}
        totalCount={61}
        view="list"
      />,
    )

    expect(screen.getByText('61')).toBeInTheDocument()
    expect(screen.getByText('Slow Show')).toBeInTheDocument()
    expect(screen.getByText('The National')).toBeInTheDocument()
    expect(screen.getByText('51')).toBeInTheDocument()
    expect(screen.getByText('12 scrobbles')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove from Spotify liked tracks' })).toBeInTheDocument()
  })

  it('uses artwork and count bars for artist rows without a track heart', () => {
    const { container } = render(
      <LibraryRankList
        entries={[{ label: 'M83', play_count: 4, artwork_url: '/artist.jpg' }]}
        kind="artists"
        token="token"
        page={1}
        pageSize={50}
        totalCount={1}
        view="grid"
      />,
    )

    expect(screen.getByText('Artists scrobbled')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', '/artist.jpg')
    expect(screen.queryByRole('button', { name: /Spotify liked tracks/ })).not.toBeInTheDocument()
  })

  it('keeps long artist and album names in the card content', () => {
    render(
      <LibraryRankList
        entries={[{
          label: 'An Extremely Long Album Name That Must Stay Readable On A Phone',
          secondary: 'The Artist With A Long Name',
          play_count: 8,
          artwork_url: '/album.jpg',
        }]}
        kind="albums"
        page={1}
        pageSize={50}
        totalCount={1}
        view="grid"
      />,
    )

    expect(screen.getByText('An Extremely Long Album Name That Must Stay Readable On A Phone')).toBeInTheDocument()
    expect(screen.getByText('The Artist With A Long Name')).toBeInTheDocument()
  })
})
