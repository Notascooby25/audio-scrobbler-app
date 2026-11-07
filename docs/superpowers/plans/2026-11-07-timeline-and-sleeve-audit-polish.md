# Timeline and Sleeve Audit Polish Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the accessibility and responsive design findings from the theme audit across Timeline and Sleeve: refine `prefers-reduced-motion` in Sleeve to preserve essential state feedback, add dedicated `:focus-visible` styling to Sleeve navigation actions, and expand header profile avatar hit targets to at least 44x44px across both themes.

**Architecture:** Refine CSS selectors and hit areas in `frontend/src/skins/sleeve/sleeve.css` and `frontend/src/skins/timeline/timeline.css`, ensure non-interfering click/tap padding, add unit tests in `frontend/src/skins/sleeve/sleeve.test.jsx` and `frontend/src/skins/timeline/timeline.test.jsx`.

**Tech Stack:** React 18, CSS tokens, Vitest, Testing Library.

**Spec:** Impeccable technical audit findings (P1 reduced-motion refinement, P2 focus indicators, P2 44px avatar touch targets).

## Global Constraints
- Strictly preserve design token contract in `tokens.contract.js`.
- Do not affect Retro Jukebox (`RetroJukebox.jsx` and `RetroJukebox.module.css`).
- Keep changes clean, scoped to `[data-skin="sleeve"]` and `[data-skin="timeline"]`.
- Run full frontend verification: `npm run lint && npm test && npm run build`.

## Review Focus
1. Header avatar sizing: avatar visually stays 32px or proportioned inside a 44x44px minimum tap target without breaking header alignment.
2. Reduced motion in Sleeve: avoids killing all transitions globally while disabling heavy animated transforms or spins.
3. Focus outlines: high-contrast `:focus-visible` rings with offset on dark and light surfaces.
4. Mobile navigation: bottom bars remain aligned with safe-area insets.
5. Desktop parity: header actions remain centered and aligned with wordmark.

---

### Task 1: Refine `prefers-reduced-motion` in Sleeve CSS

**Files:**
- Modify: `frontend/src/skins/sleeve/sleeve.css:78-85`
- Test: `frontend/src/skins/sleeve/sleeve.test.jsx`

- [ ] **Step 1: Write test asserting reduced-motion does not blindly wipe all transitions**
- [ ] **Step 2: Update `frontend/src/skins/sleeve/sleeve.css` to target heavy animation rather than `* { transition: none !important }`**
- [ ] **Step 3: Run Vitest to verify tests pass**

---

### Task 2: Add `:focus-visible` states to Sleeve navigation elements

**Files:**
- Modify: `frontend/src/skins/sleeve/sleeve.css`
- Test: `frontend/src/skins/sleeve/sleeve.test.jsx`

- [ ] **Step 1: Write test for `:focus-visible` selectors on `.sleeve-header-bell`, `.sleeve-header-avatar`, and `.sleeve-tab-item`**
- [ ] **Step 2: Add high-contrast `:focus-visible` rules using `var(--color-focus)` and outline offsets**
- [ ] **Step 3: Run Vitest to verify tests pass**

---

### Task 3: Expand header profile avatar touch target to $\ge 44\text{px}$ in Timeline and Sleeve

**Files:**
- Modify: `frontend/src/skins/timeline/timeline.css`
- Modify: `frontend/src/skins/sleeve/sleeve.css`
- Test: `frontend/src/skins/timeline/timeline.test.jsx`
- Test: `frontend/src/skins/sleeve/sleeve.test.jsx`

- [ ] **Step 1: Write tests checking touch targets for `.timeline-header-avatar` and `.sleeve-header-avatar`**
- [ ] **Step 2: Update styles in both skin stylesheets to provide a 44x44px tap target**
- [ ] **Step 3: Run Vitest to verify tests pass**

---

### Task 4: Automated Verification, Changelog and Preview

**Files:**
- Modify: `frontend/src/changelogData.js`
- Modify: `frontend/package.json`

- [ ] **Step 1: Run frontend test suite, lint, and build**
- [ ] **Step 2: Bump version and add changelog entry**
- [ ] **Step 3: Present summary and preview instructions**
