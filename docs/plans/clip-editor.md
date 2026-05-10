# Clip Editor — Design Doc

> **Status:** design only, no code yet
> **Last updated:** 2026-05-10
> **Owner:** TBD

A real video editor surface for short-form clips, opened from the Clips tab on `routes/videos/[videoId]/analysis/[analysisId]/+page.svelte`. Modeled on OpusClip / CapCut: animated captions with per-word highlighting, text/sticker overlays, vertical reframe, trim — all driven by a single Edit Decision List (EDL) that compiles to one ffmpeg `-filter_complex` graph at render time.

---

## 1. Context & motivation

### Today

- The analysis route ([+page.svelte](../../src/app/web/routes/videos/%5BvideoId%5D/analysis/%5BanalysisId%5D/+page.svelte)) lists clip candidates and lets the user **select / deselect** them.
- **Clip selected** posts to [`/api/clips`](../../src/app/web/routes/api/clips/+server.ts), which calls `generateWebClips` → `exportClips` → `cutClip` ([clipper/index.ts](../../src/lib/services/video/clipper/index.ts) line 28). This re-encodes the requested ranges with libx264 + aac and writes plain mp4s.
- After that, the user can move on to **Connect / Prepare / Publish**. There is no surface to add captions, banners, or change framing; what the AI selected is what gets uploaded.

### What the user asked for

> "we download the clip then we edit that where we add things like subtitles like a video editor. ANd also like some static text … like opus clips … When we select to add this. We load the existing transcript. BUt we can edit that also and kind of highlight also(say I say hi at 0:30 at then there is text surrounding it. The Hi should be highlighted … Live preview of clip download works … Main focus this editor tho."

### Concrete v1 capabilities

1. Open from a generated clip on the **Clips tab**.
2. Preview the local mp4 in HTML5 `<video>` with **DOM overlays** synced to `currentTime`.
3. **Multi-track timeline** (subtitles · text overlays · stickers · viewport-trim) with zoom + drag handles.
4. **Auto-import subtitles** from the existing transcript; edit text/timing/style; **per-word highlight** (karaoke-style).
5. **Static text banners + emoji stickers** with time ranges, draggable on canvas.
6. **Reframe** to 9:16 / 1:1 / 16:9 with a draggable focus rectangle and a `crop / pad-blur / pad-black` fill mode.
7. **Trim** in/out inside the editor.
8. Persist the EDL per-clip; **render** server-side with ffmpeg, burning everything in.

### Out of scope for v1 (call out)

- Background music, audio ducking, mute/volume.
- Transitions, multi-clip splicing, B-roll cutaways.
- Color grading / filters.
- True word-level STT — we **interpolate** word timing across the existing transcript line. A "Re-time with Whisper" follow-up is a one-line dispatch since [whisper.ts](../../src/lib/services/audio/transcriber/whisper.ts) already exists.
- Auto speaker tracking for reframing.

---

## 2. High-level architecture

The single source of truth is an **Edit Decision List (EDL)** stored on disk per clip. The editor mutates it in Svelte runes; the server compiles it to one ffmpeg filter graph at render time. The same EDL drives the live DOM preview and the final ffmpeg burn — preview shape and shipped shape can't drift apart.

