# Product Guidelines: Clash Tracker

How Clash Tracker should look, feel, and behave. These are binding constraints for every
track — UI work must conform, and reviewers should check against them.

## Brand & visual identity

- **Clash of Clans theme.** Follow the game's warm, chunky, "gold-on-wood" aesthetic:
  earthy browns, parchment/stone panels, gold accents, with stars (gold attack stars) and
  red/green for enemy/friendly framing. Use the game's bold, slightly rounded display
  styling for headings.
- **Clan identity is dynamic.** The clan **name** is owner-configurable and appears in the
  header on every view. Never hard-code it. (The header also shows a generic default crest;
  a configurable per-clan logo is intentionally not supported — single-clan app.)
- **Tasteful, not a clone.** Modern, clean, legible — inspired by CoC, not a pixel copy.
  Readability and contrast win over decoration.

### Theme tokens

Define colors, fonts, spacing, and radii as **CSS custom properties** in one global theme
file. Components reference tokens (`var(--ct-gold)`), never raw hex. This keeps theming
consistent and adjustable in one place.

## Mobile-first & responsive

- **Design for ~360–430px width first**, then enhance for tablet/desktop.
- **Touch targets ≥ 44×44px.** Generous spacing; no hover-only interactions.
- **One primary action per view** on mobile; avoid dense control clusters.
- Desktop reuses the same components and the **same swipe animation** — do not fork
  desktop-specific navigation behavior.

## Navigation & motion

- **Swipe between views** is the primary navigation on mobile; tapping a nav target also
  works but still animates as a swipe (shared behavior on desktop).
- **Natural swipe physics:**
  - If the user drags **slower than 250ms**, the view follows the finger 1:1 and settles
    based on drag distance/velocity.
  - If the user **flicks quickly (faster than 250ms)**, complete the view change within
    **250ms**.
- **Eager data loading.** Start loading the target view's data **the moment a swipe
  begins** — not after the animation ends — so content is ready as early as possible.
- Respect `prefers-reduced-motion`: degrade to a simple cross-fade / instant change.

## PWA requirements

- Installable (valid manifest, icons, theme color), works **offline** for already-loaded,
  read-only data, and uses a service worker (`vite-plugin-pwa` / Workbox).
- App-like: standalone display, no browser chrome, splash screen with clan branding.

## Interaction & feedback

- **Instant-save controls** (the two threshold sliders) persist on change with no separate
  Save button; show a subtle saved/in-flight indicator. Other owner settings (clan name,
  token, clan tag) use **explicit Save buttons** as specified.
- Show clear **loading**, **empty**, and **error** states for every data view. Never a
  blank screen.
- The Player List **qualification line** must be unmistakable: a visible divider plus a
  subtle but clear styling difference between above-the-line and below-the-line players.
- Always surface **sync status** on war-related views ("Synced with game" vs "Out of sync").

## Accessibility

- Meet **WCAG AA** contrast against the themed backgrounds.
- Full keyboard operability on desktop; visible focus states.
- Semantic HTML and ARIA where needed; screen-reader-friendly labels for icon-only controls.
- Don't rely on color alone for the qualification line — pair it with an icon/label.

## Content & voice

- Plain, friendly, clan-mate tone. Short labels. Use CoC vocabulary the clan already knows
  (TH, stars, attacks, war, CWL, Co-Leader).
- Numbers are the message: make stats scannable (right-aligned figures, clear units like
  `%` and `★`).

## Privacy & trust

- Only public-safe data reaches the browser. The CoC API token is **never** loaded into the
  client, shown in the UI, or logged.
- Be explicit when showing data about **players who have left** (admin-only, clearly
  labeled).

## Definition of "good" for a UI task

- Looks right on a phone first, then scales up.
- Uses theme tokens, not hardcoded styles.
- Has loading/empty/error states.
- Keyboard- and screen-reader-accessible.
- Animations honor the 250ms swipe rule and `prefers-reduced-motion`.
- No secret or non-public data is fetched into the client.
