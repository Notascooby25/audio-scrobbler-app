import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ScrobbleList from './ScrobbleList'

describe('ScrobbleList', () => {
  afterEach(() => cleanup())

  it('renders artwork, track name, artist, and source in one readable row', () => {
    render(<ScrobbleList scrobbles={[{
      id: 1,
      track_name: 'Something Heavy',
      artist_name: 'Sam Fender',
      source: 'youtube',
      artwork_url: 'https://example.com/cover.jpg',
    }]} />)

    expect(screen.getByRole('img', { name: 'Something Heavy artwork' })).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(screen.getByText('Something Heavy')).toBeInTheDocument()
    expect(screen.getByText('Sam Fender')).toBeInTheDocument()
    expect(screen.getByText('youtube')).toBeInTheDocument()
  })
})
