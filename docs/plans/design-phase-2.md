# Phase 2 — Workflow stepper + entry routes

> **Parent plan:** [design.md](./design.md)
> **Depends on:** [Phase 1](./design-phase-1.md) (tokens, theme, icons available)
> **Covers:** §4.3 5-stage stepper · §4.4 reskin rows 1–3 (landing, channel grid, video layout)

---

## Goal

Get the user from "land on the app" to "enter a video" using the bundle's visual language:

- 5-stage workflow stepper renders with `.pipeline` markup.
- Channel-search landing page mirrors `start.jsx` empty state.
- Channel video grid mirrors `start.jsx` recents block expanded into a grid.
- Video layout shell shows the new pipeline rail.

After this phase the user can search a channel, browse its videos, click into one, and see the new clay-cream stepper — but inner workflow steps still render in the old skin.

---

## Steps

### 2.1 5-stage stepper

Update [components/video/VideoWorkflowStepper.svelte](../../src/app/web/components/video/VideoWorkflowStepper.svelte) to render `.pipeline` markup. Reference: the `Pipeline` component in [main.jsx](./design-reference/project/screens/main.jsx) — expects `steps: { name, state, detail?, t? }[]` where `state ∈ done | running | pending`.

Map from `VideoWorkflowStepId.status`:

```
complete  → done
current   → running
upcoming  → pending
locked    → pending  + add a small lock dot (use `.pipeline__step.is-pending` plus a modifier)
```

Render `Icons.Check` for done, `Icons.Loader` (spinning) for running, the step number for pending.

### 2.2 Landing page — channel search

Reskin [routes/+page.svelte](../../src/app/web/routes/+page.svelte) to mirror `start.jsx` empty state:

- Replace the URL paste hero with a channel-handle input. Keep `ChannelCard` (visual refresh waits for Phase 4).
- The 5-stage pipeline rail can render here in a **preview** state (all `pending`), or be omitted in favor of a right-rail tip block — defer to the tip block to avoid implying a per-channel run.

Reference markup: [start.jsx](./design-reference/project/screens/start.jsx).

### 2.3 Channel video grid

Reskin [routes/channels/[channelId]/+page.svelte](../../src/app/web/routes/channels/[channelId]/+page.svelte):

- Adopt `clipgrid`-style cards but for videos.
- Reskin `VideoCard.svelte` minimally — just enough class swaps to fit the grid. Deep refactor waits for Phase 4.

### 2.4 Video layout — pipeline rail

Reskin [routes/videos/[videoId]/+layout.svelte](../../src/app/web/routes/videos/[videoId]/+layout.svelte):

- Render the `VideoWorkflowStepper` from §2.1 in the left rail position from `main.jsx`.
- Keep all existing data-loading and route-resolution logic untouched.

---

## Files

**New:**

```
src/app/web/components/PipelineRail.svelte    (only if rendering preview rail on landing — otherwise skip)
```

**Modified:**

```
src/app/web/components/video/VideoWorkflowStepper.svelte
src/app/web/routes/+page.svelte
src/app/web/routes/channels/[channelId]/+page.svelte
src/app/web/routes/videos/[videoId]/+layout.svelte
src/app/web/components/VideoCard.svelte       (minimal — class swaps only)
```

---

## Verification

1. `pnpm dev`.
2. **`/`** — channel search; resolve a real handle (e.g. `@Anthropic`); confirm the empty-state hero mirrors `start.jsx`.
3. **`/channels/<id>`** — video grid; cards use the `clipcard`/`recent` look in both themes.
4. **`/videos/<id>`** — workflow stepper renders all 5 stages with correct status mapping (done/running/pending).
5. Toggle theme on each route; no contrast regressions.
6. `pnpm check`, `pnpm lint`, `pnpm test` clean.

---

## Done criteria

- `VideoWorkflowStepper.svelte` renders `.pipeline` markup with correct icon-per-state.
- Landing and channel grid routes match the bundle's `start.jsx` styling.
- Video layout shell shows the new stepper.
- Both themes look correct at every touched route.

---

## Out of scope (deferred)

- Inside-video step screens (Analyze, Clip, Connect, Prepare, Publish) → **Phase 3**.
- `/settings` reskin → **Phase 4**.
- `Button.svelte` / `Panel.svelte` / `FormField.svelte` / `ChannelCard.svelte` deep refactor → **Phase 4**.
