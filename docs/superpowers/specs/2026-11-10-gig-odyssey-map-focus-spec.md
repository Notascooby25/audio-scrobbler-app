# Gig Odyssey Map Focus & Zoom Out Spec

## Goal
Improve the clarity of the Gig Odyssey map on the Reports > Gigs tab when a user has primarily UK concerts alongside occasional international concerts (e.g., Las Vegas, USA).

## Problem
Currently, the map computes a single bounding box spanning all venue pins. When an international pin is located far away (e.g. Las Vegas at lng -115° vs UK at lng -2°), the bounding box stretches across a wide geographic swath, crushing all UK concerts into an unreadable, overlapping vertical sliver on the right-hand edge.

## Architecture & Visual Solution

1. **Default Mode: "UK Focus" (`viewMode: "uk"`)**:
   - The map bounds default to the UK & Ireland bounding box (approx. Lat 49.8° to 59.5°, Lng -8.5° to 2.2°).
   - Only UK & Ireland pins and arcs are plotted in this view, giving every UK city and venue plenty of space and readability.
   - If the user has any gigs outside the UK & Ireland, a prominent, accessible pill button appears in the top-right corner of the map header:
     - Text: `✈️ N gigs abroad (e.g. Las Vegas) · Zoom out`
     - Action: Clicking switches `viewMode` to `"world"`.

2. **Expanded Mode: "World Odyssey" (`viewMode: "world"`)**:
   - Computes the full global bounding box including all international pins, showing the transatlantic or intercontinental travel arcs radiating from home.
   - The button switches to:
     - Text: `🇬🇧 Focus UK`
     - Action: Clicking switches back to `viewMode` to `"uk"`.

3. **Single Country / International-Only Users**:
   - If a user has 0 international gigs, the toggle button is cleanly hidden and the map remains in focused UK mode.
   - If a user's home city is outside the UK, the map dynamically frames around their home region or defaults to the world view appropriately.

## Constraints & Styling
- Adheres to `DESIGN.md`: Flat-by-default, semantic tokens (`--color-surface`, `--color-ink`, `--color-primary`, `--tl-tile`, `--color-border`), zero gradients/box-shadows.
- Interactive tooltip and pin selection behavior remains intact in both views.
