# Phase 1 — Foundation: design system, app shell, icons

> **Parent plan:** [design.md](./design.md)
> **Covers:** §4.1 vendor design system · §4.2 app shell & theme toggle · §4.6 icons
> **Blast radius:** global — touches `style/`, `+layout.svelte`, adds the icon module. No route bodies change yet.

---

## Goal

Lay down the substrate every later phase depends on:

- Bundle's design tokens, fonts, and component primitives are vendored under [src/app/web/style/](../../src/app/web/style/).
- The global topbar matches the bundle (brand wordmark, status chip, theme toggle).
- A `theme` store persists `light`/`dark` to `localStorage` and writes `data-theme` on `<html>`.
- An icon module is in place so subsequent phases can use `Icons.Check`, `Icons.Loader`, `Icons.Sun`, etc.

After this phase, every existing route still renders and behaves the same — but now sits on the clay-cream palette and toggles light/dark from the topbar.

---

## Steps

### 1.1 Vendor the design system

Create:

```
src/app/web/style/ds/
  ├── tokens.css        ← copy of design-reference/project/ds/tokens.css
  ├── fonts.css         ← copy of design-reference/project/ds/fonts.css (Google Fonts import)
  └── components.css    ← copy of design-reference/project/ds/components.css

src/app/web/style/screens.css    ← trimmed copy of design-reference/project/screens.css
```

Trim canvas-only selectors out of `screens.css` (`.artboard-host`, `.canvas-banner`, etc.) — keep the rest.

Update [src/app/web/style/index.css](../../src/app/web/style/index.css) to import the four new files in order: `fonts → tokens → components → screens → reset → typography`.

### 1.2 Alias existing color variables

The repo currently uses `--c-*` variables in [variables.css](../../src/app/web/style/variables.css). **Alias** rather than rename:

- Keep `variables.css`, redefine each `--c-*` in terms of a `--vc-*` token (e.g. `--c-bg: var(--vc-bg)`).
- Schedule a grep-replace `--c-*` → `--vc-*` cleanup for Phase 4.

### 1.3 Topbar + theme toggle

Update [routes/+layout.svelte](../../src/app/web/routes/+layout.svelte):

- Replace existing topbar markup with the bundle's `.topbar` (brand wordmark `.vc-wordmark`, status chip `.topbar__chip`, theme button using `Icons.Sun` / `Icons.Moon`).
- Apply the `vc-pulse` keyframe (already defined in `screens.css`).

Add the `theme` store:

```
src/app/web/lib/stores/theme.ts
```

- Default to `light`.
- Persist to `localStorage.theme` on change.
- Write to `document.documentElement.dataset.theme` on change.
- SSR-safe: default to `light` until hydration.

### 1.4 Icons module

Port [icons.jsx](./design-reference/project/screens/icons.jsx) to a Svelte-friendly module. Recommended: pull `lucide-svelte` from npm — same icon set, smaller diff. Fallback: a single `Icon.svelte` taking `name` + `size`, matching stroke-1.5 / `currentColor`.

Create:

```
src/app/web/components/Icon.svelte    (skip if using lucide-svelte directly)
```

---

## Files

**New:**

```
src/app/web/style/ds/tokens.css
src/app/web/style/ds/fonts.css
src/app/web/style/ds/components.css
src/app/web/style/screens.css
src/app/web/lib/stores/theme.ts
src/app/web/components/Icon.svelte         (or lucide-svelte instead)
```

**Modified:**

```
src/app/web/style/index.css
src/app/web/style/variables.css            (alias --c-* → --vc-*)
src/app/web/routes/+layout.svelte
package.json                               (if adopting lucide-svelte)
```

---

## Verification

1. `pnpm dev` boots without console errors.
2. Every existing route still renders without layout regressions.
3. Topbar shows brand wordmark, status chip with `vc-pulse` animation, and theme toggle.
4. Clicking the theme toggle flips `<html data-theme>`, persists across reload, and re-paints with the dark palette.
5. `pnpm check` and `pnpm lint` clean.
6. Grep for hard-coded hex colors in `src/app/web/components/` — note remaining offenders for Phase 4 cleanup, but do not block on them.

---

## Done criteria

- Design tokens, fonts, components.css, and trimmed screens.css live in `src/app/web/style/`.
- Topbar matches the bundle's `.topbar` markup.
- Theme toggle works in both directions, persists, and is SSR-safe.
- Icon module is importable and renders at least one icon (e.g. the `Sun`/`Moon` in the new toggle).

---

## Out of scope (deferred)

- Reskinning route bodies → **Phase 2 / Phase 3**.
- 5-stage stepper restyle → **Phase 2**.
- Component refactor (Button, Panel, FormField, cards) → **Phase 4**.
- Renaming `--c-*` → `--vc-*` everywhere → **Phase 4 cleanup**.
