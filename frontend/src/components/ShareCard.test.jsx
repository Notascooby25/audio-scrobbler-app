import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ShareCard from './ShareCard'

const entries = [
  { label: 'M83', secondary: null, play_count: 42, artwork_url: '/m83.jpg' },
  { label: 'The National', secondary: null, play_count: 12, artwork_url: '/tn.jpg' },
]

describe('ShareCard', () => {
  afterEach(() => cleanup())

  it('renders the header with kind and date range label', () => {
    render(<ShareCard entries={entries} kind="artists" layout="grid" dateRangeLabel="Last week" />)

    expect(screen.getByText('Top Artists')).toBeInTheDocument()
    expect(screen.getByText('Last week')).toBeInTheDocument()
  })

  it('renders ranked entries in grid layout', () => {
    render(<ShareCard entries={entries} kind="artists" layout="grid" dateRangeLabel="Last week" />)

    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('M83')).toBeInTheDocument()
    expect(screen.getByText('42 scrobbles')).toBeInTheDocument()
  })

  it('renders ranked entries in list layout', () => {
    const { container } = render(<ShareCard entries={entries} kind="tracks" layout="list" dateRangeLabel="Last month" />)

    expect(screen.getByText('Top Tracks')).toBeInTheDocument()
    expect(container.querySelectorAll('.library-rank-row')).toHaveLength(2)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
