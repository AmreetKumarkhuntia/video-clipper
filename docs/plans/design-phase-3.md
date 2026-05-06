# Phase 3 — Video workflow routes

> **Parent plan:** [design.md](./design.md)
> **Depends on:** [Phase 1](./design-phase-1.md), [Phase 2](./design-phase-2.md)
> **Covers:** §4.4 reskin rows 4–7 — Analyze, Clip, Connect, Prepare, Publish

---

## Goal

Reskin every step of the 5-stage workflow so a full pipeline run renders in the new design end-to-end.

After this phase: pick a video → run analyze → review clips → connect YouTube → prepare per-clip metadata → publish, all in clay-cream.

---

## Steps

Reskin order matches blast radius — earliest step first, since each subsequent route reuses the same primitives.

### 3.1 Analyze step

Reskin [routes/videos/[videoId]/+page.svelte](../../src/app/web/routes/videos/[videoId]/+page.svelte).

Two visual states:

- **Running** → mirror [analyzing.jsx](./design-reference/project/screens/analyzing.jsx): pipeline rail + live `.log` + streaming `.segments`.
- **Done** → mirror [main.jsx](./design-reference/project/screens/main.jsx): player + timeline + segments + run summary.

Treat the player wrapper, transcript panel, and activity panel with `.player`, `.timeline`, `.segments`, `.log` classes from `screens.css`. The underlying player implementation does not change.

### 3.2 Clip step

Reskin [routes/videos/[videoId]/analysis/[analysisId]/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte).

- Default view: `.clipgrid` from [results.jsx](./design-reference/project/screens/results.jsx).
- When one clip is opened: `.wave*` refine markup from [clip-detail.jsx](./design-reference/project/screens/clip-detail.jsx).
- Tabs: Clips / Segments / Transcript / Logs — use `vc-tabs` from `components.css`.

### 3.3 Connect step

Reskin [routes/videos/[videoId]/analysis/[analysisId]/connect/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/connect/+page.svelte).

- Re-purpose the `.provider-grid` pattern from [settings.jsx](./design-reference/project/screens/settings.jsx) for "YouTube account" connection cards.
- Each card = one connectable account; status maps to `.provider`'s connected/disconnected variants.

### 3.4 Prepare step

Reskin [routes/videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte).

- Per-clip publish form using the right panel from [clip-detail.jsx](./design-reference/project/screens/clip-detail.jsx) (Title textarea, export toggles).
- Reuse `vc-field`, `vc-textarea`, `seg-control`, `toggle-row` from `components.css`.

### 3.5 Publish step

Reskin [routes/videos/[videoId]/analysis/[analysisId]/publish/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/publish/+page.svelte).

- Live `.log` panel for upload events (mirrors [analyzing.jsx](./design-reference/project/screens/analyzing.jsx)).
- Per-clip status: `vc-progress` bars + status badges from [results.jsx](./design-reference/project/screens/results.jsx) clip cards.

---

## Files

**Modified:**

```
src/app/web/routes/videos/[videoId]/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/connect/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/publish/+page.svelte
```

(No new components expected — every primitive needed should already be in `components.css` / `screens.css` from Phase 1.)

---

## Verification

Walk through a full pipeline in **both** themes:

1. **Analyze (`/videos/<id>`)** — running state shows pipeline + log + streaming segments; done state shows player + timeline + segments + summary.
2. **Clip (`/videos/<id>/analysis/<id>`)** — `clipgrid` renders; tabs switch; opening a clip swaps to the waveform refine view.
3. **Connect (`.../connect`)** — provider-grid pattern shows YouTube account state.
4. **Prepare (`.../prepare`)** — per-clip form uses `vc-field`/`vc-textarea`/`seg-control`/`toggle-row`.
5. **Publish (`.../publish`)** — live `.log` + `vc-progress` bars per clip.
6. The 5-stage stepper from Phase 2 shows correct status across each sub-route.
7. `pnpm check`, `pnpm lint`, `pnpm test` clean.
8. Visual sanity check against [./design-reference/project/screenshots/canvas.png](./design-reference/project/screenshots/canvas.png).

---

## Done criteria

- All five workflow step routes render in the bundle's design language.
- A full run from analyze → publish has no skin discontinuity between steps.
- Both themes look correct on every step.

---

## Out of scope (deferred)

- `/settings` reskin → **Phase 4**.
- `Button.svelte` / `Panel.svelte` / `FormField.svelte` / `ChannelCard.svelte` / `VideoCard.svelte` deep refactor → **Phase 4**.
- Replacing the underlying video-player implementation (we only reskin the wrapper).
- Adding new functionality beyond what already exists (recents store, command palette, refine-boundaries pass — these are visual placeholders in the bundle, not features).
