# User Guide & FAQ in Settings - Design Document

**Date:** 2026-10-24  
**Author:** AI Pair Programmer & Andy  
**Target:** Audio Scrobbler App (Frontend)

---

## 1. Intent and Why

The Audio Scrobbler App has evolved to support powerful features beyond basic Spotify scrobbling: multi-source history imports (Spotify and YouTube JSON), radio show tracklist extraction from BBC Sounds, sharing chart cards, social follows, and copying scrobbles from friends after shared listening sessions (like car journeys or parties).

However, currently the app has no built-in documentation for non-developers or family members. New users who didn't build the app have to guess how background syncing operates, where to find specialized tools, or how to resolve everyday questions (such as sync delays or how to clean up an accidental import).

This project adds a comprehensive **User Guide** and **FAQ** directly into the Settings section, written in friendly, plain English for casual listeners and newcomers.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Self-contained User Guide:** A dedicated tab in Settings (`/settings?tab=guide`) with clear, approachable walkthroughs of the app's features.
- **Interactive, Scannable FAQ:** A dedicated tab in Settings (`/settings?tab=faq`) providing fast answers to common questions, using clean accordion-style cards.
- **Deep Feature Highlights:** Prominently explain key workflows requested by the user:
  1. Everyday app operation and background Spotify sync.
  2. How to scrobble BBC Sounds playlists and radio show tracklists (using the Scope Creep tools in Settings).
  3. How to copy a friend's scrobbles after listening together (e.g. car journeys, parties) via their Profile.
  4. Privacy and curation controls (blocking tracks/artists, clearing artwork, deleting scrobbles).
  5. Data ownership (exporting CSV/JSON, importing past archives).
- **Accessible & Responsive:** Fully responsive on mobile, keyboard accessible, adhering to the project's Flat-By-Default design rules.

### Non-Goals
- Modifying backend APIs, database schemas, or worker tasks (all required endpoints and features already exist).
- Creating a separate external documentation site or public wiki.

### Anti-Goals
- No dense developer jargon, database terminology, or system administration details in the user-facing text.
- No bulky external libraries (no Markdown parsers or heavy accordion dependencies; standard React components and semantic HTML).
- No cluttered single-page layout that overwhelms the existing Settings form.

---

## 3. Constraints & Design System Standards

- **Visual Style (`DESIGN.md`):**
  - "Flat-By-Default" rule: No drop shadows (`box-shadow`), no gradients, no arbitrary rounded blobs.
  - Color tokens only (`var(--color-ink)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-primary)`, `var(--color-muted)`, etc.).
  - Crisp borders (`0.5px solid var(--color-border)`), consistent typography hierarchy.
- **Navigation & URLs:**
  - Accessible via the Settings tab bar alongside General, Views, Scrobble, Data, Notifications, and Danger Zone.
  - Deep-linkable via query parameters: `?tab=guide` and `?tab=faq`.
  - Accessible tab buttons with proper ARIA attributes (`role="tab"`, `aria-selected`, `aria-controls`).
- **Touch & Mobile:**
  - Minimum touch targets (≥ 44px) for accordion headers and navigation links.
  - Legible text with generous spacing on mobile viewports.

---

## 4. Feature Architecture & Decided Approach

### 4.1 Settings Tab Integration
Add two new tabs to `SETTINGS_TABS` in `SettingsPage.jsx`:
```javascript
const SETTINGS_TABS = [
  ['general', 'General'],
  ['views', 'Views'],
  ['scrobble', 'Scrobble'],
  ['data', 'Data'],
  ['notifications', 'Notifications'],
  ['guide', 'User Guide'],
  ['faq', 'FAQ'],
  ['danger', 'Danger Zone'],
]
```
Note: `danger` remains the final tab in red styling.

### 4.2 User Guide Content Breakdown (`UserGuideTab.jsx`)
The guide is structured into logical, sequential chapters with an on-page quick-navigation jump bar:

1. **Welcome & How It Works:**
   - What the app does: your personal listening hub that records your music journey across Spotify, radio, and files.
   - Automatic vs. Manual: what syncs in the background (Spotify listening history, daily liked songs, weekly recaps) vs. what you control manually.
