import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import HeaderNav from './HeaderNav'

vi.mock('../api', () => ({
  fetchUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 3 }),
}))

describe('HeaderNav', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('renders links to all primary sections', () => {
    render(<MemoryRouter><HeaderNav /></MemoryRouter>)

    ;['Overview', 'Library', 'Reports', 'Profile', 'Following', 'Connect'].forEach((label) => {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    })
  })

  it('marks the active page link based on the current route', () => {
    render(<MemoryRouter initialEntries={['/library']}><HeaderNav /></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'Library' })).toHaveClass('nav-link-active')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveClass('nav-link-active')
  })

  it('toggles the mobile navigation menu open and closed', () => {
    render(<MemoryRouter><HeaderNav /></MemoryRouter>)
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' })
    const nav = screen.getByLabelText('Primary navigation')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(nav).not.toHaveClass('topbar-nav-open')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(nav).toHaveClass('topbar-nav-open')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(nav).not.toHaveClass('topbar-nav-open')
  })

  it('closes the mobile menu after selecting a link', () => {
    render(<MemoryRouter><HeaderNav /></MemoryRouter>)
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Reports' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders an accessible SVG outline notification bell and badge without emoji when authenticated', async () => {
    localStorage.setItem('audio-scrobbler-session', JSON.stringify({ userId: 1, accessToken: 'demo-token' }))
    render(<MemoryRouter><HeaderNav /></MemoryRouter>)

    await waitFor(() => {
      const bellLinks = screen.getAllByRole('link', { name: /unread notification/i })
      expect(bellLinks.length).toBeGreaterThan(0)
    })

    expect(screen.queryByText('🔔')).not.toBeInTheDocument()
    const badgeElements = screen.getAllByText('3')
    expect(badgeElements.length).toBeGreaterThan(0)
  })
})
