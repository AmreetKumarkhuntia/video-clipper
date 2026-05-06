# Design Implementation Plan — `claude.ai/design` handoff

> **Source bundle:** `claude.ai/design` handle `OwEDWFeze-KfcUP1jlutIg`
> **Reference files:** all bundle source is checked into [./design-reference/](./design-reference/) — read those alongside this doc.
> **Last updated:** 2026-05-06

**Phased delivery:** the implementation work is split across four phases. This doc holds context, decisions, and references; each phase has its own file with steps, files-to-touch, and verification.

| Phase | Scope                                                                | File                                     |
| ----- | -------------------------------------------------------------------- | ---------------------------------------- |
| 1     | Foundation: vendor design system, app shell, theme toggle, icons     | [design-phase-1.md](./design-phase-1.md) |
| 2     | 5-stage stepper + landing/channel/video-layout reskin                | [design-phase-2.md](./design-phase-2.md) |
| 3     | Video workflow routes (Analyze · Clip · Connect · Prepare · Publish) | [design-phase-3.md](./design-phase-3.md) |
| 4     | Settings reskin + component refactor + token rename                  | [design-phase-4.md](./design-phase-4.md) |

---

## 1. Context

A Claude Design bundle was exported and handed off for implementation. It contains:

- A **README** explaining the handoff format ([./design-reference/README.md](./design-reference/README.md))
- A **chat transcript** with the user's iteration history and final intent ([./design-reference/chats/chat1.md](./design-reference/chats/chat1.md))
- A **design system** (`tokens.css`, `fonts.css`, `components.css`) — clay-cream palette, light/dark themes, full component primitives
- **Six prototype screens** as React JSX rendered onto a design canvas
- A canvas-host HTML file ([./design-reference/project/Video Clipper Screens.html](./design-reference/project/Video%20Clipper%20Screens.html))

### The ambiguity (and how it's resolved)

The shipped JSX screens are an **iteration-1 design**:

- Landing page = URL-paste box
- Pipeline = **4 stages** (`Fetch transcript → LLM analysis → Refine boundaries → Cut clips`)

But the chat transcript shows the user **explicitly redirected** at the end:

> _"1. Bind strictly to page components like on front page say I don't have pipeline thing. 2. 1st page is like searching for yt channel then it fetches videos. 3. Then we select then pipeline stage with exact 5 pipe line stages as in repo."_

The repo's actual flow ([src/app/web/lib/videoWorkflow.ts](../../src/app/web/lib/videoWorkflow.ts)) confirms:

```
Channel search  →  Channel videos  →  Analyze  →  Clip  →  Connect  →  Prepare  →  Publish
                                       └──────────── 5 stages ────────────┘
```

The bundle README explicitly tells the implementer: _"Read the chat transcripts first… they tell you what the user actually wants and where they landed after iterating."_

**Resolution:** the bundle's **visual language** is the source of truth. Its **screen structure** is not — we map design vocabulary onto the actual repo's routes and 5-step workflow.

### Confirmed decisions (asked & answered)

| Question                                      | Decision                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Iteration-1 screens vs iteration-2 structure? | **Repo flow + bundle's design language.** Iteration-1 vocabulary, applied to the repo's existing routes and 5-stage workflow. |
| Where does theme toggle live?                 | **Sun/Moon icon button in the global topbar.** Persist in `localStorage`, set `data-theme` on `<html>`.                       |
| `screens.css` vendoring scope?                | **Trim to selectors actually used** by ported Svelte components — drop canvas/artboard rules.                                 |

---

## 2. Reference inventory

Everything checked into [./design-reference/](./design-reference/) — files used during implementation, in order of importance:

