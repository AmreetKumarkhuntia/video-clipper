# SKILL — Video Clipper Design System

How to use this kit when designing or building anything for Video Clipper.

## Load order

Always include the three CSS files in this exact order, before your own styles:

```html
<link rel="stylesheet" href="/path/to/fonts.css" />
<link rel="stylesheet" href="/path/to/tokens.css" />
<link rel="stylesheet" href="/path/to/components.css" />
```

`tokens.css` defines all design tokens as CSS custom properties on `:root` (light) and `[data-theme="dark"]`. `components.css` is built entirely on those tokens — never hard-code colors, spacing, or radii. Reach for a token first.

## Theme switching

Toggle dark mode by setting `data-theme="dark"` on `<html>` (or any ancestor of the surface you want themed).

```js
document.documentElement.dataset.theme = 'dark';
```

There is no system-preference auto-detection in the tokens; build that at the app level (`prefers-color-scheme`) and write the chosen value back to `dataset.theme`.

## Naming

All classes are prefixed `vc-`. Variants use BEM-style modifiers (`vc-btn--primary`). Tokens are prefixed `--vc-`. Don't introduce new prefixes.

## Color rules

- **One accent.** Clay (`--vc-clay-500`) is reserved for the single most important action on a screen, the active segment, the progress fill, and the wordmark dot. Anything more dilutes it.
- **Status soft + status fg.** Status colors come in pairs: `--vc-success` (foreground) + `--vc-success-soft` (background tint). Always pair them.
- **No pure black, no pure white.** Text is `--vc-text` (deep cocoa). Page is `--vc-bg` (cream). On dark, surfaces are warm charcoals.
- **Borders are hairlines.** 1px, `--vc-border` (or `--vc-border-strong` for hover). Never thicker.

## Type rules

- **Display = Source Serif 4.** Use for H1/H2/H3, hero numbers, marketing. 500 weight by default; 600 only for H3 and small display.
- **Body = Inter.** Use for everything functional. 14–16px in app chrome, 17–19px in docs.
- **Mono = JetBrains Mono.** Reserved for _data_ — timestamps, scores, IDs, file paths, code, terminal output. Not for prose.
- Apply `font-feature-settings: "cv11", "ss01"` to body to get Inter's tuned alternates (already on `body` in tokens).

## Spacing rules

- 4px base. Use multiples of 8 for layout (`--vc-space-2` and up). 4px (`--vc-space-1`) only for fine-tuning text/icon alignment.
- Card padding: 24px (`--vc-space-5`) default, 28–32px for hero panels.
- Vertical rhythm between sections: 32–56px.

## Radius

- Inputs, small badges, dense list rows → `--vc-radius-sm` (6).
- Buttons, pills, segment cards → `--vc-radius-md` (10).
- Cards, panels → `--vc-radius-lg` (14).
- Modals, hero surfaces → `--vc-radius-xl` (20).
- Pills only — never fully circular except avatars and dots.

## Iconography

Lucide. 1.5px stroke, round caps + joins. Default 16px in buttons, 20px in toolbars, 24px for large illustrations. Always `currentColor`. Never fill an icon unless it's a status indicator.

## Motion

- 120ms (`--vc-dur-fast`) for hover/press state changes.
- 180ms (`--vc-dur-base`) for entering surfaces.
- 260ms (`--vc-dur-slow`) for modals and panels.
- Always `var(--vc-ease)`. No bounce. Honor `prefers-reduced-motion`.

## Voice

Plainspoken, technical, never breathless. Verbs first in CTAs. Numbers in mono when they're data. See `preview/05-brand.html` for do/don't.

## What to copy first

When designing a new screen, start by copying patterns from:

- **Top bar + URL field** → `app/clipper.html` (see `.topbar`).
- **Segment row** → `app/clipper.html` (see `.segment`).
- **Side panel groups** → `app/clipper.html` (see `.side__group`).
- **Pipeline timeline** → `app/clipper.html` (see `.pipeline`).
- **Form fields** → `preview/04-components.html`.

Don't redesign these. Reuse them.

## What's intentionally not in this kit

- Avatar component (no user system in the product yet).
- Charts/graphs (audio waveform is the only data viz; build it bespoke).
- Page-layout grid utilities (use CSS Grid directly — every screen is bespoke).
- Marketing components (landing page is a separate effort).

If you find yourself reaching for one of these, ask first.
