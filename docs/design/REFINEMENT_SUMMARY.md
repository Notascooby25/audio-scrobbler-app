# Audio Scrobbler App – UI Refinement Summary

**Objective:** Polish the current implementation to fully align with DESIGN.md ("The Focused Utility")  
**Effort:** ~1–2 days (4–6 hours of dev + QA)  
**Impact:** High—fixes core design violations; no feature changes  
**Risk:** Low—purely cosmetic/structural refinements

---

## Five Refinements at a Glance

| # | Issue | Current | Target | Files |
|---|-------|---------|--------|-------|
| 1 | Range filter buttons | All styled blue | Only active button blue | IMPLEMENTATION_PROMPTS.md, Prompt 2 |
| 2 | List row height | 80px (4–5 items visible) | 64px (8–10 items visible) | IMPLEMENTATION_PROMPTS.md, Prompt 1 |
| 3 | Form label case | UPPERCASE + tracking | Regular case, no yelling | IMPLEMENTATION_PROMPTS.md, Prompt 3 |
| 4 | Card borders | Inconsistent/missing | 0.5px #E5E5E5 everywhere | IMPLEMENTATION_PROMPTS.md, Prompt 4 |
| 5 | Text color | Possibly #222–#333 | Explicitly #111111 | IMPLEMENTATION_PROMPTS.md, Prompt 5 |

---

## Why These Matter

**Issue 1: Range Filters**  
Violates "The One Voice Rule" (≤5% blue per DESIGN.md). Currently looks chaotic; active state is unclear. Fix makes hierarchy instantly obvious.

**Issue 2: List Rows**  
Data density (core to "Focused Utility") is wasted. Compressing 64px saves ~20 vertical pixels per row = 8–10 items visible instead of 4–5. Massive UX win.

**Issue 3: Form Labels**  
All-caps labels feel like errors/warnings, not guidance. Looks unprofessional vs. Linear/Notion. Lowercase labels feel modern and restrained.

**Issue 4: Card Borders**  
Per DESIGN.md: "depth via borders only, no shadows." Missing/inconsistent borders break this rule. Every white container needs 0.5px #E5E5E5.

**Issue 5: Text Color**  
If primary text is softer than #111111, it reads as uncertain. Crisp #111111 on off-white (#F7F7F7) background feels sharp and confident.

---

## How to Use These Documents

### For Design Review:
1. Read **REFINEMENT_BRIEF.md** (current state → target state for each issue)
2. Review screenshots (Images 1–17 in project folder)
3. Confirm fix direction before dev starts

### For Implementation:
1. Read **IMPLEMENTATION_PROMPTS.md** (step-by-step, Impeccable-style)
2. Execute Prompt 2 → Prompt 4 → Prompt 1 → Prompt 3 → Prompt 5 (in priority order)
3. Screenshot after each; compare to originals
4. Use "Acceptance" sections as QA checklists

### For QA/Sign-Off:
1. Run through visual inspection checklist below
2. Test desktop (1440px) + mobile (375px)
3. Verify acceptance criteria from IMPLEMENTATION_PROMPTS.md
4. Confirm no new issues introduced

---

## Quick Acceptance Checklist

**Desktop (1440px):**
- [ ] Range filter buttons: only ONE is blue; others are gray text on transparent
- [ ] Library rows: 8–10 items fit on screen without scroll
- [ ] Settings form: labels are lowercase, inputs are 36px tall, no uppercase anywhere
- [ ] All cards have visible 0.5px gray border
- [ ] Primary text is crisp/dark, not soft/light
- [ ] No shadows, gradients, or colored overlays visible

**Mobile (375px):**
- [ ] Range buttons stack or scroll horizontally; active state clear
- [ ] List rows compress but remain readable (title, subtitle, count visible)
- [ ] Settings form full-width, inputs don't overflow
- [ ] Card borders visible and consistent
- [ ] Text remains legible on smaller screen

**Code Quality:**
- [ ] No `box-shadow` or `filter: drop-shadow` in CSS (except focus rings)
- [ ] No `linear-gradient` or `radial-gradient` in CSS
- [ ] All text color set to #111111 (primary) or #888888 (secondary)
- [ ] No hardcoded colors; using design tokens from DESIGN.md

---

## Expected Visual Improvements

| Before | After |
|--------|-------|
| 4–5 library rows visible | 8–10 library rows visible |
| 6+ blue elements per screen | 1–2 blue elements per screen |
| "LOUD LABELS" in settings | Quiet, readable form labels |
| Some cards with borders, some without | Every card has consistent border |
| Text may appear soft or grayed | Text appears crisp and confident |

---

## Timeline

**Phase 1: Range Filters (Prompt 2)**  
⏱ 30 min dev + 10 min QA  
🎯 Quick visual win; build momentum

**Phase 2: Card Borders Audit (Prompt 4)**  
⏱ 45 min dev (systematic codebase sweep) + 15 min QA  
🎯 Affects many surfaces; high impact

**Phase 3: List Row Density (Prompt 1)**  
⏱ 1 hour dev (layout tweaks across 5 tabs) + 20 min QA  
🎯 Most visible improvement to core interface

**Phase 4: Form Labels (Prompt 3)**  
⏱ 30 min dev + 10 min QA  
🎯 Settings page only; straightforward

**Phase 5: Text Color Audit (Prompt 5)**  
⏱ 20 min dev + 10 min QA  
🎯 Verification pass; quick confirm-or-fix

**Total:** ~4.5 hours dev, ~1.5 hours QA = ~6 hours end-to-end

---

## Related Documents

- **REFINEMENT_BRIEF.md** – Deep dive into each issue; target state + code samples
- **IMPLEMENTATION_PROMPTS.md** – Step-by-step Impeccable-style prompts for implementation
- **DESIGN.md** – The design system being enforced (existing)
- **PRODUCT.md** – Product context (existing)

---

## Success Criteria

After all five refinements are complete:

✅ Design aligns perfectly with DESIGN.md ("The Focused Utility")  
✅ Zero design violations (no shadows, gradients, or overused blue)  
✅ Data density maximized (8–10 rows visible on desktop)  
✅ Typography hierarchy is clear and restrained  
✅ Visual consistency across all surfaces  
✅ Mobile + desktop variants pass inspection  
✅ WCAG AA contrast verified  
✅ Ready to commit and ship

---

## Questions?

Refer to:
- **"Why is this wrong?"** → REFINEMENT_BRIEF.md, "Current State" section
- **"How do I fix it?"** → IMPLEMENTATION_PROMPTS.md, relevant Prompt
- **"What should it look like?"** → REFINEMENT_BRIEF.md, "Target State" section
- **"How do I know I'm done?"** → IMPLEMENTATION_PROMPTS.md, "Acceptance" section
