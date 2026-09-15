import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LibraryViewToggle from './LibraryViewToggle'

describe('LibraryViewToggle', () => {
  afterEach(() => cleanup())

  it('renders List and Grid buttons and handles view change', () => {
    const onChange = vi.fn()
    render(<LibraryViewToggle view="list" onChange={onChange} />)

    const listBtn = screen.getByRole('button', { name: 'List' })
    const gridBtn = screen.getByRole('button', { name: 'Grid' })

    expect(listBtn).toHaveClass('active')
    expect(listBtn).toHaveAttribute('aria-pressed', 'true')
    expect(gridBtn).not.toHaveClass('active')
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(gridBtn)
    expect(onChange).toHaveBeenCalledWith('grid')
  })

  it('renders Select toggle button when onToggleSelectMode is provided', () => {
    const onChange = vi.fn()
    const onToggleSelectMode = vi.fn()
    const { rerender } = render(
      <LibraryViewToggle
        view="grid"
        onChange={onChange}
        selectMode={false}
        onToggleSelectMode={onToggleSelectMode}
      />
    )

    const selectBtn = screen.getByRole('button', { name: 'Select' })
    expect(selectBtn).toBeInTheDocument()
    expect(selectBtn).not.toHaveClass('active')
    expect(selectBtn).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(selectBtn)
    expect(onToggleSelectMode).toHaveBeenCalled()

    rerender(
      <LibraryViewToggle
        view="grid"
        onChange={onChange}
        selectMode={true}
        onToggleSelectMode={onToggleSelectMode}
      />
    )

    expect(selectBtn).toHaveClass('active')
    expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
  })
})
