import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import LibraryRankList from './LibraryRankList'

describe('LibraryRankList', () => {
  afterEach(() => cleanup())

  it('renders track metadata, rank offset, count bars, and hearts', () => {
    const { container } = render(
      <MemoryRouter><LibraryRankList
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
      /></MemoryRouter>,
    )

    expect(screen.getByText('61')).toBeInTheDocument()
    expect(screen.getByText('Slow Show')).toBeInTheDocument()
    expect(screen.getByText('The National')).toBeInTheDocument()
    expect(screen.getByText('51')).toBeInTheDocument()
    expect(screen.getByText('12 scrobbles')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Show 12 scrobbles for Slow Show' })).toHaveAttribute('href', '/library?filter_entity=track&filter_name=Slow%20Show&filter_secondary=The%20National')
    expect(screen.getByRole('button', { name: 'Remove from Spotify liked tracks' })).toBeInTheDocument()
  })

  it('uses artwork and count bars for artist rows without a track heart', () => {
    const { container } = render(
      <MemoryRouter><LibraryRankList
        entries={[{ label: 'M83', play_count: 4, artwork_url: '/artist.jpg' }]}
        kind="artists"
        token="token"
        page={1}
        pageSize={50}
        totalCount={1}
        view="grid"
      /></MemoryRouter>,
    )

    expect(screen.getByText('Artists scrobbled')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', '/artist.jpg')
    expect(screen.queryByRole('button', { name: /Spotify liked tracks/ })).not.toBeInTheDocument()
  })

  it('keeps long artist and album names in the card content', () => {
    render(
      <MemoryRouter><LibraryRankList
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
      /></MemoryRouter>,
    )

    expect(screen.getByText('An Extremely Long Album Name That Must Stay Readable On A Phone')).toBeInTheDocument()
    expect(screen.getByText('The Artist With A Long Name')).toBeInTheDocument()
  })

  it('renders full-bleed grid cards without checkboxes or menus in default grid mode', () => {
    const onToggleSelection = () => {}
    const onEntryChanged = () => {}
    const { container } = render(
      <MemoryRouter><LibraryRankList
        entries={[
          { label: 'In Rainbows', secondary: 'Radiohead', play_count: 100, artwork_url: '/in-rainbows.jpg' },
          { label: 'OK Computer', secondary: 'Radiohead', play_count: 50, artwork_url: '/ok-computer.jpg' },
        ]}
        kind="albums"
        token="test-token"
        page={1}
        pageSize={50}
        totalCount={2}
        view="grid"
        selectMode={false}
        onToggleSelection={onToggleSelection}
        onEntryChanged={onEntryChanged}
      /></MemoryRouter>,
    )

    // Checkbox should NOT be present when selectMode is false
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    // Three-dot menu button should NOT be present in grid mode
    expect(screen.queryByLabelText(/Actions for/)).not.toBeInTheDocument()

    // Rank, title, artist, count should be present
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('In Rainbows')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('OK Computer')).toBeInTheDocument()
    expect(screen.getByText('100 scrobbles')).toBeInTheDocument()
    expect(screen.getByText('50 scrobbles')).toBeInTheDocument()

    // Relative proportion bars: max count is 100 -> first is 100%, second is 50%
    const bars = container.querySelectorAll('[data-testid="grid-card-bar-fill"]')
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveStyle({ width: '100%' })
    expect(bars[1]).toHaveStyle({ width: '50%' })
  })

  it('renders checkbox overlays with scrim when selectMode is enabled in grid mode', () => {
    const onToggleSelection = () => {}
    render(
      <MemoryRouter><LibraryRankList
        entries={[
          { label: 'Kid A', secondary: 'Radiohead', play_count: 30, artwork_url: '/kid-a.jpg' },
        ]}
        kind="albums"
        token="test-token"
        page={1}
        pageSize={50}
        totalCount={1}
        view="grid"
        selectMode={true}
        onToggleSelection={onToggleSelection}
      /></MemoryRouter>,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Select Kid A' })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox.closest('label')).toHaveClass('grid-select-scrim')
  })
})