| File                                                                                                               | Purpose                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [./design-reference/README.md](./design-reference/README.md)                                                       | Bundle handoff guide — _read me first_                                                                           |
| [./design-reference/chats/chat1.md](./design-reference/chats/chat1.md)                                             | Conversation that produced the design — captures user intent                                                     |
| [./design-reference/project/ds/tokens.css](./design-reference/project/ds/tokens.css)                               | Color, type, spacing, radius, motion tokens (light + dark)                                                       |
| [./design-reference/project/ds/fonts.css](./design-reference/project/ds/fonts.css)                                 | Inter / Source Serif 4 / JetBrains Mono via Google Fonts                                                         |
| [./design-reference/project/ds/components.css](./design-reference/project/ds/components.css)                       | `vc-btn`, `vc-input`, `vc-toggle`, `vc-badge`, `vc-tabs`, `vc-progress`, `vc-score`, etc.                        |
| [./design-reference/project/screens.css](./design-reference/project/screens.css)                                   | Screen-level layout: topbar, rail, main, side, pipeline, segments, clipgrid, player, timeline, wave, settings-\* |
| [./design-reference/project/screens/topbar.jsx](./design-reference/project/screens/topbar.jsx)                     | Shared topbar: brand wordmark, URL field, status chip, theme toggle                                              |
| [./design-reference/project/screens/icons.jsx](./design-reference/project/screens/icons.jsx)                       | Lucide icon set inlined as JSX                                                                                   |
| [./design-reference/project/screens/start.jsx](./design-reference/project/screens/start.jsx)                       | Empty state — hero input + recents list                                                                          |
| [./design-reference/project/screens/analyzing.jsx](./design-reference/project/screens/analyzing.jsx)               | Running state — pipeline + live log + streaming segments                                                         |
| [./design-reference/project/screens/main.jsx](./design-reference/project/screens/main.jsx)                         | Done state — player + timeline + segments + run summary                                                          |
| [./design-reference/project/screens/results.jsx](./design-reference/project/screens/results.jsx)                   | Clip grid (9:16 thumbs) + tabs + export controls                                                                 |
| [./design-reference/project/screens/clip-detail.jsx](./design-reference/project/screens/clip-detail.jsx)           | Refine one clip: waveform with handles + transcript + boundary controls                                          |
| [./design-reference/project/screens/settings.jsx](./design-reference/project/screens/settings.jsx)                 | Side nav + provider grid + sectioned form                                                                        |
| [./design-reference/project/Video Clipper Screens.html](./design-reference/project/Video%20Clipper%20Screens.html) | Canvas host (not vendored — for reference only)                                                                  |
| [./design-reference/project/design-canvas.jsx](./design-reference/project/design-canvas.jsx)                       | Canvas wrapper used by the prototype tool (not vendored)                                                         |
| [./design-reference/project/screenshots/canvas.png](./design-reference/project/screenshots/canvas.png)             | Final rendered canvas — visual sanity check                                                                      |

**What we DO NOT vendor:**

- `Video Clipper Screens.html` and `design-canvas.jsx` — prototype scaffolding (Babel-in-browser canvas pan/zoom). Useless in a Svelte/Vite app.
- The canvas-only selectors in `screens.css` (`.artboard-host`, `.canvas-banner`, etc.).

---

## 3. Route → design mapping

| Repo route                                                                                                                                                 | Design template to mimic                                                               | Notes                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [routes/+page.svelte](../../src/app/web/routes/+page.svelte) — channel search                                                                              | `start.jsx` empty state                                                                | Replace URL paste with channel-handle input. Keep `ChannelCard`. The 5-stage pipeline rail can render here in a _preview_ (all `pending`) state, or be omitted on this route — defer to the right rail tip block instead.                                            |
| [routes/channels/[channelId]/+page.svelte](../../src/app/web/routes/channels/[channelId]/+page.svelte) — video grid                                        | `start.jsx` recents block expanded into a grid                                         | Adopt `clipgrid`-style cards but for videos. Reskin `VideoCard.svelte`.                                                                                                                                                                                              |
| [routes/videos/[videoId]/+layout.svelte](../../src/app/web/routes/videos/[videoId]/+layout.svelte) — workflow stepper                                      | `main.jsx` left rail `Pipeline`                                                        | Restyle [VideoWorkflowStepper.svelte](../../src/app/web/components/video/VideoWorkflowStepper.svelte) using `.pipeline` + `.pipeline__step`. Status mapping: `complete→done`, `current→running`, `upcoming→pending`, `locked→pending` (with subtle lock affordance). |
| [routes/videos/[videoId]/+page.svelte](../../src/app/web/routes/videos/[videoId]/+page.svelte) — Step 1 · Analyze                                          | `analyzing.jsx` (when running) + `main.jsx` (when done)                                | Player + transcript + activity panel get the `.player`, `.timeline`, `.segments`, `.log` treatment.                                                                                                                                                                  |
| [routes/videos/[videoId]/analysis/[analysisId]/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte) — Step 2 · Clip | `results.jsx` (`clipgrid`) + `clip-detail.jsx` (waveform refine when one clip is open) | Tabs: Clips / Segments / Transcript / Logs.                                                                                                                                                                                                                          |
| [.../analysis/[analysisId]/connect/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/connect/+page.svelte) — Step 3 · Connect  | `settings.jsx` `provider-grid` pattern                                                 | Re-purpose for "YouTube account" connection cards.                                                                                                                                                                                                                   |
| [.../analysis/[analysisId]/prepare/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte) — Step 4 · Prepare  | `clip-detail.jsx` right panel (Title textarea, export toggles)                         | Per-clip publish form. Reuse `vc-field`, `vc-textarea`, `seg-control`, `toggle-row`.                                                                                                                                                                                 |
| [.../analysis/[analysisId]/publish/+page.svelte](../../src/app/web/routes/videos/[videoId]/analysis/[analysisId]/publish/+page.svelte) — Step 5 · Publish  | `analyzing.jsx` `.log` + `results.jsx` clip status badges                              | Upload progress per clip via `vc-progress` and status dots.                                                                                                                                                                                                          |
| [routes/settings/+page.svelte](../../src/app/web/routes/settings/+page.svelte)                                                                             | `settings.jsx` whole                                                                   | Side nav + sectioned form + provider grid + toggle-rows.                                                                                                                                                                                                             |

