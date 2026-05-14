# Editor save fidelity, original/edited separation, preview button

## Context

Two coupled problems in the clip editor today:

1. **The saved/rendered output does not match what the editor canvas shows.** Subtitles and overlays diverge in font size, alignment, trim boundaries, and several other dimensions. The editing canvas is the source of truth (the user said the editing view "is correct"), so the FFmpeg renderer must be brought into parity with it.
2. **The editor currently consumes the rendered `_edited.mp4` once one exists, which causes double-burnt subtitles on subsequent edits, and there is no way to preview the rendered result from the main analysis page.** We need three clean states:
   - **Editor**: always loads the original raw clip; edits are overlaid live.
   - **Preview** (main analysis page, modal): plays back the currently-saved rendered edited file.
   - **Upload**: uses the rendered `editedPath`, separate from the original `path`.

## Approach

### 1. Original-vs-edited separation (file endpoint variant)

Add an explicit `variant` query param to `GET /api/clips/[clipId]/file`:

- `?variant=original` → `artifact.path` (raw, never modified).
- `?variant=edited` → `artifact.editedPath`; 404 if absent.
- No `variant` param → current fallback (edited if present else original), preserved for back-compat.

Editor canvas always requests `variant=original`. Preview modal always requests `variant=edited`. Upload reads `editedPath` directly from the artifact.

### 2. Preview button on the analysis page

Add a **Preview** button next to **Edit** on each clip card in `…/analysis/[analysisId]/+page.svelte`.

- Enabled only when `clip.editedPath` exists; otherwise show a "Render first" hint.
- Click opens a modal that streams `?variant=edited`.
- The modal is a new domain widget `widgets/video/clip-editor/preview/ClipPreviewModal.svelte`, reusing `Button`/`Icon` primitives from `components/`.
- The Preview reflects whatever was last saved/rendered — no auto-render here.

### 3. Upload uses the edited path

- `uploadService.ts:206` and `draftService.ts:84` switch from `item.path` / `clip.path` to `item.editedPath ?? item.path` and `clip.editedPath ?? clip.path` respectively.
- Surface a per-clip "Render required" affordance on the publish page when a clip has edits but no `editedPath` (or is stale).

### 4. WYSIWYG render parity (renderer follows canvas)

Treat `CanvasSubtitle.svelte` / `CanvasOverlay.svelte` as the visual contract. Update the FFmpeg builders to match:

- **Font size scaling**: canvas uses `fontSize * 0.045cqw` (container-relative). Compute the equivalent absolute pixel size against the FFmpeg output's actual dimensions. Introduce `src/lib/utils/textScale.ts` exporting `resolveRenderedFontSize(designSize, outputDims)` used by both `subtitleBuilder.ts` and `drawtextBuilder.ts`. Lock the canvas container aspect to the viewport preset so the visual math collapses to the same px size at any zoom.
- **Alignment**: thread `style.align` (`left|center|right`) through the entire pipeline.
  - Canvas: `CanvasSubtitle.svelte` and `CanvasOverlay.svelte` switch anchor/transform based on align.
  - `subtitleBuilder.ts`: map align → ASS Alignment code (1/2/3 bottom row); adjust marginL/R to match the canvas margin %.
  - `drawtextBuilder.ts`: map align → `x` expression with the same margin as canvas.
- **Trim**: have the editor canvas honor `edits.trim` (clamp `currentTime` to `[startSec, endSec]`, pause on overrun, update timeline length display). Renderer already trims correctly via `-ss/-to`.
- **Word-level karaoke**: verify `CanvasSubtitle.svelte` highlights the same word the ASS `\k` tags would (currently highlights based on `currentTime` — confirm offsets relative to `trim.startSec`).
- **Overlays in FFmpeg**: verify `drawtextBuilder` is actually invoked from `renderer.ts` for the `overlays[]` array. If overlays are dropped, wire them into the filter graph.
- **Position units**: confirm subtitle and overlay `position` (xPct, yPct) are interpreted identically on both sides (canvas uses % of container; FFmpeg must use % of output W/H).

### 5. Render staleness flag

Add `lastRenderedHash: z.string().optional()` to `ClipArtifactSchema`. Compute a structural hash of `ClipEdits` (exclude `updatedAt`) on save; persist on render. The analysis page shows a "Stale render" badge when the current edits hash ≠ `lastRenderedHash`, signaling the user to re-render before previewing/uploading.

## Concrete file changes

### Endpoints

