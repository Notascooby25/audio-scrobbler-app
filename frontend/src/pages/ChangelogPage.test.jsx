import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ChangelogPage from './ChangelogPage'

describe('ChangelogPage', () => {
  it('renders the changelog title and release versions', () => {
    render(
      <MemoryRouter>
        <ChangelogPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument()
    expect(screen.getByText('Updates & Improvements')).toBeInTheDocument()
    expect(screen.getByText('v0.9.5')).toBeInTheDocument()
  })
})
