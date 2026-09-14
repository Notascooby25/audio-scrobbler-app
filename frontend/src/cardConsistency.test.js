import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Card Border Consistency & Flat-By-Default Audit', () => {
  const stylesPath = path.resolve(__dirname, 'styles.css')
  const stylesContent = fs.readFileSync(stylesPath, 'utf-8')

  it('contains zero non-none box-shadows across styles.css', () => {
    // Find all box-shadow property declarations
    const boxShadowMatches = stylesContent.match(/box-shadow\s*:\s*([^;]+);/g) || []
    expect(boxShadowMatches.length).toBeGreaterThan(0)
    for (const declaration of boxShadowMatches) {
      expect(declaration).toMatch(/box-shadow\s*:\s*none\s*;/)
    }
  })

  it('contains zero gradients across styles.css', () => {
    expect(stylesContent).not.toMatch(/linear-gradient/i)
    expect(stylesContent).not.toMatch(/radial-gradient/i)
    expect(stylesContent).not.toMatch(/conic-gradient/i)
  })

  it('defines canonical .card class with standard properties', () => {
    expect(stylesContent).toMatch(
      /\.card\s*\{[^}]*background:\s*var\(--color-surface\)[^}]*border:\s*0\.5px solid var\(--color-border\)[^}]*border-radius:\s*var\(--radius-md\)[^}]*padding:\s*16px/
    )
  })

  it('standardizes key card containers to 12px radius, 0.5px border, and 16px padding', () => {
    const cardSelectors = [
      '.dashboard',
      '.library-scrobble-panel',
      '.library-rank-panel',
      '.timeline-panel',
      '.ranked-panel',
      '.charts-panel',
      '.chart-panel',
      '.report-banner',
      '.report-card',
      '.month-card',
      '.settings-form',
      '.settings-danger-zone',
      '.profile-card',
      '.profile-connect',
      '.scrobble-list',
      '.import-summary',
    ]

    for (const selector of cardSelectors) {
      expect(stylesContent).toContain(selector)
    }
  })
})