---

## 4. Implementation phases

The work is split across four phase docs. Each phase is self-contained: goal, steps, files touched, verification, done criteria. Read them in order — each later phase depends on the earlier ones.

| Phase | Covers (legacy step numbers) | Scope                                                               | File                                     |
| ----- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| 1     | 4.1, 4.2, 4.6                | Foundation: vendor design system, app shell + theme toggle, icons   | [design-phase-1.md](./design-phase-1.md) |
| 2     | 4.3, 4.4 (rows 1–3)          | 5-stage stepper + landing/channel/video-layout reskin               | [design-phase-2.md](./design-phase-2.md) |
| 3     | 4.4 (rows 4–7)               | Video workflow routes: Analyze · Clip · Connect · Prepare · Publish | [design-phase-3.md](./design-phase-3.md) |
| 4     | 4.4 (row 8), 4.5             | Settings reskin + component refactor + `--c-*` → `--vc-*` rename    | [design-phase-4.md](./design-phase-4.md) |

Cross-phase rules that apply throughout:

- For each row in the [Route → design mapping](#3-route--design-mapping) table, port JSX to Svelte. Touch markup + class names + minimal local CSS only. **Preserve**: route names, props, state, API calls (e.g. `apiFetch`, `resolveChannel`, the workflow stepper logic).
- Existing `--c-*` tokens are aliased to `--vc-*` in Phase 1 and renamed away in Phase 4 — do not introduce new `--c-*` references in any phase.

---

## 5. Theme strategy

- Tokens scoped to `:root` (light) and `[data-theme="dark"]` (dark) — see [tokens.css](./design-reference/project/ds/tokens.css).
- Toggle button writes `data-theme` to `<html>`; `localStorage.theme` persists the choice.
- Status chip animation (`vc-pulse`) and shimmer (`vc-shimmer`, `vc-spin`) live in `screens.css`.
- Test both themes on every route.

---

## 6. Files we will create / modify

**New:**

```
src/app/web/style/ds/tokens.css
src/app/web/style/ds/fonts.css
src/app/web/style/ds/components.css
src/app/web/style/screens.css
src/app/web/lib/stores/theme.ts          (theme store + persistence)
src/app/web/components/Icon.svelte         (or lucide-svelte instead)
src/app/web/components/PipelineRail.svelte (rendered when not on a /videos route)
```

**Modified:**

```
src/app/web/style/index.css
src/app/web/style/variables.css            (alias --c-* → --vc-*)
src/app/web/routes/+layout.svelte
src/app/web/routes/+page.svelte
src/app/web/routes/channels/[channelId]/+page.svelte
src/app/web/routes/videos/[videoId]/+layout.svelte
src/app/web/routes/videos/[videoId]/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/connect/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte
src/app/web/routes/videos/[videoId]/analysis/[analysisId]/publish/+page.svelte
src/app/web/routes/settings/+page.svelte
src/app/web/components/video/VideoWorkflowStepper.svelte
src/app/web/components/Button.svelte
src/app/web/components/Panel.svelte
src/app/web/components/FormField.svelte
src/app/web/components/ChannelCard.svelte
src/app/web/components/VideoCard.svelte
```

---

## 7. Verification

1. `pnpm dev` — boot the SvelteKit app.
2. Walk every route in **both** themes (toggle from topbar):
   - `/` — channel search; resolve a real handle (e.g. `@Anthropic`) and confirm `ChannelCard` renders in clay-cream styling.
   - `/channels/<id>` — video grid; cards use the `clipcard`/`recent` look.
   - `/videos/<id>` — Analyze step; player + transcript + activity log render with `.player`, `.timeline`, `.segments`, `.log`.
   - `/videos/<id>/analysis/<id>` — Clip step; tabs work; `clipgrid` renders.
   - `/videos/<id>/analysis/<id>/connect` — Connect step; provider-grid pattern shows YouTube account state.
   - `/videos/<id>/analysis/<id>/prepare` — Prepare step; per-clip form uses `vc-field`/`vc-textarea`/`seg-control`/`toggle-row`.
   - `/videos/<id>/analysis/<id>/publish` — Publish step; live `.log` + `vc-progress`.
   - `/settings` — full settings.jsx adaptation: side nav + provider-grid + form sections.
3. Confirm the 5-stage stepper renders correct status across each video sub-route.
4. Toggle theme; verify all colors come from `--vc-*` tokens (grep for hard-coded hex in `src/app/web/components/` and `src/app/web/routes/`).
5. `pnpm check` — no Svelte/TypeScript regressions.
6. `pnpm lint` — no new warnings.
7. `pnpm test` — existing tests still pass.
8. Visual sanity check against [./design-reference/project/screenshots/canvas.png](./design-reference/project/screenshots/canvas.png).

---

## 8. Out of scope

- Replacing video-player implementation (we're reskinning the wrapper, not the player).
- Adding new functionality not present in the repo today (e.g. command palette, keyboard shortcut overlay, recents store, audio-event detection, refine-boundaries pass — these are _visual placeholders_ in the bundle, not new features to ship).
- Replacing existing API endpoints, stores, or workflow logic.
- Mobile / responsive layouts. Bundle is desktop-only (1440×900). Existing media queries in `+layout.svelte` carry over.

---

## 9. Key bundle source — quick links

For rapid lookup during implementation:

- **Topbar pattern** → [topbar.jsx](./design-reference/project/screens/topbar.jsx) + `.topbar` in [screens.css](./design-reference/project/screens.css)
- **Pipeline component** → `Pipeline` const in [main.jsx](./design-reference/project/screens/main.jsx) + `.pipeline` in [screens.css](./design-reference/project/screens.css)
- **Player** → `Player` const in [main.jsx](./design-reference/project/screens/main.jsx) + `.player` in [screens.css](./design-reference/project/screens.css)
- **Timeline** → `Timeline` const in [main.jsx](./design-reference/project/screens/main.jsx) + `.timeline` in [screens.css](./design-reference/project/screens.css)
- **Segments list** → `SegmentRow` in [main.jsx](./design-reference/project/screens/main.jsx) + `.segments` / `.segment` in [screens.css](./design-reference/project/screens.css)
- **Clip grid** → `ClipCard` in [results.jsx](./design-reference/project/screens/results.jsx) + `.clipgrid` / `.clipcard` in [screens.css](./design-reference/project/screens.css)
- **Waveform / refine** → `ClipDetailScreen` in [clip-detail.jsx](./design-reference/project/screens/clip-detail.jsx) + `.wave*` in [screens.css](./design-reference/project/screens.css)
- **Provider grid** → `SettingsScreen` in [settings.jsx](./design-reference/project/screens/settings.jsx) + `.provider-grid` / `.provider` in [screens.css](./design-reference/project/screens.css)
- **Live log** → log block in [analyzing.jsx](./design-reference/project/screens/analyzing.jsx) + `.log` in [screens.css](./design-reference/project/screens.css)
- **Skeletons / shimmer** → `.sk*` and `vc-shimmer` keyframe in [screens.css](./design-reference/project/screens.css)
- **Tokens (light + dark)** → [tokens.css](./design-reference/project/ds/tokens.css)
- **Buttons / inputs / toggles** → [components.css](./design-reference/project/ds/components.css)
