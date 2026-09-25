import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Library List Row Density per DESIGN.md', () => {
  const stylesPath = path.resolve(__dirname, 'styles.css')
  const stylesContent = fs.readFileSync(stylesPath, 'utf-8')

  it('compresses list row height to 64px with 8px top/bottom and 12px left/right padding', () => {
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*height:\s*64px/
    )
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*padding:\s*8px 12px/
    )
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*gap:\s*12px/
    )
    expect(stylesContent).toMatch(
      /\.library-rank-row,\s*\.library-scrobble-row\s*\{[^}]*border-top:\s*0\.5px solid var\(--color-border\)/
    )
  })

  it('styles artwork to 48x48px with 4px border-radius', () => {
    expect(stylesContent).toMatch(
      /\.library-row-artwork\s*\{[^}]*width:\s*48px/
    )
    expect(stylesContent).toMatch(
      /\.library-row-artwork\s*\{[^}]*height:\s*48px/
    )
    expect(stylesContent).toMatch(
      /\.library-row-artwork\s*\{[^}]*border-radius:\s*4px/
    )
  })

  it('styles title as 15px bold (var\(--color-ink\), 600) and subtitle as 12px label (var\(--color-muted\))', () => {
    expect(stylesContent).toMatch(
      /\.library-row-copy strong\s*\{[^}]*font-size:\s*15px/
    )
    expect(stylesContent).toMatch(
      /\.library-row-copy strong\s*\{[^}]*font-weight:\s*600/
    )
    expect(stylesContent).toMatch(
      /\.library-row-copy strong\s*\{[^}]*color:\s*var\(--color-ink\)/
    )
    expect(stylesContent).toMatch(
      /\.library-row-copy small\s*\{[^}]*font-size:\s*12px/
    )
    expect(stylesContent).toMatch(
      /\.library-row-copy small\s*\{[^}]*color:\s*var\(--color-muted\)/
    )
  })

  it('styles count and time right-aligned with 12px, 500, var\(--color-muted\)', () => {
    expect(stylesContent).toMatch(
      /\.library-count-bar\s*\{[^}]*font-size:\s*12px/
    )
    expect(stylesContent).toMatch(
      /\.library-count-bar\s*\{[^}]*font-weight:\s*500/
    )
    expect(stylesContent).toMatch(
      /\.library-count-bar\s*\{[^}]*color:\s*var\(--color-muted\)/
    )
    expect(stylesContent).toMatch(
      /\.library-count-bar\s*\{[^}]*text-align:\s*right/
    )
    expect(stylesContent).toMatch(
      /\.library-scrobble-row time\s*\{[^}]*font-size:\s*12px/
    )
    expect(stylesContent).toMatch(
      /\.library-scrobble-row time\s*\{[^}]*font-weight:\s*500/
    )
    expect(stylesContent).toMatch(
      /\.library-scrobble-row time\s*\{[^}]*color:\s*var\(--color-muted\)/
    )
    expect(stylesContent).toMatch(
      /\.library-scrobble-row time\s*\{[^}]*text-align:\s*right/
    )
  })
})