2. **Connecting & Importing:**
   - Connecting your Spotify account securely.
   - Importing past listening history (Spotify extended streaming history and YouTube watch history).
   - What source badges mean on your scrobbles.
3. **Listening with Friends & Copying Scrobbles:**
   - Why it exists: you took a road trip or attended a party where a friend played music on their sound system or in their car, and you want those tracks in your library too.
   - Step-by-step: Go to Following → search/click your friend's profile → click **Copy Scrobbles** → choose start time and end time → confirm.
   - Built-in deduplication: tracks you were already listening to during that window are automatically skipped.
4. **BBC Sounds & Radio Tracklists:**
   - Finding the tool in Settings → Scrobble (`Scope Creep Tools`).
   - How to extract: paste any BBC Sounds episode web link or pick from Followed Shows.
   - Previewing tracks: check track times and resolved album artwork.
   - Two ways to use: Scrobble the tracks into your listening history (with your chosen listen time) or export them directly to a Spotify playlist.
5. **Exploring Your Music & Reports:**
   - Overview: quick stats and Time Capsule / Rediscover cards.
   - Library: browsing by tracks, artists, albums, and genres. List vs. Grid view.
   - Reports: weekly trends, routines heatmap, listening clock, decade breakdown, and compare with friends.
   - Creating shareable chart images to send to friends.
6. **Privacy, Cleanup & Account Controls:**
   - How to block a track or artist (excludes them permanently from stats without wiping play history).
   - How to permanently delete unwanted scrobbles (by source, date range, or import batch).
   - Exporting your complete data anytime (CSV or JSON).

### 4.3 FAQ Content Breakdown (`FaqTab.jsx`)
The FAQ uses clean, accessible accordion elements (`<details>` / `<summary>` styled with flat borders and smooth toggle indicators):

- **Sync & Scrobbles:**
  - *Why don't I see the song I'm playing right this second?* (Explaining 5-minute background polling vs. optional 10-second real-time sync in Settings → Scrobble).
  - *Does the app keep scrobbling if I close the browser?* (Yes! The server polls Spotify independently 24/7).
  - *Why are songs with "(Remastered)" or "[Live]" grouped separately?* (Explain the "Strip remaster tags" option in Settings → Scrobble).
- **Friends & Social:**
  - *How do I scrobble music a friend played in the car or at a party?* (Visit their profile, click "Copy Scrobbles", select the start and end times).
  - *Will copying a friend's scrobbles duplicate songs I already listened to?* (No, existing scrobbles in that window are automatically skipped).
  - *Can other people see my listening history?* (Only users you follow or who follow you, and blocked items are always hidden).
- **BBC Sounds & Radio:**
  - *Can I add BBC Sounds tracks directly to my Spotify playlists?* (Yes, the Scope Creep tool can create a new playlist or append to an existing one).
  - *What does "Followed Shows" do in the radio tool?* (Saves your favorite BBC radio shows so you don't need to hunt down web links for every new episode).
- **Library & Data Maintenance:**
  - *What's the difference between Blocking an artist and Deleting scrobbles?* (Blocking hides from charts/stats; Deleting is permanent removal).
  - *How do I fix missing album artwork?* (Settings → Data → "Backfill Missing Artwork", which safely checks Deezer and iTunes).
  - *Can I download all my listening data?* (Yes, Settings → Data → Export as CSV or JSON).
- **Mobile & Notifications:**
  - *How do I enable device push notifications on iPhone or Android?* (Clear guide for iOS "Add to Home Screen" PWA requirement and Android browser prompt).

---

## 5. What's Left to the Builder

- Creating modular subcomponents in `frontend/src/components/settings/`:
  - `UserGuideSection.jsx`
  - `FaqSection.jsx`
- Styling accordions and guide sections cleanly in `frontend/src/styles.css` using established classes and CSS variables.
- Adding comprehensive unit tests in `SettingsPage.test.jsx` verifying tab switching, deep-linking with `?tab=guide` and `?tab=faq`, and rendering of the guide sections and FAQ accordions.
- Updating `frontend/src/changelogData.js` and bumping package version.
