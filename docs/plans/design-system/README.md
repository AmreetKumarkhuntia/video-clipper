# Video Clipper — Design System

A calm, considered design system for **@thunderkiller/video-clipper** — a TypeScript CLI + Svelte web app that analyzes YouTube videos with an LLM, finds the most interesting moments, and cuts clips automatically.

The system is rooted in the existing repo's layout (positioning preserved) but modernizes buttons, colors, typography, and surfaces. Tone is **Claude-like**: warm cream surfaces, clay-orange accent, considered serif display + clean sans body, generous whitespace.

---

## CONTENT FUNDAMENTALS

**Voice.** Plainspoken, technical-when-needed, never breathless. We talk to people who already understand video pipelines, LLMs, and ffmpeg. We don't shout. We explain.

- **Do:** "Analyzing transcript chunks." "Top 10 segments, ranked by score."
- **Don't:** "✨ AI magic happening!" "Discover the BEST moments instantly!"

**Copy patterns.**

- Buttons: verbs first — `Analyze`, `Cut clips`, `Download`, `Cancel run`.
- Empty states: state the next action — "Paste a YouTube URL to begin."
- Errors: name the cause, then the recovery — "yt-dlp returned 403. Add cookies in Settings → Auth."
- Numbers: monospace where they're data (timestamps, scores, durations); proportional where they're prose.
- Timestamps: always `mm:ss` or `hh:mm:ss`, never decimal seconds in UI (use `02:14`, not `134.0s`).

**Naming.** Product is **Video Clipper** (wordmark only, no glyph). Package is `@thunderkiller/video-clipper`. Use the wordmark in product UI; reserve the package name for docs/CLI.

---

## VISUAL FOUNDATIONS

**Surfaces.** Layered cream tones. The page background is the warmest; cards lift slightly cooler/lighter; chrome (toolbars, sidebars) sits a half-step deeper. Borders are hairlines in a soft cocoa, never pure black.

**Color philosophy.**

- One accent — **clay** (warm orange) — used sparingly for the primary CTA, the active segment, and progress.
- Neutrals do most of the work. Text is deep cocoa, not black.
- Status colors (success/warn/error) are muted, not saturated; they sit comfortably next to the cream palette.
- Dark mode is a true rethink — not an inverted light theme. Backgrounds are warm charcoal; the clay accent stays the same hue but lifts in luminance.

**Typography.**

- **Display:** _Tiempos Headline_ (web fallback: _Source Serif 4_) — used for page H1, hero numbers, marketing.
- **Body / UI:** _Inter_ tuned with `font-feature-settings: 'cv11', 'ss01'` — used for everything else.
- **Mono:** _JetBrains Mono_ — timestamps, scores, code, segment IDs.
- Body sits at 15–16px in app chrome, 17–19px in docs and marketing. Display is sized confidently — H1 starts at 44–56px.

**Spacing.** 4px base. The system steps in 4 → 8 → 12 → 16 → 24 → 32 → 48 → 64 → 96. Use multiples of 8 for layout; 4 only for fine-tuning text/icon alignment.

**Radius.** 6px (inputs, small cards), 10px (buttons, pills), 14px (cards), 20px (modals, hero panels). Never sharp corners; never fully circular except avatars and dot indicators.

**Elevation.** Three levels — 0 (flush), 1 (lift, for cards on hover and dropdowns), 2 (modals, command palette). Shadows are warm and soft (cocoa @ 6–10% alpha), never blue.

**Motion.** 150ms / `cubic-bezier(0.2, 0, 0, 1)` for state transitions. 220ms for entering surfaces. Never bounce. Reduce motion respected.

---

## ICONOGRAPHY

**Lucide**, 1.5px stroke, 20px default size in UI (16px in dense lists, 24px in toolbars). Round line caps, round line joins. Icons are `currentColor` and inherit from text. Never fill an icon unless it's a status indicator (recording dot, success check on completed clip).

Common icons in this product: `link`, `play`, `pause`, `scissors`, `download`, `clock`, `sparkles` (for LLM action — used sparingly), `gauge` (score), `settings-2`, `terminal`, `volume-2`, `chevron-down`, `x`, `check`, `loader-2`.

---

## STRUCTURE

```
.
├── README.md                  ← this file
├── tokens.css                 ← color + type + spacing tokens (light + dark)
├── fonts.css                  ← @font-face / @import for Inter, Source Serif, JetBrains
├── components.css             ← button, input, card, badge, etc. styles
├── preview/
│   ├── 01-type.html           ← typography specimen
│   ├── 02-colors.html         ← palette + status
│   ├── 03-spacing.html        ← spacing, radius, elevation
│   ├── 04-components.html     ← buttons, inputs, cards, dropdowns, toasts
│   └── 05-brand.html          ← wordmark + voice
├── app/
│   └── clipper.html           ← full app screen (URL → analyze → segments → clips)
└── SKILL.md                   ← how to use this system
```
