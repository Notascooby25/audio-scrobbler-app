import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareDialog from './ShareDialog'
import { fetchLibraryCollection } from '../api'

vi.mock('../api', () => ({
  fetchLibraryCollection: vi.fn(),
}))

vi.mock('html-to-image', () => ({
  toBlob: vi.fn(),
}))

import { toBlob } from 'html-to-image'

const dateRange = { range: 'last.week', start_date: null, end_date: null, compare_to_previous: false }

const baseEntries = [
  { label: 'M83', secondary: null, play_count: 42, artwork_url: '/m83.jpg' },
  { label: 'The National', secondary: null, play_count: 12, artwork_url: '/tn.jpg' },
]

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
  toBlob.mockResolvedValue(new Blob(['fake'], { type: 'image/png' }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ShareDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ShareDialog open={false} kind="artists" entries={baseEntries} dateRange={dateRange} token="t" totalCount={2} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches more entries when the chosen size exceeds what is loaded', async () => {
    fetchLibraryCollection.mockResolvedValue({ entries: [...baseEntries, { label: 'Beach House', play_count: 5, artwork_url: '/bh.jpg' }, { label: 'Wilco', play_count: 3, artwork_url: '/w.jpg' }, { label: 'Grizzly Bear', play_count: 2, artwork_url: '/gb.jpg' }] })

    render(<ShareDialog open kind="artists" entries={baseEntries} dateRange={dateRange} token="t" totalCount={10} />)

    await waitFor(() => expect(fetchLibraryCollection).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't', entity: 'artists', limit: 5, offset: 0, dateRange })
    ))
  })

  it('clamps the size and shows a note when fewer entries are available than requested', async () => {
    render(<ShareDialog open kind="artists" entries={baseEntries} dateRange={dateRange} token="t" totalCount={2} />)

    await waitFor(() => expect(screen.getByText(/Only 2 artists available/)).toBeInTheDocument())
    expect(fetchLibraryCollection).not.toHaveBeenCalled()
  })

  it('enables the download button once an image has been generated', async () => {
    render(<ShareDialog open kind="artists" entries={baseEntries} dateRange={dateRange} token="t" totalCount={2} />)

    await waitFor(() => expect(toBlob).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).not.toBeDisabled())
  })
})