```
┌────────────────────────────  Browser  ──────────────────────────┐
│  ClipEditor (modal)                                             │
│  ┌──────────────  Canvas  ─────────────┐  ┌─ Properties ──┐    │
│  │  <video src=/api/clips/:id/file>    │  │ selected item │    │
│  │  ↑ DOM overlays driven by EDL       │  │ form fields   │    │
│  │     • subtitle line (active word    │  └───────────────┘    │
│  │       gets highlightColor)          │  ┌─ Templates ───┐    │
│  │     • banner / sticker (drag)       │  │ caption presets│   │
│  │     • viewport mask (9:16 box)      │  └───────────────┘    │
│  └─────────────────────────────────────┘                       │
│  ┌──────────────  Multi-track Timeline  ──────────────────────┐ │
│  │  subtitles ▬▬▬▬ ▬▬▬   ▬▬▬▬                                 │ │
│  │  overlays           ▬▬▬                                    │ │
│  │  stickers              ▬                                   │ │
│  │  viewport  ════════════════════ (drag ends to trim)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                       ↕ apiFetch                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│  SvelteKit server                                                │
│  GET  /api/clips/:id/file       → byte-range mp4 stream          │
│  GET  /api/clips/:id/edits      → load EDL                       │
│  PUT  /api/clips/:id/edits      → persist EDL                    │
│  POST /api/clips/:id/render     → compile EDL → ffmpeg → mp4     │
│  GET  /api/clips/:id/filmstrip  → sprite of seek thumbs (v1.5)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                    ffmpeg filter_complex
        crop → scale → pad      (viewport / reframe)
        drawtext × N            (banners + stickers)
        subtitles=…ass          (subs with \k karaoke + styling)
                           │
                           ▼
                outputs/web/files/{id}_edited.mp4
```

The plain `cutClip()` keeps working unchanged for the original clip; the renderer is invoked only when the user explicitly clicks **Render & Save**.

---

## 3. Edit Decision List (EDL) schema

