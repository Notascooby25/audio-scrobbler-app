# Library Timeline 5-Year Display Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit the "Scrobbles by year" chart on the Library page to display only the most recent 5 years of scrobble history, eliminating horizontal scrollbars and clutter from sparse older years.

**Architecture:** Update `TimelineChart.jsx` to slice the incoming year entries down to the last 5 items (`entries.slice(-5)`) and compute relative bar heights strictly across those visible 5 years. Adjust `styles.css` `.timeline-chart` so columns cleanly fill the card without triggering an unnecessary scrollbar. Add comprehensive unit tests in `TimelineChart.test.jsx`.

**Tech Stack:** React 18, Vitest, `@testing-library/react`, CSS3.

**Spec:** Brainstorming session 2026-10-31: restrict the Library timeline chart to the last 5 years to remove horizontal scrollbars and eliminate tiny sliver bars from older sporadic scrobble imports.

## Global Constraints

- Never reformat unrelated code; follow existing ESLint and Prettier styling.
- Follow "Flat-By-Default" rule from `DESIGN.md`: zero box-shadows, zero gradients, standard token variables.
- Keep changes focused and test-driven.
- Update `frontend/src/changelogData.js` and bump version in `frontend/package.json` to `0.29.2`.

## Review Focus

1. **Empty entries handling:** `entries = []` must continue to render the accessible notice "No timeline data yet."
2. **Fewer than 5 years:** When user history contains fewer than 5 years (e.g., 2 or 3 years), all available years must still render without error or blank gaps.
3. **More than 5 years:** When user history contains 6 or more years, exactly the 5 most recent years must be rendered and older years excluded.
4. **Max calculation:** The tallest bar must be 100% relative to the max count within the visible 5 years (not suppressed by a hidden older year).
5. **No horizontal scrollbar:** Container styling should allow columns to flex neatly without causing horizontal scroll in standard card widths.

---

### Task 1: Update `TimelineChart.jsx` and add `TimelineChart.test.jsx`

**Files:**
- Create: `frontend/src/components/TimelineChart.test.jsx`
- Modify: `frontend/src/components/TimelineChart.jsx:1-20`
- Modify: `frontend/src/styles.css:2864-2875`

**Interfaces:**
- Consumes: `entries: Array<{ period: string, count: number }>`
- Produces: `<TimelineChart entries={entries} />` rendering at most 5 columns for the latest 5 periods.

- [ ] **Step 1: Write failing unit tests in `frontend/src/components/TimelineChart.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TimelineChart from './TimelineChart'

describe('TimelineChart', () => {
  it('renders notice when entries array is empty', () => {
    render(<TimelineChart entries={[]} />)
    expect(screen.getByText('No timeline data yet.')).toBeInTheDocument()
  })

  it('renders all years when 5 or fewer years are provided', () => {
    const data = [
      { period: '2024', count: 100 },
      { period: '2025', count: 200 },
      { period: '2026', count: 300 },
    ]
    render(<TimelineChart entries={data} />)
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getAllByRole('generic', { hidden: true }).length).toBeGreaterThan(0)
  })

  it('renders only the last 5 years when more than 5 years are provided', () => {
    const data = [
      { period: '2018', count: 10 },
      { period: '2019', count: 20 },
      { period: '2021', count: 30 },
      { period: '2022', count: 40 },
      { period: '2023', count: 50 },
      { period: '2024', count: 60 },
      { period: '2025', count: 70 },
      { period: '2026', count: 80 },
    ]
    render(<TimelineChart entries={data} />)
    expect(screen.queryByText('2018')).not.toBeInTheDocument()
    expect(screen.queryByText('2019')).not.toBeInTheDocument()
    expect(screen.queryByText('2021')).not.toBeInTheDocument()
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('calculates maximum bar height relative to visible 5 years', () => {
    const data = [
      { period: '2018', count: 50000 }, // hidden
      { period: '2022', count: 10 },
      { period: '2023', count: 20 },
      { period: '2024', count: 50 },
      { period: '2025', count: 100 },
      { period: '2026', count: 100 },
    ]
    const { container } = render(<TimelineChart entries={data} />)
    const bars = container.querySelectorAll('.timeline-bar')
    expect(bars.length).toBe(5)
    // 2026 has count 100 which is the max of the visible items, so height should be 100%
    expect(bars[4].getAttribute('style')).toContain('height: 100%')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/components/TimelineChart.test.jsx`
Expected: FAIL because `TimelineChart.jsx` does not slice entries to 5 yet and older years appear.

- [ ] **Step 3: Update `TimelineChart.jsx` and `styles.css`**

In `frontend/src/components/TimelineChart.jsx`:
```jsx
export default function TimelineChart({ entries = [] }) {
  const visibleEntries = entries.slice(-5)
  const max = Math.max(...visibleEntries.map((entry) => entry.count), 1)

  return (
    <section className="timeline-panel">
      <div className="section-heading">
        <h2>Scrobbles by year</h2>
      </div>
      {visibleEntries.length === 0 ? <p className="notice">No timeline data yet.</p> : (
        <div className="timeline-chart" aria-label="Scrobbles by year">
          {visibleEntries.map((entry) => (
            <div className="timeline-column" key={entry.period}>
              <div
                className="timeline-bar"
                style={{ height: `${Math.max((entry.count / max) * 100, 4)}%` }}
                title={`${entry.period}: ${entry.count.toLocaleString()}`}
              />
              <span>{entry.period}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

In `frontend/src/styles.css`:
Ensure `.timeline-chart` cleanly displays 5 items with `overflow-x: auto` as responsive fallback, without forcing unnecessary scrollbar.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/components/TimelineChart.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full frontend test suite and linter**

Run:
```bash
cd frontend && npm run lint && npm test
npx prettier --write src/components/TimelineChart.jsx src/components/TimelineChart.test.jsx src/styles.css
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TimelineChart.jsx frontend/src/components/TimelineChart.test.jsx frontend/src/styles.css
git commit -m "feat(library): limit scrobbles-by-year timeline chart to last 5 years"
```

---

### Task 2: Bump version, update changelog and page specs

**Files:**
- Modify: `frontend/package.json:4`
- Modify: `frontend/src/changelogData.js:1-10`
- Modify: `agents/page_specs.md:101`

**Interfaces:**
- Documentation and version bump (`0.29.2`).

- [ ] **Step 1: Update `frontend/src/changelogData.js`**

Add new entry for `0.29.2` at the top:
```javascript
  {
    version: "0.29.2",
    date: "2026-10-31",
    changes: [
      "Library Timeline: Limited the 'Scrobbles by year' chart to the last 5 years to eliminate horizontal scrollbars and remove sparse older archive years.",
    ],
  },
```

- [ ] **Step 2: Bump version in `frontend/package.json` to `"0.29.2"`**

- [ ] **Step 3: Update `agents/page_specs.md`**

Reflect that `TimelineChart` shows the 5 most recent years.

- [ ] **Step 4: Format and run frontend build**

Run:
```bash
npx prettier --write frontend/package.json frontend/src/changelogData.js
cd frontend && npm run build
```
Expected: Build passes with 0 errors.

- [ ] **Step 5: Run security differential-review and commit**

Run differential review on modified files.
Stage and commit:
```bash
git add frontend/package.json frontend/src/changelogData.js agents/page_specs.md
git commit -m "docs: record 5-year timeline limit in changelog and page specs (v0.29.2)"
```
