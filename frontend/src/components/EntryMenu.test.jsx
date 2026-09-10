import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EntryMenu from './EntryMenu'
import { createBlock, deleteLibraryEntries } from '../api'

vi.mock('../api', () => ({
  createBlock: vi.fn(),
  deleteLibraryEntries: vi.fn(),
}))

describe('EntryMenu', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('blocks an entry from the menu and notifies the parent', async () => {
    createBlock.mockResolvedValue({ block: { id: 1 }, hidden_count: 100 })
    const onChanged = vi.fn()
    render(<EntryMenu token="token" entityType="album" name="Football Weekly" onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Options for Football Weekly' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Block' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Blocked "Football Weekly" — manage blocks in Settings.'))
    expect(createBlock).toHaveBeenCalledWith({ token: 'token', entityType: 'album', name: 'Football Weekly' })
  })

  it('requires confirmation before deleting and passes the track artist', async () => {
    deleteLibraryEntries.mockResolvedValue({ deleted: 3 })
    const onChanged = vi.fn()
    render(<EntryMenu token="token" entityType="track" name="Intro" secondary="The xx" playCount={3} onChanged={onChanged} />)

    fireEvent.click(screen.getByRole('button', { name: 'Options for Intro' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))

    expect(deleteLibraryEntries).not.toHaveBeenCalled()
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('Deleted 3 scrobbles for "Intro".'))
    expect(deleteLibraryEntries).toHaveBeenCalledWith({ token: 'token', entityType: 'track', name: 'Intro', secondary: 'The xx' })
  })

  it('cancels a pending delete without calling the API', () => {
    render(<EntryMenu token="token" entityType="artist" name="The Guardian" playCount={100} />)

    fireEvent.click(screen.getByRole('button', { name: 'Options for The Guardian' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteLibraryEntries).not.toHaveBeenCalled()
    expect(screen.getByRole('menuitem', { name: 'Block' })).toBeInTheDocument()
  })
})
