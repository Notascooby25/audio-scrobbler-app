# Refinement Brief: Audio Scrobbler App UI Polish

**Target:** Focused refinement pass to align current implementation with DESIGN.md ("The Focused Utility")  
**Scope:** Range filter buttons, list row density, form typography, card borders  
**Mode:** Operate (task completion, data density, clarity)

---

## Issue 1: Range Filter Buttons Are Too Loud

### Current State
- All range buttons (Last week, Last month, Last year, Custom range) are styled identically to active tab
- Blue accent is used for inactive states, violating "The One Voice Rule" (≤5% of screen)
- User cannot distinguish which filter is active without careful inspection

### Target State
- **Inactive buttons:** Transparent background, gray text (#888888), no border, baseline weight
- **Active button:** Blue background (#0066FF), white text, same 8px radius
- **Custom range button:** Secondary action—only filled when selected; otherwise quiet text link style
- Visual hierarchy: active state pops; inactive fades into background

### Fix Strategy
**Layout:** Keep horizontal button bar, no layout changes  
**Typography:** Buttons remain uppercase label style (0.75rem, 700, 0.12em tracking)  
**Colors:** 
- Inactive: text-secondary (#888888) on transparent
- Active: white (#FFFFFF) on primary (#0066FF)
- Hover: inactive → light gray background (#F0F0F0) on hover (feedback, not emphasis)

**Code guidance:**
```css
.range-button {
  background: transparent;
  color: #888888;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.range-button:hover {
  background-color: #F0F0F0;
}

.range-button.active {
  background-color: #0066FF;
  color: #FFFFFF;
  border-radius: 8px;
}
```

---

## Issue 2: List Row Height Too Tall (Albums, Artists, Tracks)

### Current State
- Album/Artist/Track rows in Library grid show: artwork + title + subtitle + count
- Excess padding above/below creates vertical waste
- On desktop, only ~4–5 items visible without scroll; should fit 8–10

### Target State
- Compress row height from ~80px to ~64px
- Maintain image clarity (square artwork at 48px)
- Reduce padding: top/bottom from 12px to 8px
- Title (headline) + subtitle (label) remain readable
- Count badge right-aligned, no extra margin

### Fix Strategy
**Spacing:**
- Card padding: 16px (unchanged)
- Row internal padding: 8px top/bottom (was ~12px), 12px left/right
- Image size: 48×48px (was likely 56px or larger)
- Gap between image + text: 12px

**Typography:**
- Title: headline (500, 20px) → no change
- Subtitle: label (500, 12px) → no change
- Count: label (500, 12px) in secondary text (#888888)

**Code guidance:**
```css
.library-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 12px;
  border-bottom: 1px solid #E5E5E5;
}

.library-row:last-child {
  border-bottom: none;
}

.library-row-image {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  flex-shrink: 0;
}

.library-row-content {
  flex: 1;
  min-width: 0; /* enable text truncation */
}

.library-row-title {
  font-size: 14px;
  font-weight: 500;
  color: #111111;
  line-height: 1.3;
}

.library-row-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #888888;
  line-height: 1.3;
}

.library-row-count {
  font-size: 12px;
  font-weight: 500;
  color: #888888;
  white-space: nowrap;
  margin-left: 8px;
}
```

---

## Issue 3: Settings Form Labels Are Over-Styled

### Current State
- All form labels use uppercase + wide letter-spacing (LABEL style)
- This creates visual noise inconsistent with productivity tools (Linear, Notion, iOS Settings)
- Should feel restrained, not shouted

### Target State
- Form labels: regular label style (500, 12px, no uppercase, normal tracking)
- Optional indicator "(optional)" in small, secondary text when needed
- Label sits directly above input with 4px gap

### Fix Strategy
**Typography:**
- Change label from uppercase with tracking to: 500, 12px, normal case, normal tracking
- Color: text-primary (#111111)
- Line-height: 1.4

**Spacing:**
- Label to input gap: 4px
- Input height: 36px
- Input padding: 8px 12px

**Code guidance:**
```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: #111111;
  line-height: 1.4;
  text-transform: none; /* Remove uppercase */
  letter-spacing: normal;
}

.form-label-optional {
  color: #888888;
  font-weight: 400;
}

.form-input,
.form-select {
  padding: 8px 12px;
  height: 36px;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  background-color: #FFFFFF;
  color: #111111;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #0066FF;
  box-shadow: 0 0 0 2px rgba(0, 102, 255, 0.1);
}
```

---

## Issue 4: Card Borders Inconsistent or Missing

### Current State
- Some card containers have visible borders, others don't
- Creates visual ambiguity about where content boundaries lie
- Violates "Flat-By-Default Rule" (no shadows, depth via borders only)

### Target State
- **Every card container** gets 0.5px hairline border (#E5E5E5)
- Background: white (#FFFFFF)
- Padding: 16px
- Border-radius: 12px
- No shadows anywhere

### Fix Strategy
**CSS Standard:**
```css
.card {
  background-color: #FFFFFF;
  border: 0.5px solid #E5E5E5;
  border-radius: 12px;
  padding: 16px;
}
```

**Audit checklist:**
- Library view cards (Scrobbles, Albums, Tracks lists) ✓
- Report cards (Scrobbles over time, Listening clock, artist/album/track lists) ✓
- Profile card (user info, stats) ✓
- Settings form card ✓
- Connect page cards ✓

---

## Issue 5: Text Color Contrast—Verify #111111

### Current State
- Primary text may be rendering as #333 or #222 (softer than spec)
- On off-white background (#F7F7F7), should feel sharp, not muted

### Target State
- **Verify actual rendered color is #111111** (deep black)
- Update CSS if necessary
- Test on off-white + white backgrounds for sufficient contrast

### Fix Strategy
- Add explicit color rule: `color: #111111;` on all body text
- Run WCAG contrast checker: #111111 on #FFFFFF = 18.1:1 ✓
- Run WCAG contrast checker: #111111 on #F7F7F7 = 17.8:1 ✓

---

## Implementation Priority

1. **High impact, low effort:**
   - Range filter buttons (Issue 1) — visual clarity improves immediately
   - Card borders audit (Issue 4) — simple to apply across codebase

2. **Medium impact, medium effort:**
   - List row density (Issue 2) — affects multiple surfaces, requires layout tweaks
   - Form label typography (Issue 3) — Settings page only, straightforward

3. **Verification:**
   - Text color audit (Issue 5) — quick check, low risk

---

## Acceptance Criteria

✓ Range filter buttons follow "One Voice Rule" (active state only uses blue)  
✓ Library rows compress to fit 8–10 items on desktop without scroll  
✓ Settings form labels use regular case, no uppercase  
✓ Every card has 0.5px #E5E5E5 border  
✓ Primary text is #111111, passes WCAG AA contrast  
✓ Desktop + mobile (thin) variants both pass visual inspection  
✓ No shadows, gradients, or tonal layering anywhere  

---

## Related Screenshots
- Image 1: Library overview (range filters, list rows)
- Image 2: Library with range open (range button styling)
- Image 3: Settings (form label typography)
- Image 4: Settings full (form labels, inputs)
- Image 5–8: Library tabs (range filters, list rows)
- Image 9: Connect page (card consistency)
- Image 13: Reports (card borders, lists)
- Image 14–17: Library variants (row density, card styling)
