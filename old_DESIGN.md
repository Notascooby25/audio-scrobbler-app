---
name: Audio Scrobbler App (Legacy)
description: A self-hosted, full-stack application for tracking, analyzing, and sharing your music listening history.
colors:
  primary: "#a34e32"
  focus: "#46624d"
  neutral-bg: "#efe9dd"
  surface: "#fffdf8"
  surface-raised: "#ffffff"
  border: "#dce2d9"
  text-primary: "#18211d"
  text-secondary: "#657268"
typography:
  display:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "clamp(2.8rem, 7vw, 5.8rem)"
    fontWeight: 500
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "2.2rem"
    fontWeight: 500
    letterSpacing: "-0.03em"
  body:
    fontFamily: "'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fffaf1"
    rounded: "{rounded.sm}"
    padding: "0.75rem 1rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "1.25rem"
---

# Design System: Audio Scrobbler App (Legacy)

## Overview

**Creative North Star: "The Warm Utility"**

An inviting, organic interface defined by warm earthy tones and functional structure. The aesthetic relies on natural color pairings (terracotta and sage), soft ambient shadows, and legible sans-serif typography. Overall, the component execution feels somewhat uninspiring, serving as a functional wrapper rather than a distinct design statement.

## Colors

An earthy, botanical palette contrasting warm accents against cool, muted neutrals.

### Primary
- **Terracotta Rust** (#a34e32): The singular action color, used for primary buttons, active links, and chart peaks.
- **Forest Focus** (#46624d): Used for secondary interactive elements, focus rings, and topbar navigation.

### Neutral
- **Cream Background** (#efe9dd): The base canvas, overlaid with a soft radial/linear gradient.
- **Warm Surface** (#fffdf8): The default card and container background.
- **Bright Surface** (#ffffff): Elevated floating panels and raised cards.
- **Sage Border** (#dce2d9): Soft, low-contrast structural dividers.
- **Deep Forest Black** (#18211d): High-contrast primary text.
- **Slate Green** (#657268): Muted metadata and secondary copy.

**The Organic Canvas Rule.** Backgrounds and surfaces avoid pure white and stark gray, leaning entirely on warm, paper-like creams and botanical greens.

## Typography

**Display Font:** Avenir Next (with Segoe UI fallback)
**Body Font:** Avenir Next (with Segoe UI fallback)
**Label Font:** System UI
**Input Font:** Georgia (Serif)

**Character:** Friendly and legible, mixing a modern geometric sans with surprising serif moments in inputs.

### Hierarchy
- **Display** (500, clamp(2.8rem, 7vw, 5.8rem), 0.94): Hero sections and major dashboard numbers. Tightly tracked (-0.04em).
- **Headline** (500, 2.2rem, 1.2): Section headers and report banners.
- **Title** (500, 1.35rem, 1.3): Card titles and panel headers.
- **Body** (400, 0.85rem, 1.5): Standard list rows and descriptive text.
- **Label** (700, 0.75rem, 1.1, uppercase): Eyebrows, kickers, and table headers. Widely tracked (0.12em).

## Layout

A centered max-width container (1180px) with generous clamping padding. Content frequently organizes into 3-column grids on desktop, collapsing to single columns on mobile.

## Elevation & Depth

Layered and soft. The system uses large, diffuse drop shadows to lift major containers off the background gradient, creating a tactile, floating feel.

### Shadow Vocabulary
- **Ambient Container** (`box-shadow: 0 18px 45px rgba(24, 33, 29, 0.07)`): The main dashboard wrapper.
- **Hover Lift** (`box-shadow: 0 10px 28px rgba(24, 33, 29, 0.08)`): Interactive report cards on hover.

## Shapes

Soft, friendly corners paired with strict list dividers.
- **Main Containers:** 14px radius (dashboard).
- **Standard Cards:** 12px radius.
- **Buttons & Small Panels:** 8px radius.
- **Badges / Tags:** Fully rounded pill shapes (999px).

## Components

The component execution is functional but uninspiring, relying on standard HTML primitives with soft styling.

### Buttons
- **Shape:** 8px radius.
- **Primary:** Terracotta background with uppercase cream text.
- **Hover:** Brightness filter (1.08x) rather than a color swap.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Warm cream.
- **Border:** 1px sage green.
- **Shadow Strategy:** Hover lift on interactive cards.

### Inputs / Fields
- **Style:** Square corners (0 radius), sage border, cream background.
- **Typography:** Uniquely uses Georgia serif.
- **Focus:** 2px Forest Focus outline with offset.

### Navigation
- **Style:** Text links that gain a terracotta background when active. 

## Do's and Don'ts

### Do:
- **Do** use uppercase, tracked-out text for kickers and small labels.
- **Do** use the terracotta accent for primary actions and highlights.

### Don't:
- **Don't** use pure black (#000000) for text; always use Deep Forest Black.
- **Don't** use sharp corners on cards or buttons (inputs are the exception).

