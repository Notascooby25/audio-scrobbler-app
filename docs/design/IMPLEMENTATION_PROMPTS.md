# Implementation Prompts for Audio Scrobbler App Refinements

These prompts are structured as Impeccable commands for your development workflow.

---

## Prompt 1: Layout Refinement – List Row Density

**Command:** `impeccable layout library-rows`

**Full Prompt:**

```
Refinement: Compress list row height in Library view (all tabs: Scrobbles, Artists, Albums, Tracks, Liked Tracks).

Current state:
- Library rows show artwork (56px) + title + subtitle + count
- Row height ~80px; only 4-5 items visible on desktop
- Internal padding top/bottom 12px, left/right inconsistent

Target state per DESIGN.md "Focused Utility":
- Compress to 64px row height
- Artwork: 48×48px (square, 4px border-radius)
- Internal padding: 8px top/bottom, 12px left/right
- Gap between image + text: 12px
- Title (headline 20px, 500, #111111) + Subtitle (label 12px, #888888)
- Count right-aligned (12px, 500, #888888)

Acceptance:
✓ 8–10 rows visible on desktop without scroll
✓ Image + text remain legible
✓ Desktop + mobile variants match
✓ No shadows, borders only (#E5E5E5 0.5px between rows)
✓ Baseline vertical rhythm: 8px increments
```

---

## Prompt 2: Clarify – Range Filter Button Hierarchy

**Command:** `impeccable clarify range-filters`

**Full Prompt:**

```
Refinement: Fix range filter button styling to obey "The One Voice Rule" (≤5% blue accent per DESIGN.md).

Current state:
- Range buttons (Last week, Last month, Last year, Custom range) styled with blue background
- All buttons appear equally active; visual hierarchy is broken
- Violates One Voice Rule by overusing #0066FF

Target state:
- **Inactive buttons:** transparent background, gray text (#888888), 8px radius container
- **Active button only:** blue background (#0066FF), white text, 8px radius
- Hover feedback: inactive buttons → light gray bg (#F0F0F0) on hover (no emphasis, just feedback)
- Typography: remain uppercase label style (0.75rem, 700, 0.12em tracking)

Visual behavior:
- User sees ONE blue button (active filter) = clear affordance
- Other buttons fade to text-only = low visual weight
- Clicking changes active state; previous active returns to gray text

Acceptance:
✓ Only one button per range-filter group is blue at any time
✓ Inactive buttons are text only (transparent bg, gray text)
✓ Active state contrast meets WCAG AA
✓ Mobile variant: buttons stack or scroll horizontally, active state remains clear
✓ Hover state visible but restrained (light gray, no blue bleed)
```

---

## Prompt 3: Clarify – Settings Form Label Typography

**Command:** `impeccable clarify settings-form-labels`

**Full Prompt:**

```
Refinement: De-emphasize form labels in Settings page to match productivity tool aesthetic (Linear, Notion, iOS Settings).

Current state:
- All form labels styled as UPPERCASE with 0.12em letter-spacing
- Creates visual noise; inconsistent with "Focused Utility" restraint
- Labels feel like shouts, not guidance

Target state per DESIGN.md:
- Form labels: regular sentence case, 500 weight, 12px, normal tracking
- Color: text-primary (#111111)
- Line-height: 1.4
- Gap label→input: 4px (tight coupling)

Apply to all Settings form fields:
- DEFAULT DATE RANGE → Default date range
- DEFAULT PAGE SIZE → Default page size
- DEFAULT LIBRARY VIEW → Default library view
- SCROBBLES VIEW → Scrobbles view
- ARTISTS VIEW → Artists view
- ALBUMS VIEW → Albums view
- TRACKS VIEW → Tracks view
- LIKED TRACKS VIEW → Liked tracks view

Input styling:
- Height: 36px
- Padding: 8px 12px
- Border: 0.5px solid #E5E5E5
- Border-radius: 8px
- No shadows
- Focus state: blue border (#0066FF) + subtle blue shadow (0 0 0 2px rgba(0,102,255,0.1))

Acceptance:
✓ No uppercase form labels anywhere
✓ Labels feel subtle, not dominant
✓ Input fields clear and compact
✓ Focus state provides blue affordance (matches button style)
✓ Full form visible on mobile without excessive scrolling
```

---

## Prompt 4: Polish – Card Border Consistency Audit

**Command:** `impeccable polish card-borders`

**Full Prompt:**

