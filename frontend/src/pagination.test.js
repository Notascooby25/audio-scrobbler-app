import { describe, expect, it } from 'vitest'
import { buildPageItems } from './pagination'

describe('buildPageItems', () => {
  it('returns every page when there are 7 or fewer pages', () => {
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('windows around the current page with ellipses for large page counts', () => {
    expect(buildPageItems(1, 837)).toEqual([1, 2, '...', 836, 837])
    expect(buildPageItems(10, 837)).toEqual([1, 2, '...', 9, 10, 11, '...', 836, 837])
    expect(buildPageItems(837, 837)).toEqual([1, 2, '...', 836, 837])
  })

  it('collapses adjacent ranges without a redundant ellipsis', () => {
    expect(buildPageItems(3, 10)).toEqual([1, 2, 3, 4, '...', 9, 10])
    expect(buildPageItems(4, 10)).toEqual([1, 2, 3, 4, 5, '...', 9, 10])
  })
})
