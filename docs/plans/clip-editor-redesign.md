# Clip Editor Modal — Redesign

Implementation plan for restyling the clip editor modal (opened from the analysis page) to match the `caption-editor.jsx` reference in `docs/plans/design-reference/project/screens/`.

## Why

The modal's structural layout (left templates / center canvas / right properties / bottom timeline) already matches the design, but the visuals were built ad-hoc with bespoke classnames (`template-btn`, `radio-label`, `word-chip`, `color-swatch`, `props-section`). The design uses a polished `ce-*` system backed by `screens.css`. None of those styles had been ported to the real codebase, so this pass closes that gap and refactors the modal into small composable pieces.

## Decisions

- Skip the workflow stepper (modal isn't a workflow step in this app).
- Skip the Speaker zoom toggle (would need data-model + render-pipeline work; out of scope).
- Keep the centered modal framing — no full-screen takeover.
- Match the Color section design (outline `Toggle` collapses outline color + width when off; Background swatch).
- **Prefer composition.** Reuse existing primitives (`Toggle`, `Slider`, `Button`, `Badge`, `Field`, `Textarea`, `Icon`); extract new shared components for repeated patterns.
- **Placement rule.** Generic (no domain knowledge) → `src/app/web/components/`. Domain-specific → `src/app/web/widgets/video/`.

## New components

### Generic → `src/app/web/components/`

| File                      | Purpose                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `SegmentedControl.svelte` | Wraps `.seg-control` / `.seg-control--col`. Used for Reframe, Fill, text Align.                      |
| `PanelHeader.svelte`      | Wraps `.ce-panel-h` + optional `.ce-panel-h__hint`. Used as every section header.                    |
| `SliderField.svelte`      | Composes `<Field>` + `<Slider>` + mono value readout in `.ce-slider-row`.                            |
| `ColorSwatch.svelte`      | Wraps `.ce-swatch` chip-card (`white` / `yellow` / `black` / `transparent` / `custom` kinds).        |
| `TimecodeInput.svelte`    | Mono `MM:SS.mmm` input. Backed by `formatTimecode` / `parseTimecode` in `src/app/web/lib/format.ts`. |
| `Scrubber.svelte`         | Styled range track + fill + thumb (used by `PlaybackBar`).                                           |

### Domain-specific → `src/app/web/widgets/video/`

| File                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `CaptionPreset.svelte`   | Wraps `.ce-preset` button with active state + `.ce-preset__dot` indicator.            |
| `PlaybackBar.svelte`     | `.ce-playback` row: play/pause + mono time + `<Scrubber>`.                            |
| `FocusPicker.svelte`     | Extracted reframe-focus drag handle (was inline in `ClipEditorCanvas.svelte`).        |
| `TimelineSegment.svelte` | Single `.ce-tl-seg` (kind = `sub` / `overlay` / `trim`).                              |
| `SelectionHeader.svelte` | `.ce-right__sel` "Editing · Subtitle 02 [karaoke]" header at top of properties panel. |
| `CanvasSubtitle.svelte`  | Extracted from Canvas — renders the active subtitle overlay on the video.             |
| `CanvasOverlay.svelte`   | Extracted from Canvas — renders each banner overlay (with pointer-drag).              |

## Files modified

- `src/app/web/style/screens.css` — appended the `ce-*` block (no `ce-root`, `ce-topbar*`, `ce-stepper*`, `ce-frame*`, `ce-caption-over`, `ce-game-subs`, `ce-stage`, `ce-output`, `ce-body`, `ce-left`/`ce-center`/`ce-right` wrappers).
- `src/app/web/lib/format.ts` — added `formatTimecode(sec) → "MM:SS.mmm"` and `parseTimecode(str) → sec`.
- `src/app/web/widgets/video/ClipEditor.svelte` — header restyle, sub-actions row.
- `src/app/web/widgets/video/ClipEditorTemplates.svelte`, `ClipEditorPropertiesPanel.svelte`, `ClipEditorCanvas.svelte`, `ClipEditorTimeline.svelte` — composed from the new primitives.

## Out of scope

- Workflow stepper, Speaker zoom toggle, theme toggle in header, full-screen takeover.
- Face-cam-over-game-footage stage layout (render-output mockup, not editor chrome).
- Per-clip fps/resolution readout in `PlaybackBar` (clip artifact doesn't carry that metadata yet).
- Trim track interactions (visual only).

## Verification checklist

1. Open `http://localhost:5002/videos/<videoId>/analysis/<analysisId>`, click **Edit** on a clip card. Modal opens at ~1280px with the new header (filename + mono time-range + aspect badge).
2. Left panel: caption presets render as `<CaptionPreset>` cards (one active); Reframe + Fill render as vertical `<SegmentedControl>`; section labels via `<PanelHeader>`.
3. Center panel: `<PlaybackBar>` shows play/pause + mono time + scrub bar; `<FocusPicker>` shows only when fillMode is `crop`.
4. Sub-actions row: Subtitle / Banner / Auto-import; Sparkles hint when transcript loaded + no subtitles.
5. Right panel: `<SelectionHeader>` on top; `<Textarea>` text body; `<TimecodeInput>` for Start/End; `.ce-word` chips toggle highlight; `<SliderField>` for sizes/weights; `<ColorSwatch>` for color/highlight/outline/background; `<Toggle>` for Outline collapses outline width + color when off; Position is a single vertical `<SliderField>` with top/bottom labels.
6. Timeline: Subs / Ovlys / Trim tracks (`<TimelineSegment>`s); cursor pill + hairline cursor line; Fit all / +/− buttons styled as `<Button>`.
7. Dirty-warning: change something → click X → dialog appears; Discard closes; Keep editing stays.
8. `npm run check` (svelte-check) and `npm run lint` pass; Playwright smokes still pass (selectors updated where they referenced removed classnames).
9. Theme: toggle `data-theme="dark"` on `<html>` — ported `ce-*` classes include dark variants and should render correctly.
