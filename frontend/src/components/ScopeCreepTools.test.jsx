import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ScopeCreepTools from './ScopeCreepTools'

describe('ScopeCreepTools', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ accessToken: 'mock-token', userId: 1 }))
  })

  it('renders initial URL input form', () => {
    render(
      <MemoryRouter>
        <ScopeCreepTools />
      </MemoryRouter>
    )

    expect(screen.getByText('BBC Sounds: Scope Creep')).toBeInTheDocument()
    expect(screen.getByLabelText('BBC Sounds URL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fetch Show' })).toBeInTheDocument()
  })

  it('fetches show, renders tracklist, and allows track selection', async () => {
    const mockShowData = {
      play_id: 'm0031tc6',
      title: 'Indie Chill',
      tracks: [
        {
          segment_id: 'seg_1',
          artist: 'Lana Del Rey',
          title: 'Video Games',
          offset_seconds: 38,
          duration_seconds: 240,
          spotify_uri: 'spotify:track:111',
        },
        {
          segment_id: 'seg_2',
          artist: 'Radiohead',
          title: 'Karma Police',
          offset_seconds: 280,
          duration_seconds: 260,
          spotify_uri: null,
        },
      ],
    }

    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockShowData),
      })
    )

    render(
      <MemoryRouter>
        <ScopeCreepTools />
      </MemoryRouter>
    )

    const input = screen.getByLabelText('BBC Sounds URL')
    fireEvent.change(input, { target: { value: 'https://www.bbc.co.uk/sounds/play/m0031tc6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Show' }))

    await waitFor(() => {
      expect(screen.getByText('Indie Chill')).toBeInTheDocument()
    })

    expect(screen.getByText('Video Games')).toBeInTheDocument()
    expect(screen.getByText('Karma Police')).toBeInTheDocument()
    expect(screen.getByText('Create Spotify Playlist (1)')).toBeInTheDocument()
    expect(screen.getByText('Scrobble Selected (2)')).toBeInTheDocument()

    // Test deselect all
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }))
    expect(screen.getByText('Scrobble Selected (0)')).toBeInTheDocument()

    // Test select all
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(screen.getByText('Scrobble Selected (2)')).toBeInTheDocument()
  })

  it('scrobbles selected tracks and shows success feedback', async () => {
    const mockShowData = {
      play_id: 'm0031tc6',
      title: 'Indie Chill',
      tracks: [
        {
          segment_id: 'seg_1',
          artist: 'Lana Del Rey',
          title: 'Video Games',
          offset_seconds: 0,
          duration_seconds: 240,
          spotify_uri: 'spotify:track:111',
        },
      ],
    }

    const mockScrobbleResponse = {
      message: 'Scrobbled 1 tracks (0 duplicates skipped).',
      scrobbled_count: 1,
      duplicate_count: 0,
    }

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      )
      .mockImplementationOnce((url, options) => {
        expect(url).toContain('/tools/scope-creep/scrobble')
        const body = JSON.parse(options.body)
        expect(body.play_id).toBe('m0031tc6')
        expect(body.tracks.length).toBe(1)
        expect(body.tracks[0].title).toBe('Video Games')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockScrobbleResponse),
        })
      })

    render(
      <MemoryRouter>
        <ScopeCreepTools />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('BBC Sounds URL'), {
      target: { value: 'https://www.bbc.co.uk/sounds/play/m0031tc6' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Show' }))

    await waitFor(() => {
      expect(screen.getByText('Indie Chill')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Scrobble Selected (1)' }))

    await waitFor(() => {
      expect(screen.getByText('Scrobbled 1 tracks (0 duplicates skipped).')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'View in Library' })).toBeInTheDocument()
    })
  })
})
