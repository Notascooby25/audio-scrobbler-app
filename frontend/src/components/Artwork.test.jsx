import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Artwork from './Artwork'

describe('Artwork', () => {
  afterEach(() => cleanup())

  it('renders a stable fallback with readable initials when artwork is missing', () => {
    render(<Artwork label="Sam Fender" />)

    expect(screen.getByRole('img', { name: 'Sam Fender artwork unavailable' })).toHaveTextContent('SF')
  })

  it('falls back when a remote artwork URL fails', () => {
    render(<Artwork src="https://example.com/missing.jpg" label="The National" />)
    const image = screen.getByRole('img', { name: 'The National artwork' })

    fireEvent.error(image)

    expect(screen.getByRole('img', { name: 'The National artwork unavailable' })).toHaveTextContent('TN')
  })
})