All shared types live under `src/lib/types/` per the **"Types location (hard rule)"** in [AGENTS.md](../../AGENTS.md#types-location-hard-rule). Add `src/lib/types/clipEdit.ts` and re-export from `src/lib/types/index.ts`.

```ts
import { z } from 'zod';

export const ViewportPresetSchema = z.enum(['16:9', '9:16', '1:1']);

export const CropFocusSchema = z.object({
  // Normalised [0..1] coords on the source frame; the renderer derives the crop rect.
  xCenter: z.number().min(0).max(1).default(0.5),
  yCenter: z.number().min(0).max(1).default(0.5),
});

export const ViewportSchema = z.object({
  preset: ViewportPresetSchema.default('9:16'),
  focus: CropFocusSchema,
  fillMode: z.enum(['crop', 'pad-blur', 'pad-black']).default('crop'),
});

export const TrimSchema = z.object({
  startSec: z.number().nonnegative().default(0),
  endSec: z.number().positive(), // exclusive; defaults to clip duration on first save
});

export const TextStyleSchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().int().positive().default(48), // sized against a 1080-tall canvas
  weight: z.number().int().min(100).max(900).default(700),
  color: z.string().default('#FFFFFF'),
  highlightColor: z.string().default('#FFD60A'),
  bgColor: z.string().nullable().default(null),
  outlineColor: z.string().nullable().default('#000000'),
  outlineWidth: z.number().nonnegative().default(2),
  align: z.enum(['left', 'center', 'right']).default('center'),
});

export const PositionSchema = z.object({
  // Normalised [0..1] coords on the *output* (post-reframe) canvas.
  xCenter: z.number().min(0).max(1).default(0.5),
  yCenter: z.number().min(0).max(1).default(0.85),
});

export const WordTokenSchema = z.object({
  text: z.string(),
  startSec: z.number().nonnegative(), // clip-relative
  endSec: z.number().positive(),
  highlight: z.boolean().default(false),
});

export const SubtitleLineSchema = z.object({
  id: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string(),
  words: z.array(WordTokenSchema).default([]),
  position: PositionSchema,
  style: TextStyleSchema,
  templateId: z.string().optional(), // applied caption template, if any
});

export const TextOverlaySchema = z.object({
  id: z.string(),
  kind: z.enum(['banner', 'sticker']), // sticker = emoji glyph(s) used like a banner
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string(),
  position: PositionSchema,
  style: TextStyleSchema,
});

export const ClipEditsSchema = z.object({
  clipId: z.string(),
  schemaVersion: z.literal(1),
  trim: TrimSchema,
  viewport: ViewportSchema,
  subtitles: z.array(SubtitleLineSchema).default([]),
  overlays: z.array(TextOverlaySchema).default([]),
  updatedAt: z.string(),
});
export type ClipEdits = z.infer<typeof ClipEditsSchema>;
```

`ClipArtifactSchema` in [analysis.ts](../../src/app/web/types/analysis.ts) gains:

```ts
editsPath: z.string().optional(),    // outputs/web/clip-edits/{clipId}.json
editedPath: z.string().optional(),   // outputs/web/files/{clipId}_edited.mp4
```

---

## 4. Server: filter-graph compiler (pure)

A pure compiler so it can be unit-tested without ffmpeg. Path: `src/lib/services/video/clipper/editor/filterGraphBuilder.ts`. Surface:

```ts
buildFilterGraph(edits: ClipEdits, srcMeta: { width: number; height: number; fps: number }, assPath: string | null):
  { filterComplex: string; mapLabel: string }
```

Steps, in evaluation order (each step's output becomes the next step's input — labels `[v0]`, `[v1]`, …):

1. **Trim** — applied on the input args, **not** in the filter graph: `-ss <trim.startSec> -to <trim.endSec>`. Cleaner and faster than `trim=` filter.
2. **Reframe**:
   - `crop`: `crop=W:H:X:Y` where `W,H` come from the preset (e.g. `9:16` from a 1920×1080 source → `W=608, H=1080`) and `X,Y` are derived from `viewport.focus.xCenter/yCenter` clamped to the source bounds.
   - `pad-blur`: `[0:v]scale=oW:oH:force_original_aspect_ratio=decrease,boxblur=20[bg];[0:v]scale=oW:-2:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]`.
   - `pad-black`: `scale=oW:-2:force_original_aspect_ratio=decrease,pad=oW:oH:(ow-iw)/2:(oh-ih)/2:black`.
3. **Drawtext × N** for overlays in EDL order (last drawn on top). Each gated with `enable='between(t,start,end)'`, positions resolved against the post-reframe `oW × oH`. Sticker uses the same filter; the glyph just happens to be an emoji in the host font.
4. **Subtitles** — `subtitles=<ass-path>`. Last in the chain so karaoke text sits above any banners that share the area.

Output target resolutions (canonical):

| Preset | Output    |
| ------ | --------- |
| `9:16` | 1080×1920 |
| `1:1`  | 1080×1080 |
| `16:9` | 1920×1080 |

Pure helpers, each in its own file:

- `assBuilder.ts` — `buildAss(subtitles, output): string`. Emits a v4+ Styles block from `TextStyleSchema`, then one Dialogue line per `SubtitleLine`. Each line concatenates `{\k<cs>}<word>` for every word in `words`; words with `highlight=true` wrap in `{\1c&H<bgr>&}…{\r}` so highlighted words use `style.highlightColor`. Sets `PlayResX/PlayResY` to the chosen output resolution. ASS reference: [Aegisub override tags](https://aegisub.org/docs/latest/ass_tags/).
- `drawtextBuilder.ts` — `buildDrawtext(overlay, output): string`. Writes options like `text='…':enable='between(t,a,b)':x=…:y=…:fontfile=…:fontsize=…:fontcolor=…:borderw=2:bordercolor=black:box=1:boxcolor=…:boxborderw=8`.
- `textEscape.ts` — escape helpers for ffmpeg drawtext (`:`, `'`, `\`, `%`) and ASS (`{`, `}`, `\N`).

### Karaoke timing primer

`{\k<cs>}` sets the duration of the next syllable in centiseconds. Total of all `\k` values inside a Dialogue line should equal the line's duration. Highlighted words also inline-override the primary colour:

```
Dialogue: 0,0:00:00.30,0:00:02.40,Default,,0000,0000,0000,,{\k50}Hi {\1c&H0AD6FF&\k60}there{\r}{\k60} how are you?
```

ffmpeg consumes this via `subtitles=path/to/file.ass`. Reference: [ASS format guide](https://www.quicklrc.com/subtitle-formats/ass).

---

## 5. Server: renderer (impure)

`src/lib/services/video/clipper/editor/renderer.ts`:

```ts
renderClipWithEdits(inputPath: string, edits: ClipEdits, outputPath: string, cfg: ClipperConfig): Promise<string>
```

1. Reuse `configureFfmpeg(cfg)` from [clipper/index.ts](../../src/lib/services/video/clipper/index.ts) line 12.
2. `ffprobe` the input → resolution + fps.
3. Write ASS to `outputs/web/clip-edits/tmp/{clipId}.ass` (sanitised text already inside).
4. `buildFilterGraph(...)` → `{ filterComplex, mapLabel }`.
5. Run via `fluent-ffmpeg`:
   - input: `inputPath` with `-ss trim.startSec -to trim.endSec`.
   - `complexFilter(filterComplex, [mapLabel])`.
   - audio map: `0:a?` (passthrough, copy if codec compatible, else aac).
   - `-c:v libx264 -preset cfg.ffmpegPreset -movflags +faststart`.

---

## 6. Server: web service & artifact store changes

**New** `src/app/web/lib/services/clipping/clipEditService.ts`:

- `loadClipEdits(outputDir, clipId)` — reads `outputs/web/clip-edits/{clipId}.json`; on miss returns sensible defaults (`trim` covers full duration, `viewport` = 9:16 / center / crop, empty subtitles + overlays).
- `saveClipEdits(outputDir, edits)` — validates with `ClipEditsSchema`, writes JSON, calls `updateClipArtifactPaths(...)` to set `editsPath`.
- `renderEditedClip(outputDir, cfg, clipId)` — loads edits + artifact, computes `{base}_edited.mp4`, calls `renderClipWithEdits`, sets `editedPath` on the artifact.

**Modify** [artifactStore.ts](../../src/app/web/lib/services/artifacts/artifactStore.ts):

- Accept `'clip-edits'` in the `kind` union of `ensureArtifactDir`.
- `getClipArtifact(outputDir, clipId)` — single-record reader (mirrors the existing `getAnalysis`).
- `updateClipArtifactPaths(outputDir, clipId, patch: { editsPath?: string; editedPath?: string })` — small JSON patch + write.

Mirror config wiring from [clipService.ts](../../src/app/web/lib/services/clipping/clipService.ts) for `ClipperConfig`.

---

## 7. Server: HTTP routes

All under `src/app/web/routes/api/clips/[clipId]/…/+server.ts`. Use `jsonOk`, `jsonError`, `parseJsonBody` from [responses.ts](../../src/app/web/lib/services/http/responses.ts).

| Path                            | Method | Purpose                                                                                                                                                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/clips/[clipId]/file`      | GET    | Byte-range mp4 stream. Returns `editedPath ?? path`. Implement with `fs.createReadStream` + parsed `Range:` header → `Content-Range`. Required because the browser cannot read disk paths. |
| `/api/clips/[clipId]/edits`     | GET    | Load EDL or defaults.                                                                                                                                                                      |
| `/api/clips/[clipId]/edits`     | PUT    | Validate `ClipEditsSchema`, persist.                                                                                                                                                       |
| `/api/clips/[clipId]/render`    | POST   | Run renderer, return updated `ClipArtifact`.                                                                                                                                               |
| `/api/clips/[clipId]/filmstrip` | GET    | (v1.5) `ffmpeg -ss … -i … -vf "fps=1/(dur/N),tile=Nx1" sprite.webp`. Skip for v1.                                                                                                          |

---

## 8. Client: editor surface

### 8.1 Mount point

[+page.svelte](../../src/app/web/routes/videos/%5BvideoId%5D/analysis/%5BanalysisId%5D/+page.svelte) gets an **Edit** button on each card in the Clips block (currently lines 209–226). Click opens a full-viewport `ClipEditor.svelte` modal with:

```ts
{ clip: ClipArtifact, candidate: ClipCandidate | null, videoId: string }
```

`candidate` is found via `plan.candidates.find(c => c.id === clip.segmentId)` and supplies the absolute time range used to filter the transcript on auto-import. After **Render & Save** succeeds, refresh `clips` via the existing `loadArtifacts()` so the card reflects the new `editedPath` (small "Edited" badge).

### 8.2 Editor layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Clip · 0:00 → 0:18 · 9:16          [Save]  [Render & Save]   ✕ │
├────────────────┬─────────────────────────────┬───────────────────┤
│ Templates      │   ClipEditorCanvas          │ Properties panel  │
│ ─────────────  │   (video + DOM overlays +   │ ─────────────     │
│ • Bold White   │    drag handles + viewport  │ Selected: subtitle│
│ • Yellow Pop   │    mask)                    │ #2                │
│ • Subtle       │                             │ Text [_____]      │
│ • Hooked       │   ▶ 00:03 / 00:18           │ Time [0.0]→[2.4]  │
│ • Karaoke      │                             │ Position drag/Pos │
│                │                             │ Style: size/colors│
│ Reframe        │                             │ Words: [Hi][there]│
│ ◉ 9:16 ○ 1:1   │                             │   tap → highlight │
│ ○ 16:9         │                             │                   │
│ Focus: drag on │                             │                   │
│ canvas         │                             │                   │
├────────────────┴─────────────────────────────┴───────────────────┤
│  ClipEditorTimeline                                              │
│  Subtitles  ▬▬▬▬  ▬▬▬   ▬▬▬▬                                     │
│  Overlays                ▬▬▬                                     │
│  Stickers                   ▬                                    │
│  Viewport   ═════════════════ (drag ends to trim)                │
│  [+ subtitle] [+ banner] [+ sticker] [Auto-import transcript]    │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 State (Svelte 5 runes inside `ClipEditor.svelte`)

```ts
let edits = $state<ClipEdits>(...);                 // GET /api/clips/:id/edits
let videoEl = $state<HTMLVideoElement|null>(null);
let currentTime = $state(0);                        // bind:currentTime on <video>
let selectedItemId = $state<string|null>(null);
let isDirty = $derived(...);
let activeWords = $derived(activeWordsAt(currentTime, edits.subtitles));
```

### 8.4 Sub-widgets

Each gets a `Props` interface declared in [componentProps.ts](../../src/app/web/types/componentProps.ts) per the existing convention.

- **`ClipEditorCanvas.svelte`** — renders the `<video>`, the active subtitle line as a positioned `<div>` (active word gets `style.highlightColor`), every visible overlay/sticker as a positioned `<div>` (mousedown → drag-to-reposition writes back to `edits`), and a viewport mask outlining the chosen aspect (transparent rect + dark surround). Position math uses `getBoundingClientRect` to convert pixels → normalised `[0..1]` so the EDL stays resolution-independent.
- **`ClipEditorTimeline.svelte`** — multi-lane zoomable timeline. Reuses head + minimap + `handleWheel` + `zoomToSegment` patterns from existing [ClipTimeline.svelte](../../src/app/web/widgets/video/ClipTimeline.svelte). Lanes: `subtitles`, `overlays`, `stickers`, `viewport` (single trim bar). Items render as `<button>`s with left/right resize handles; click → `selectedItemId`; drag-body → time shift; drag-edge → resize.
- **`ClipEditorPropertiesPanel.svelte`** — switches forms by `selectedItem.kind`. The subtitle form has a **word grid**: each word is a chip; tap toggles `WordTokenSchema.highlight`.
- **`ClipEditorTemplates.svelte`** — five static caption presets defined in `src/app/web/lib/captionTemplates.ts`: `Bold White`, `Yellow Pop`, `Subtle`, `Hooked`, `Karaoke`. Selecting one applies its `TextStyleSchema` + default `position` to all subtitles (or to the selected one).
- **`ClipEditorViewportControls.svelte`** — radio buttons for `9:16 / 1:1 / 16:9`, segmented control for `crop / pad-blur / pad-black`, and a "drag focus on canvas" hint. The actual focus drag is owned by `ClipEditorCanvas` and writes to `edits.viewport.focus`.

### 8.5 Subtitle auto-import flow

1. Parallel `apiFetch` on open: `/api/clips/:id/edits` and `/api/youtube/videos/[videoId]/transcript`.
2. **Auto-import transcript** button (also auto-runs once when EDL has zero subtitles):
   - Filter `transcript.lines` by `line.start ∈ [candidate.startSec, candidate.endSec]` (or fallback to clip's start/end).
   - Translate to clip-relative time: `start − clip.startSec`.
   - Split text on whitespace; for each word interpolate timing linearly: `word_i.start = lineStart + i / N · (lineEnd − lineStart)`. (Per-word YouTube timing is not exposed; interpolation is the conventional fallback. v1.5 calls out re-timing via Whisper.)
   - Emit one `SubtitleLine` per source line with `position` + `style` from the active template.

### 8.6 Live preview semantics

- DOM overlays driven by `currentTime` (bound via Svelte `bind:currentTime`).
- Active subtitle = the `SubtitleLine` whose `[startSec, endSec)` contains `currentTime`. Its words render side-by-side; the word whose `[startSec, endSec)` contains `currentTime` gets `style.highlightColor`.
- The DOM preview is **approximate** vs. the ffmpeg burn-in — there is a typical ~33ms drift owing to HTML5 video frame stepping. ffmpeg burns precisely. This is acceptable for v1; the user verifies after **Render & Save** by reloading `/api/clips/:id/file?v=Date.now()`.

---

## 9. Persistence layout

```
outputs/web/
  analyses/{analysisId}.json
  clips/{clipId}.json                 ← ClipArtifact (now with editsPath?, editedPath?)
  files/                              ← original + rendered mp4 sit side-by-side
    {videoId}_{s}_{e}.mp4
    {videoId}_{s}_{e}_edited.mp4
  clip-edits/
    {clipId}.json                     ← ClipEdits (EDL)
    tmp/{clipId}.ass                  ← regenerated each render
```

---

## 10. File plan

### Add

- `src/lib/types/clipEdit.ts`
- `src/lib/services/video/clipper/editor/filterGraphBuilder.ts`
- `src/lib/services/video/clipper/editor/assBuilder.ts`
- `src/lib/services/video/clipper/editor/drawtextBuilder.ts`
- `src/lib/services/video/clipper/editor/textEscape.ts`
- `src/lib/services/video/clipper/editor/renderer.ts`
- `src/app/web/lib/services/clipping/clipEditService.ts`
- `src/app/web/lib/captionTemplates.ts`
- `src/app/web/routes/api/clips/[clipId]/file/+server.ts`
- `src/app/web/routes/api/clips/[clipId]/edits/+server.ts`
- `src/app/web/routes/api/clips/[clipId]/render/+server.ts`
- `src/app/web/widgets/video/ClipEditor.svelte`
- `src/app/web/widgets/video/ClipEditorCanvas.svelte`
- `src/app/web/widgets/video/ClipEditorTimeline.svelte`
- `src/app/web/widgets/video/ClipEditorPropertiesPanel.svelte`
- `src/app/web/widgets/video/ClipEditorViewportControls.svelte`
- `src/app/web/widgets/video/ClipEditorTemplates.svelte`
- `tests/clipEditor/assBuilder.test.ts`
- `tests/clipEditor/drawtextBuilder.test.ts`
- `tests/clipEditor/filterGraphBuilder.test.ts`
- `tests/clipEditor/textEscape.test.ts`

### Modify

- `src/lib/types/index.ts` — re-export from `clipEdit.ts`.
- `src/app/web/types/analysis.ts` — `editsPath?`, `editedPath?` on `ClipArtifactSchema`.
- `src/app/web/types/componentProps.ts` — `Props` interfaces for the six new widgets.
- `src/app/web/lib/services/artifacts/artifactStore.ts` — `'clip-edits'` kind, `getClipArtifact`, `updateClipArtifactPaths`.
- `src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte` — Edit button + modal mount.

### Reuse (no changes)

- `configureFfmpeg`, `ClipperConfig` — [clipper/index.ts](../../src/lib/services/video/clipper/index.ts) line 12.
- `apiFetch`, `readApiError` — [api.ts](../../src/app/web/lib/api.ts).
- `jsonOk`, `jsonError`, `parseJsonBody` — [responses.ts](../../src/app/web/lib/services/http/responses.ts).
- `formatTime` — [format.ts](../../src/app/web/lib/format.ts).
- `Card`, `Button`, `InputText`, `Select`, `Slider`, `Textarea`, `Toggle`, `Icon` — [components/](../../src/app/web/components).
- Existing zoom/wheel patterns — [ClipTimeline.svelte](../../src/app/web/widgets/video/ClipTimeline.svelte).

---

## 11. Phased rollout

Each phase is an independently shippable commit.

### Phase 1 — schema + routes + compiler (no UI)

- Add `clipEdit.ts` types + zod schemas; wire re-exports.
- Add the four pure builders (`textEscape`, `drawtextBuilder`, `assBuilder`, `filterGraphBuilder`) with unit tests.
- Add `renderer.ts`.
- Extend `ClipArtifactSchema` and `artifactStore.ts`.
- Add the four routes (`/file`, `/edits` GET+PUT, `/render`).
- Smoke-test by hand-crafting an EDL JSON and `curl`-ing `/render`.

### Phase 2 — editor canvas + properties + templates

- Add `ClipEditor.svelte` shell + state, modal mount.
- Add `ClipEditorCanvas.svelte` (video + DOM overlays, no drag yet).
- Add `ClipEditorPropertiesPanel.svelte`.
- Add `ClipEditorTemplates.svelte` + `captionTemplates.ts`.
- Wire **Auto-import transcript** + word-highlight chip toggles.
- **Save** button → `PUT /edits`.
- **Render & Save** button → `POST /render` → reload `/file?v=…`.

### Phase 3 — timeline + drag handles + reframe focus drag

- Add `ClipEditorTimeline.svelte`. Items click-select; drag-body shifts time; drag-edge resizes.
- Drag overlays + stickers on canvas to reposition (writes normalised position).
- Add `ClipEditorViewportControls.svelte` + on-canvas focus drag for `viewport.focus`.

### Phase 4 — Edit button + polish

- Edit button on the Clips tab in [+page.svelte](../../src/app/web/routes/videos/%5BvideoId%5D/analysis/%5BanalysisId%5D/+page.svelte).
- "Edited" badge driven by `editedPath`.
- Empty/error states; cancel-with-dirty-warning.
- Playwright smoke under `temp/`.

---

## 12. v1.5 follow-ups (call out, not in scope)

- **Re-time with Whisper** — re-transcribe `editedPath` audio via [whisper.ts](../../src/lib/services/audio/transcriber/whisper.ts) for true word-level timestamps; replace interpolated word timings on selected lines.
- **Filmstrip thumbnails** — single ffmpeg `select=…,tile=10x1` sprite served by `/api/clips/:id/filmstrip`, used as the timeline lane background.
- **Background music** — second audio input + `amix` filter, ducking via `sidechaincompress`.
- **Auto-reframe** — face/active-speaker detection to drive `viewport.focus` automatically. Out of scope without a vision pipeline.

---

## 13. Verification checklist

1. `npm run dev` → web on `:5002`.
2. Open `http://localhost:5002/videos/<videoId>/analysis/<analysisId>`.
3. Click **Clip selected** on a candidate to produce a plain mp4 (existing flow). Switch to the Clips tab.
4. Click the new **Edit** button → editor modal opens, video plays from `/api/clips/:id/file`, EDL initialises with sensible defaults (full trim, 9:16, empty tracks).
5. Pick a caption template → playing the video shows DOM overlays for any imported subtitles in the chosen style.
6. Click **Auto-import transcript** → subtitle items appear on the subtitle lane, words split. Open one, tap a word → that word gets `highlightColor` at the correct moment in preview.
7. Add a banner from **+ banner**, drag it on the canvas to reposition, resize its time-range on the timeline.
8. Switch viewport to **1:1**, drag the focus handle on canvas → the viewport mask updates.
9. Click **Save** → `outputs/web/clip-edits/{clipId}.json` exists; `ClipArtifact.editsPath` updated.
10. Click **Render & Save** → server runs ffmpeg; `outputs/web/files/{base}_edited.mp4` lands; reopening the editor (or any clip listing) plays the rendered version with overlays burned in.
11. `npm run typecheck && npm run lint` clean.
12. Unit tests for the four pure builders: `npm test -- clipEditor`.
13. Playwright smoke (under `temp/`) — open editor, screenshot canvas + timeline + properties panel.
