# Phase 4 — Settings + component cleanup

> **Parent plan:** [design.md](./design.md)
> **Depends on:** [Phase 1](./design-phase-1.md), [Phase 2](./design-phase-2.md), [Phase 3](./design-phase-3.md)
> **Covers:** §4.4 row 8 (settings) · §4.5 component cleanup · token rename

---

## Goal

Finish the migration:

- `/settings` mirrors the bundle's [settings.jsx](./design-reference/project/screens/settings.jsx).
- The reusable Svelte components (Button, Panel, FormField, cards) sit cleanly on top of the `vc-*` primitives instead of fighting them.
- `--c-*` aliases are removed; everything uses `--vc-*` directly.

After this phase: no hard-coded hex colors, no aliasing layer, no fragments of the old skin.

---

## Steps

### 4.1 Settings page

Reskin [routes/settings/+page.svelte](../../src/app/web/routes/settings/+page.svelte) to mirror the full [settings.jsx](./design-reference/project/screens/settings.jsx):

- Side nav (use `screens.css` `.settings-nav`).
- Sectioned form (`.settings-section`).
- `.provider-grid` for LLM / TTS / storage providers.
- `toggle-row`, `vc-field`, `vc-textarea`, `seg-control` for inputs.

### 4.2 Component refactor

Refactor in this order — earliest is most reused, so finishing it unblocks the others.

- [Button.svelte](../../src/app/web/components/Button.svelte) → `class="vc-btn vc-btn--primary"` etc. Drop the local color CSS.
- [Panel.svelte](../../src/app/web/components/Panel.svelte) → `vc-card` styling.
- [FormField.svelte](../../src/app/web/components/FormField.svelte) → `vc-field` + `vc-label` + `vc-input`.
- [ChannelCard.svelte](../../src/app/web/components/ChannelCard.svelte), [VideoCard.svelte](../../src/app/web/components/VideoCard.svelte) → recents/`clipcard` aesthetic. Replace any remaining minimal class swaps from Phase 2 with the proper structure.

### 4.3 Token rename (cleanup)

Phase 1 left a `--c-*` → `--vc-*` alias layer in [variables.css](../../src/app/web/style/variables.css). Now:

- Grep-replace `--c-*` → `--vc-*` across `src/app/web/`.
- Delete `variables.css` once nothing references the aliases.
- Confirm no `var(--c-…)` or hard-coded hex colors remain in `src/app/web/components/` or `src/app/web/routes/`.

---

## Files

**Modified:**

```
src/app/web/routes/settings/+page.svelte
src/app/web/components/Button.svelte
src/app/web/components/Panel.svelte
src/app/web/components/FormField.svelte
src/app/web/components/ChannelCard.svelte
src/app/web/components/VideoCard.svelte
src/app/web/style/variables.css            (deleted at end of phase)
```

Plus any file that referenced `--c-*` directly — these get the rename pass.

---

## Verification

1. **`/settings`** — full settings.jsx adaptation: side nav + provider-grid + sectioned form. Both themes.
2. Grep for `--c-` in `src/app/web/` — expected: zero hits.
3. Grep for hard-coded hex (`#[0-9a-fA-F]{3,6}`) in `src/app/web/components/` and `src/app/web/routes/` — expected: zero hits outside of intentional brand assets.
4. Walk every route from Phases 2–3 again to confirm no regressions from the component refactor or rename:
   - `/`, `/channels/<id>`, `/videos/<id>`, `/videos/<id>/analysis/<id>` and its `connect`/`prepare`/`publish` children.
5. Toggle theme on each route.
6. `pnpm check`, `pnpm lint`, `pnpm test` clean.
7. Final visual sanity check against [./design-reference/project/screenshots/canvas.png](./design-reference/project/screenshots/canvas.png).

---

## Done criteria

- Settings page matches the bundle's design.
- Button / Panel / FormField / cards inherit from `vc-*` primitives, no local color CSS.
- `variables.css` deleted; all consumers reference `--vc-*` directly.
- No hard-coded colors outside intentional brand assets.

---

## Out of scope

- Replacing video-player implementation (still wrapper-only).
- New features that were placeholders in the bundle (command palette, keyboard shortcut overlay, recents store, audio-event detection, refine-boundaries pass).
- Mobile / responsive layouts (bundle is desktop-only at 1440×900; existing media queries carry over).
