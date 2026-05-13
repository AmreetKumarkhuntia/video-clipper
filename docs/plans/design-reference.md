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

## Gaps implemented in this session

### 1. Home page wordmark hero

**File**: `src/app/web/routes/+page.svelte`

- Replaced `<Icon name="youtube" size={48} />` glyph with the large `vc-wordmark` (56px) as the design shows

### 2. VideoCard card treatment

**File**: `src/app/web/widgets/VideoCard.svelte`

- Wrapped the plain `<a>` link in `vc-card vc-card--interactive` styling
- Added proper border, surface bg, border-radius, and hover box-shadow to match `clipcard` design

### 3. ClipEditorTemplates → DS component alignment

**File**: `src/app/web/widgets/video/ClipEditorTemplates.svelte`

- Caption buttons → `ce-preset` DS style (shows actual caption style preview)
- Reframe/Fill radio groups → `seg-control seg-control--col` segmented controls

### 4. ClipEditorPropertiesPanel → DS component alignment

**File**: `src/app/web/widgets/video/ClipEditorPropertiesPanel.svelte`

- Word chips → `ce-word`/`ce-word.is-hl` DS classes
- Color swatches → `ce-swatch` chip-cards (chip + name label)
- Selection header added at panel top
- Section labels → `ce-panel-h` DS style

### 5. ClipEditorTimeline → DS token alignment

**File**: `src/app/web/widgets/video/ClipEditorTimeline.svelte`

- Hard-coded fallback colors replaced with proper DS tokens
- Fit/zoom buttons aligned with `vc-btn vc-btn--secondary vc-btn--sm` style
- Cursor pill added in `ce-tl-cursor` DS style
