import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Settings Form Label Typography and Input Styling per DESIGN.md', () => {
  const stylesPath = path.resolve(__dirname, 'styles.css')
  const stylesContent = fs.readFileSync(stylesPath, 'utf-8')

  it('styles settings form labels in regular sentence case, 500 weight, 12px, normal tracking, #111111, line-height 1.4, gap 4px', () => {
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*text-transform:\s*none/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*font-weight:\s*500/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*font-size:\s*12px/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*letter-spacing:\s*normal/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*color:\s*#111111/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*line-height:\s*1\.4/
    )
    expect(stylesContent).toMatch(
      /\.settings-form label\s*\{[^}]*gap:\s*4px/
    )
  })

  it('styles settings form inputs and selects with 36px height, 8px 12px padding, 0.5px border, 8px radius, no shadow', () => {
    expect(stylesContent).toMatch(
      /\.settings-form select,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[^}]*height:\s*36px/
    )
    expect(stylesContent).toMatch(
      /\.settings-form select,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[^}]*padding:\s*8px 12px/
    )
    expect(stylesContent).toMatch(
      /\.settings-form select,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[^}]*border:\s*0\.5px solid #E5E5E5/
    )
    expect(stylesContent).toMatch(
      /\.settings-form select,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[^}]*border-radius:\s*8px/
    )
    expect(stylesContent).toMatch(
      /\.settings-form select,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)\s*\{[^}]*box-shadow:\s*none/
    )
  })

  it('provides blue focus state for settings inputs and selects', () => {
    expect(stylesContent).toMatch(
      /\.settings-form select:focus,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):focus\s*\{[^}]*border-color:\s*#0066FF/
    )
    expect(stylesContent).toMatch(
      /\.settings-form select:focus,\s*\.settings-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):focus\s*\{[^}]*box-shadow:\s*0 0 0 2px rgba\(0,\s*102,\s*255,\s*0\.1\)/
    )
  })
})

