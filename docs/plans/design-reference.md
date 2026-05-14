# Design Reference Implementation

Handoff from Claude Design (`video-clipper` project, 2 chat sessions).

## Source files

`docs/plans/design-reference/video-clipper/` — contains the extracted design bundle:

- `chats/` — full conversation transcripts (intent lives here)
- `project/ds/` — tokens.css, components.css, fonts.css (design system)
- `project/screens/` — JSX prototypes for all 7 screens
- `project/screens.css` — screen-level layout CSS

## What was designed

**Chat 1** — Improved all 6 screens (Start, Analyzing, Main, Results, ClipDetail, Settings):

- Pipeline promoted to left rail hero across all states
- Source Serif 4 / Inter / JetBrains Mono typography applied consistently
- Clay-500 accent throughout interactive states
- Mono font reserved for actual data (timestamps, scores, costs)
- Light + dark theme toggle

**Chat 2** — Component-level improvements for the Caption Editor (added as artboard 06):

- Reframe + Fill → `seg-control` (vertical segmented control) instead of radio dots
- Outline toggle → `vc-toggle`; outline fields collapse when off
- Color swatches → `ce-swatch` chip-cards (chip + name label) instead of bare color tiles
- Aspect chip → `vc-badge--mono` in topbar
- Stepper → done-checks + clay pill for current step + locked muted state
- Word tokens → `ce-word`/`ce-word.is-hl` classes, clickable highlight
- Sliders → `SliderField` with mono value readouts (px / weight / position)
- Right panel → selection header ("Editing · Subtitle 02" + active preset badge)
- Timeline → clay cursor pill, hairline cursor line, highlighted active subtitle segment

## What was already ported (before this session)

- `src/app/web/style/ds/tokens.css` — identical to design system tokens
- `src/app/web/style/ds/components.css` — identical to design system components
- `src/app/web/style/ds/fonts.css` — Google Fonts import
- `src/app/web/style/screens.css` — all screen-level layout CSS

## Gaps implemented

### 1. Home page wordmark hero

**File**: `src/app/web/routes/+page.svelte`

- Replaced `<Icon name="youtube" size={48} />` glyph with the large `vc-wordmark` (56px) as the design shows

### 2. VideoCard card treatment

**File**: `src/app/web/widgets/VideoCard.svelte`

- Wrapped the plain `<a>` link in `vc-card vc-card--interactive` styling
- Added proper border, surface bg, border-radius, and hover box-shadow to match `clipcard` design

### 3. Clip editor modal — design-system rebuild

**Doc**: see `docs/plans/clip-editor-redesign.md` for the full design + companion checklist.

**CSS port**: `src/app/web/style/screens.css` now carries the `ce-*` block from the design bundle (presets, swatches, words, slider rows, mono inputs, playback bar, sub-actions, position helpers, timeline tracks/segments/cursor). Screen-prototype-only classes (`ce-root`, `ce-topbar*`, `ce-stepper*`, `ce-stage`, `ce-output`, `ce-frame*`, `ce-caption-over`, `ce-game-subs`, `ce-body`/`ce-left`/`ce-center`/`ce-right`) were intentionally omitted because the real modal supplies its own framing.

**New generic primitives** (`src/app/web/components/`):

- `PanelHeader.svelte` (`.ce-panel-h` + hint)
- `SegmentedControl.svelte` (`.seg-control` / `.seg-control--col`)
- `SliderField.svelte` (composes `<Field>` + `<Slider>` + mono value readout)
- `ColorSwatch.svelte` (`.ce-swatch` chip-cards; `custom` kind opens native color picker)
- `TimecodeInput.svelte` (`.vc-input.ce-mono-input`, parses/formats `MM:SS.mmm` via new `formatTimecode` / `parseTimecode` helpers in `src/app/web/lib/format.ts`)
- `Scrubber.svelte` (`.ce-pb-track` / `.ce-pb-fill` / `.ce-pb-thumb` with pointer capture)

**New domain primitives** (`src/app/web/widgets/video/`):

- `CaptionPreset.svelte` (`.ce-preset` button with active dot + karaoke fill variant)
- `PlaybackBar.svelte` (composes `<Scrubber>` + play/pause + mono time)
- `FocusPicker.svelte` (extracted reframe drag handle, was inline in `ClipEditorCanvas`)
- `TimelineSegment.svelte` (`.ce-tl-seg` wrapper that accepts `children` for resize handles + drag body)
- `SelectionHeader.svelte` (`.ce-right__sel` "Editing · Subtitle 02" header with preset badge)
- `CanvasSubtitle.svelte` (active subtitle overlay on video; extracted from Canvas)
- `CanvasOverlay.svelte` (banner overlays on video with pointer-drag; extracted from Canvas)

**Refactored widgets** (`src/app/web/widgets/video/`):

- `ClipEditor.svelte` — header has filename + mono time-range + aspect `<Badge variant="mono">` + Save draft / Render & Save (with scissors icon) / X. Track toolbar restyled as `.ce-sub-actions` with Plus + FileText + Sparkles-hint when transcript is loaded and no subtitles exist.
- `ClipEditorTemplates.svelte` — `<CaptionPreset>` per template (active when all subtitles share `templateId`); Reframe + Fill as vertical `<SegmentedControl>`; section labels via `<PanelHeader>`; each section wrapped in `.ce-rg`.
- `ClipEditorPropertiesPanel.svelte` — `<SelectionHeader>` on top; sections in `.ce-rg`; word chips as `.ce-word`/`.is-hl`; `<SliderField>` for font size/weight/outline width; `<TimecodeInput>` for Start/End; `<ColorSwatch kind="custom">` for color/highlight/outline/background; `<Toggle>` for Outline + Background collapse; single vertical position slider with `.ce-pos-head` / `.ce-pos-sub`.
- `ClipEditorCanvas.svelte` — thin orchestrator composing `<video>` + `<CanvasSubtitle>` + `<CanvasOverlay>` + `<FocusPicker>` + `<PlaybackBar>`.
- `ClipEditorTimeline.svelte` — uses `.ce-timeline` / `.ce-tl-track` / `.ce-tl-body` markup; segments rendered via `<TimelineSegment>` (with handle + drag children); toolbar uses `<Button>`; cursor pill + hairline cursor line.

**Icons added** to `src/app/web/components/Icon.svelte`: `pause`, `plus`, `file-text` (lucide-style paths, 1.5px stroke).

**Tests**: `tests/clipEditor/smoke.spec.ts` selector updated from `/\+ subtitle/i` to `/^subtitle$/i` to match the new sub-actions row label.
