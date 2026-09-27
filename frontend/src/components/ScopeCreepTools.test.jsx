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

    expect(screen.getByText('BBC Sounds - Scope Creep')).toBeInTheDocument()
    expect(screen.getByText('Followed shows')).toBeInTheDocument()
    expect(screen.getByText('Track listing extraction')).toBeInTheDocument()
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

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ shows: [] }),
        })
      )
      .mockImplementationOnce(() =>
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
          image_url: 'https://example.com/art.jpg',
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
          json: () => Promise.resolve({ shows: [] }),
        })
      )
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
        expect(body.tracks[0].artwork_url).toBe('https://example.com/art.jpg')
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

  it('creates a new Spotify playlist with custom title', async () => {
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
          image_url: 'https://example.com/art.jpg',
        },
      ],
    }

    const mockPlaylistResponse = {
      message: "Created playlist 'My Custom Title' with 1 tracks.",
      playlist_url: 'https://open.spotify.com/playlist/new123',
    }

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ shows: [] }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      )
      .mockImplementationOnce((url, options) => {
        expect(url).toContain('/tools/scope-creep/playlist')
        const body = JSON.parse(options.body)
        expect(body.mode).toBe('create')
        expect(body.title).toBe('My Custom Title')
        expect(body.spotify_uris).toEqual(['spotify:track:111'])
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlaylistResponse),
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

    const titleInput = screen.getByLabelText('Playlist Name')
    expect(titleInput.value).toBe('Indie Chill')
    fireEvent.change(titleInput, { target: { value: 'My Custom Title' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create Spotify Playlist (1)' }))

    await waitFor(() => {
      expect(screen.getByText("Created playlist 'My Custom Title' with 1 tracks.")).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open on Spotify' })).toHaveAttribute(
        'href',
        'https://open.spotify.com/playlist/new123'
      )
    })
  })

  it('adds tracks to an existing playlist selected from user playlists', async () => {
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
          image_url: 'https://example.com/art.jpg',
        },
      ],
    }

    const mockPlaylistsData = {
      playlists: [
        { id: 'playlist-abc', name: 'Weekend Vibes', url: 'https://open.spotify.com/playlist/playlist-abc' },
      ],
      needs_scope: false,
    }

    const mockAddResponse = {
      message: "Added 1 tracks to playlist 'Weekend Vibes'.",
      playlist_url: 'https://open.spotify.com/playlist/playlist-abc',
    }

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ shows: [] }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      )
      .mockImplementationOnce((url) => {
        expect(url).toContain('/tools/scope-creep/playlists')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlaylistsData),
        })
      })
      .mockImplementationOnce((url, options) => {
        expect(url).toContain('/tools/scope-creep/playlist')
        const body = JSON.parse(options.body)
        expect(body.mode).toBe('existing')
        expect(body.playlist_id).toBe('playlist-abc')
        expect(body.spotify_uris).toEqual(['spotify:track:111'])
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAddResponse),
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

    // Switch to existing playlist mode
    fireEvent.click(screen.getByLabelText('Add to existing playlist'))

    await waitFor(() => {
      expect(screen.getByLabelText('Select Playlist')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Select Playlist'), {
      target: { value: 'playlist-abc' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add to Existing Playlist (1)' }))

    await waitFor(() => {
      expect(screen.getByText("Added 1 tracks to playlist 'Weekend Vibes'.")).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open on Spotify' })).toHaveAttribute(
        'href',
        'https://open.spotify.com/playlist/playlist-abc'
      )
    })
  })

  it('shows authorization prompt when needs_scope is true', async () => {
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
          image_url: 'https://example.com/art.jpg',
        },
      ],
    }

    const mockPlaylistsData = {
      playlists: [],
      needs_scope: true,
    }

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ shows: [] }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      )
      .mockImplementationOnce((url) => {
        expect(url).toContain('/tools/scope-creep/playlists')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlaylistsData),
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

    fireEvent.click(screen.getByLabelText('Add to existing playlist'))

    await waitFor(() => {
      expect(screen.getByText(/Spotify requires additional permissions/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect Spotify Playlists' })).toBeInTheDocument()
    })
  })

  it('filters existing playlists using the search input', async () => {
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
          image_url: 'https://example.com/art.jpg',
        },
      ],
    }

    const mockPlaylistsData = {
      playlists: [
        { id: 'pl-1', name: 'Roadtrip Beats' },
        { id: 'pl-2', name: 'Ambient Chill' },
        { id: 'pl-3', name: 'Gym Workout' },
        { id: 'pl-4', name: 'Study Session' },
        { id: 'pl-5', name: 'Morning Coffee' },
        { id: 'pl-6', name: 'Evening Acoustic' },
      ],
      needs_scope: false,
    }

    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ shows: [] }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      )
      .mockImplementationOnce((url) => {
        expect(url).toContain('/tools/scope-creep/playlists')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlaylistsData),
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

    fireEvent.click(screen.getByLabelText('Add to existing playlist'))

    await waitFor(() => {
      expect(screen.getByLabelText('Search Playlists')).toBeInTheDocument()
    })

    // Search for "Chill"
    fireEvent.change(screen.getByLabelText('Search Playlists'), {
      target: { value: 'Chill' },
    })

    const select = screen.getByLabelText('Select Playlist')
    expect(select).toHaveTextContent('Ambient Chill')
    expect(select).not.toHaveTextContent('Roadtrip Beats')
  })

  it('loads followed shows, selects episode, and loads tracklist into extraction tool', async () => {
    const mockShows = {
      shows: [
        { brand_id: 'b01fm4ss', title: 'Gilles Peterson' },
      ],
    }
    const mockEpisodes = {
      brand_id: 'b01fm4ss',
      episodes: [
        {
          play_id: 'm0031w3y',
          title: 'Gilles Peterson: In session',
          release_date: '26 Sep 2026',
          duration: '180 mins',
          url: 'https://www.bbc.co.uk/sounds/play/m0031w3y',
        },
      ],
    }
    const mockShowData = {
      play_id: 'm0031w3y',
      title: 'Gilles Peterson: In session',
      tracks: [
        {
          segment_id: 'seg_1',
          artist: 'Knats',
          title: 'Newcastle Jazz',
          offset_seconds: 0,
          duration_seconds: 180,
          spotify_uri: 'spotify:track:222',
        },
      ],
      brand_info: {
        brand_id: 'b01fm4ss',
        title: 'Gilles Peterson',
        is_followed: true,
      },
    }

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/tools/scope-creep/followed-shows/b01fm4ss/episodes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEpisodes),
        })
      }
      if (urlStr.includes('/tools/scope-creep/followed-shows')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShows),
        })
      }
      if (urlStr.includes('/tools/scope-creep/fetch')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockShowData),
        })
      }
      return Promise.reject(new Error(`Unhandled fetch: ${urlStr}`))
    })

    render(
      <MemoryRouter>
        <ScopeCreepTools />
      </MemoryRouter>
    )

    // Wait for followed shows to load into select
    await waitFor(() => {
      expect(screen.getByText('Gilles Peterson')).toBeInTheDocument()
    })

    // Select Gilles Peterson
    fireEvent.change(screen.getByLabelText('Select Show'), {
      target: { value: 'b01fm4ss' },
    })

    // Wait for episodes to load
    await waitFor(() => {
      expect(screen.getByText(/Gilles Peterson: In session/)).toBeInTheDocument()
    })

    // Click Load Tracklist
    fireEvent.click(screen.getByRole('button', { name: 'Load Tracklist' }))

    // Verify tracklist is extracted and displayed
    await waitFor(() => {
      expect(screen.getByText('Newcastle Jazz')).toBeInTheDocument()
      expect(screen.getByText('✓ Following Show')).toBeInTheDocument()
    })
  })
})