- `src/app/web/routes/api/clips/[clipId]/file/+server.ts:42` — accept `?variant=original|edited`.

### Editor

- `src/app/web/widgets/video/clip-editor/canvas/ClipEditorCanvas.svelte:66-74` — `src` → `?variant=original`; clamp playback to `edits.trim`; lock container aspect to viewport preset.
- `src/app/web/widgets/video/clip-editor/canvas/CanvasSubtitle.svelte` — apply `style.align`.
- `src/app/web/widgets/video/clip-editor/canvas/CanvasOverlay.svelte` — apply `style.align`.

### Renderer

- `src/lib/services/video/clipper/editor/subtitleBuilder.ts` — use `resolveRenderedFontSize`; map `style.align` to ASS Alignment; honor margin percents.
- `src/lib/services/video/clipper/editor/drawtextBuilder.ts` — use `resolveRenderedFontSize`; honor `style.align`.
- `src/lib/services/video/clipper/editor/renderer.ts:40-109` — verify overlays are wired into the filter graph; pass output dims into builders; persist `lastRenderedHash`.
- `src/lib/utils/textScale.ts` _(new)_ — single source of truth for design-size → output-px mapping.

### Analysis page (main)

- `src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte` (clip card around L281-298) — add **Preview** button next to **Edit**; disabled when `!clip.editedPath`; opens `ClipPreviewModal`.
- `src/app/web/widgets/video/clip-editor/preview/ClipPreviewModal.svelte` _(new)_ — modal containing `<video src="/api/clips/{id}/file?variant=edited&v={ts}">` plus Close. Cache-bust with timestamp.

### Publish / upload

- `src/app/web/lib/services/publishing/uploadService.ts:206` — read `editedPath` (fall back to `path` only if no edits exist at all).
- `src/app/web/lib/services/publishing/draftService.ts:84` — same.
- `src/app/web/routes/publish/+page.svelte` — disable upload row when `editedPath` is missing or stale; surface "Render required" affordance.

### Types (canonical locations per project convention)

- `src/app/web/types/analysis.ts` — extend `ClipArtifactSchema` with `lastRenderedHash?: string`. Add `FileVariantSchema = z.enum(['original','edited'])`.
- `src/app/web/types/componentProps.ts` — `ClipPreviewModalProps { clipId: string; onclose: () => void }`.
- `src/lib/types/clipEdit.ts` — no change (`style.align` already exists; we're now actually consuming it).

## Verification

### Manual checklist

- Open editor on a clip with a prior `editedPath` → the `<video>` loads the **original** (no double-burnt subtitles). Confirm via DevTools network → `?variant=original`.
- Edit subtitle text and change align to `left` → canvas left-anchors; click Render & Save → rendered file shows the same left-anchored text at the same position.
- Set trim `[2s, 6s]` → canvas pauses at 6s, timeline reads 4s; rendered file duration is 4s.
- Add an overlay → confirm it appears in the rendered output (not silently dropped).
- Resize editor panel → font size stays visually consistent; rendered size matches.
- On the analysis page, a clip with `editedPath` → **Preview** button enabled; click → modal plays the edited file. A clip without `editedPath` → button disabled with hint.
- Publish/upload an edited clip → bytes posted to YouTube come from `_edited.mp4`.
- Edit a clip after rendering, don't re-render → analysis page shows "Stale render" badge.

### Playwright smoke (extend specs under `src/app/web/tests/`)

- `editor.variant.spec.ts` — opens editor; asserts `<video>` `src` contains `variant=original` even when `editedPath` is set.
- `preview.modal.spec.ts` — clicks Preview on a clip with `editedPath`; asserts the modal video src contains `variant=edited`.
- `render.parity.spec.ts` — sets subtitle align=left, font size 48, trim [1,3]; triggers render; compares the first rendered frame's text bounding box X to the canvas overlay bounding box (within tolerance).
- `publish.usesEdited.spec.ts` — intercepts the YouTube multipart POST and asserts the uploaded byte stream matches the `_edited.mp4` hash.

## Risks

- **Aspect-ratio locking** on the canvas may visually crop content in narrow panels — handle with letterboxing inside the canvas.
- **Stale render UX**: hashing must exclude `updatedAt`; otherwise every keystroke shows stale.
- **Re-render cost**: no auto-render. Preview only plays what is already on disk; the user explicitly opts in via Render & Save.
- **Backward compatibility**: existing callers of `/file` without `variant` keep working.
