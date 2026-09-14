---
name: Audio Scrobbler App
description: A self-hosted, full-stack application for tracking, analyzing, and sharing your music listening history.
colors:
  primary: "#0066FF"
  neutral-bg: "#F7F7F7"
  surface: "#FFFFFF"
  border: "#E5E5E5"
  text-primary: "#111111"
  text-secondary: "#888888"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
spacing:
  sm: "8px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Audio Scrobbler App

## Overview

**Creative North Star: "The Focused Utility"**

A highly functional, data-dense interface inspired by productivity tools like Linear, Notion, and iOS Settings. The aesthetic is strictly flat and utilitarian, prioritizing clarity, information density, and speed over decoration.

## Colors

A reductive, monochromatic palette anchored by a single blue accent.

### Primary
- **Blue Accent** (#0066FF): Used sparingly for primary actions, active states, and critical data visualization.

### Neutral
- **Off-White Background** (#F7F7F7): The canvas for all views.
- **White Surface** (#FFFFFF): Used for cards and content containers.
- **Hairline Border** (#E5E5E5): Used for the 0.5px borders separating elements.
- **Primary Text** (#111111): High contrast text for readability.
- **Secondary Text** (#888888): Muted gray for metadata, timestamps, and secondary lists.

### Named Rules
**The One Voice Rule.** The blue accent is used sparingly (≤5% of any screen). Its rarity is the point, signalling only actionable elements or primary data points.

## Typography

**Display Font:** Inter (with system sans-serif fallback)
**Body Font:** Inter (with system sans-serif fallback)

**Character:** Clean, legible, and unopinionated. The typography gets out of the way of the data.

### Hierarchy
- **Display** (600, clamp(2rem, 5vw, 3.5rem), 1.1): Page titles and primary charts.
- **Headline** (500, 20px, 1.3): Section headers and card titles.
- **Body** (400, 14px, 1.5): General interface text and list rows.
- **Label** (500, 12px, 1.4): Metadata and secondary information.

## Layout

Compact and structured. Uses a strict grid to maintain alignment across dense data views, maximizing vertical space for lists.

## Elevation & Depth

No shadows, no gradients, no tonal layering. Depth is established purely through contrast and 0.5px hairline borders separating white cards from the off-white background.

### Named Rules
**The Flat-By-Default Rule.** Shadows and gradients are strictly prohibited. Depth is conveyed via structural borders.

## Shapes

Utilitarian geometric forms. 
- **Cards and Containers:** 8px to 12px rounded corners.
- **Borders:** 0.5px hairlines.

## Components

### Buttons
- **Shape:** 8px radius.
- **Primary:** Blue accent with white text.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** White surface.
- **Border:** 0.5px hairline border.
- **Shadow Strategy:** None.
- **Internal Padding:** 16px.

### Lists
- **Style:** Compact rows with minimal padding to maximize data density. Muted gray secondary text for metadata.

### Navigation
- **Style:** Segmented tabs instead of dropdown menus for faster spatial memory and less interaction overhead.
- **Icons:** Outline style exclusively.

## Do's and Don'ts

### Do:
- **Do** use segmented tabs for view switching.
- **Do** use outline icons for all iconography.
- **Do** keep list rows compact to show more scrobbles at once.
- **Do** use a 0.5px border for dividing content and framing cards.

### Don't:
- **Don't** use any box-shadows or drop-shadows.
- **Don't** use gradients anywhere in the UI.
- **Don't** use dropdown menus for primary navigation or filtering where segmented tabs could fit.

