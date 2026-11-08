# Design Spec: Share Dialog Grid Dimensions & Stats Infusions

## Summary
Enhance the Library and Overview "Share" dialog with user-selectable grid dimension presets (`2×2`, `2×3`, `3×2`, `3×3`) defaulting to `3×3`, plus toggleable stats banners for the generated share card:
1. **Listening time** with green `▲` or red `▼` percentage comparison against the previous equivalent period.
2. **Active sources only** with scrobble percentage pills for only the sources used during the selected period.
3. **Discoveries** count of newly discovered entities (artists/albums/tracks first played during this period).

## UI Specifications
- **Grid Dimension Selector:**
  - Replaces or enhances the single range slider in `ShareDialog.jsx`.
  - Available options:
    - `2 × 2` (4 items)
    - `2 × 3` (6 items - tall/portrait)
    - `3 × 2` (6 items - wide/landscape)
    - `3 × 3` (9 items - square collage) [DEFAULT]
  - When in "List" layout mode, the total count corresponds to the selected dimension (4, 6, 6, 9).
  - In "Grid" layout mode, `.share-card-grid` uses CSS grid templates matching the chosen columns (`repeat(2, 1fr)` or `repeat(3, 1fr)`).
- **Extra Infusion Checkboxes in Dialog:**
  - `includeListeningTime` (default: false, or user choice)
  - `includeSources` (default: false)
  - `includeDiscoveries` (default: false)
- **Share Card Rendering:**
  - When any of the infusion options are enabled, a `.share-card-stats-banner` is rendered right below the card header and above the items.
  - Active sources only renders badges for sources with > 0 scrobbles during the window (e.g. Spotify 80%, BBC Sounds 20%). Unused sources are omitted.
  - Listening time shows formatted time (e.g., `18h 42m`) and comparison percent (`▲ +14%` in green or `▼ -8%` in red).
  - Discoveries shows the count of newly discovered artists/albums/tracks during the selected range.

## Backend / API Support
- Extend `/reports/summary` (or provide companion stats query) to return:
  - `source_breakdown: dict[str, int]` or list of `{source: str, count: int, percent: float}` for the period.
  - `new_discoveries: int` (count of artists/albums/tracks whose minimum `played_at` for the user falls within `[start, end)`).
- When `/reports/summary` is requested with `compare_to_previous=true`, it already calculates `listening_minutes` and `listening_minutes_comparison_percent`.