```
Refinement: Audit and standardize card borders across all surfaces (Library, Reports, Settings, Connect, Profile).

Current state:
- Some cards have visible 0.5px borders, others don't
- Background/border combination inconsistent
- Violates "Flat-By-Default Rule": depth via borders only, no shadows

Target state per DESIGN.md:
Every card container must follow this exact pattern:
- Background: #FFFFFF (white)
- Border: 0.5px solid #E5E5E5 (hairline)
- Border-radius: 12px
- Padding: 16px
- NO box-shadows anywhere
- NO gradients
- NO tonal layering

Surfaces to audit and fix:
1. Library view:
   - Scrobbles list container ✓
   - Artists list container ✓
   - Albums list container ✓
   - Tracks list container ✓
   - Liked tracks list container ✓
   - Chart containers ✓

2. Reports view:
   - Top-level report card ✓
   - "Scrobbles over time" chart card ✓
   - "Listening clock" card ✓
   - Artist/Album/Track list cards ✓
   - "Coming soon" placeholder cards ✓

3. Settings view:
   - Settings form container ✓

4. Connect/Profile view:
   - Profile card ✓
   - Monthly summary cards ✓
   - Any other content card ✓

CSS standard:
.card { background: #FFFFFF; border: 0.5px solid #E5E5E5; border-radius: 12px; padding: 16px; }

Acceptance:
✓ Every white container has the 0.5px #E5E5E5 border
✓ Zero shadows, zero gradients checked via automated scan
✓ Border-radius consistent (12px on cards, 8px on smaller elements like buttons/inputs)
✓ No color bleed or transparency tricks
✓ Desktop + mobile screenshots pass visual inspection
```

---

## Prompt 5: Polish – Primary Text Color Verification

**Command:** `impeccable polish text-contrast`

**Full Prompt:**

```
Refinement: Verify primary text color is #111111; confirm WCAG AA contrast on all backgrounds.

Current state:
- Primary text may be rendering as #222 or #333 (softer than design spec)
- Contrast on off-white background (#F7F7F7) not formally verified

Target state:
- All body text, headings, labels explicitly set to #111111 (deep black)
- WCAG AA contrast verified:
  - #111111 on #FFFFFF = 18.1:1 ✓ (excellent)
  - #111111 on #F7F7F7 (off-white bg) = 17.8:1 ✓ (excellent)
  - #111111 on any white/gray surface = pass

CSS audit:
- body text (14px): color #111111
- headlines (20px+): color #111111
- labels (12px): color #111111 (or #888888 for secondary)
- inputs text: color #111111
- buttons white text: color #FFFFFF

Acceptance:
✓ All primary text explicitly color: #111111
✓ WCAG AA contrast checker shows ≥4.5:1 everywhere
✓ Visual inspection on off-white background shows crisp, not soft, text
✓ Screenshot comparison: text darker/sharper than current
```

---

## Execution Order

Run in this sequence to build momentum:

1. **Prompt 2 (Clarify range filters)** ← Quick win, high visibility
2. **Prompt 4 (Polish card borders)** ← Systematic, affects many surfaces
3. **Prompt 1 (Layout list rows)** ← Requires layout tweaks, affects multiple tabs
4. **Prompt 3 (Clarify form labels)** ← Settings only, moderate scope
5. **Prompt 5 (Polish text color)** ← Verification pass, low risk

---

## Testing After Each Refinement

### Visual Inspection
- Desktop (1440px) screenshot of each affected surface
- Mobile (375px) screenshot of each affected surface
- Side-by-side comparison with original to confirm improvement

### Automated Checks (if tooling available)
- Contrast: WCAG AA minimum 4.5:1
- Color count: verify blue (#0066FF) appears ≤5% of screen
- No shadows: grep CSS for `box-shadow`, `drop-shadow`, `filter:` (shadow functions)
- No gradients: grep CSS for `linear-gradient`, `radial-gradient`, `conic-gradient`

### Manual Checks
- ✓ Range filters: only ONE button blue at a time
- ✓ List rows: 8–10 items fit on desktop
- ✓ Settings: form labels are lowercase, inputs are compact
- ✓ Cards: all white containers have 0.5px border
- ✓ Text: primary text feels crisp, not soft

---

## Notes

- These prompts assume React/CSS codebase; adjust syntax for your stack
- "Acceptance" sections double as QA checklists
- If implementing incrementally, commit after each prompt for easy rollback
- Screenshots before/after each step help demonstrate impact
