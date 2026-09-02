# Clip Editor — Crop (mask edges) & Placement Displacement

Adds two new viewport controls to the clip editor that were previously missing: a freeform
**Crop** (paint black bars over edges of the output) and a **Placement** displacement (offset +
scale of the picture within the output frame). Both persist on `ClipEdits.viewport` and are
honored by the ffmpeg renderer end-to-end.

## Background

Before this change the clip editor supported only:

- An aspect-ratio preset (9:16 / 1:1 / 16:9).
- A fill mode (`crop` / `pad-blur` / `pad-black`).
- A single focal point (`focus.xCenter/yCenter`) — moves the _center_ of the cover-fit window
  but cannot trim individual edges of the output, and cannot displace or zoom the picture.

There was no way to chop a strip off the top of the output, nor to push the content off-center,
nor to zoom in/out within the output frame.

## Semantics

- **Crop = window-frame mask.** Each edge value paints a flat black bar of that thickness over
  the corresponding edge of the output. The picture is **not** zoomed; the rest of the frame
  shows the same content at the same scale as it would with no crop.
- **Placement** translates and scales the picture content inside the output frame. It is
  applied **before** crop, so crop bars stay pinned to the output edges even when placement is
  non-zero.
- **Focus** still positions the cover-fit window over the source. Crop and focus are
  orthogonal — focus is always available when `fillMode === 'crop'`.
- **Subtitles and text overlays anchor to the inner picture rect** (the output frame minus the
  crop bars), not to the full output frame. A subtitle at `yCenter = 0.85` sits at 15% from
  the bottom of the visible picture — so it follows the picture instead of sliding onto the
  black bar when crop is dialed in. Placement does _not_ shift text (text lives on the canvas
  overlay layer, like a Fusion title in DaVinci).

## Schema

`src/lib/types/clipEdit.ts` — `ViewportSchema` gains two fields with defaults so existing rows
remain valid through Zod parsing:

```ts
crop: {
  (top, right, bottom, left);
} // fractions of OUTPUT, each 0–0.45
placement: {
  (offsetX, offsetY, scale);
} // -0.5..0.5 offsets, 0.25..4 scale
```

Two helpers also live in `clipEdit.ts`:

- `isDefaultCrop(crop)` — true when all four edges are 0.
- `isPlacementIdentity(placement)` — true when offset is 0 and scale is 1.

Both short-circuit the corresponding ffmpeg stages so an unedited viewport runs the same
filter graph as before this change.

## UI

Two new sections in the left templates panel, below **Fill**:

- **Crop** — four `SliderField`s for Top / Right / Bottom / Left (0–45 %) + Reset.
- **Placement** — `SliderField`s for Offset X / Offset Y (−50 to +50 %) and Scale (25–400 %) +
  Reset.

Implemented as `ClipEditorCropPanel.svelte` and `ClipEditorPlacementPanel.svelte` under
`src/app/web/widgets/video/clip-editor/templates/`. Stateless presentational components driven
by `edits.viewport`; emit partial viewport updates via `onchange`.

## Canvas preview

`ClipEditorCanvas.svelte` keeps the original `object-fit: cover/contain` + `object-position`
fit logic (driven by `focus`) and adds two extra concerns:

- A wrapping `.placement-stage` whose `transform: translate(...) scale(...)` realizes the
  user's placement on the video underneath.
- A `clip-path: inset(top% right% bottom% left%)` on the `<video>` element. Cropped edges
  reveal the viewport's black background — same visual as the renderer.

The legacy focus picker (white dot overlay) is shown whenever `fillMode === 'crop'`.

## Renderer (ffmpeg)

`src/lib/services/video/clipper/editor/filterGraphBuilder.ts` — `buildReframe` produces up to
three pipelined stages, in order:

1. **Fit** (always). Scale + focus-crop / pad according to fill mode:
   - `crop` fill: `scale=oW:oH:force_original_aspect_ratio=increase, crop=oW:oH:(iw-oW)*fx:(ih-oH)*fy`
   - `pad-blur`: explicit `split=2`, blurred background branch + foreground branch, overlay.
   - `pad-black`: `scale=oW:oH:force_original_aspect_ratio=decrease, pad=oW:oH:(ow-iw)/2:(oh-ih)/2:black`.
2. **Placement** (skipped at identity). `scale=oW*S:oH*S`, then either `crop=oW:oH:cx:cy`
   (scale ≥ 1) or `pad=oW:oH:px:py:black` (scale < 1), with cx/cy/px/py derived from
   `placement.offsetX/offsetY`.
3. **Crop bars** (skipped when all four edges are 0). Mask edges with flat black:
   - `crop=iw:ih:cx:cy` where `iw = round(oW*(1-L-R))`, `ih = round(oH*(1-T-B))`,
     `cx = round(oW*L)`, `cy = round(oH*T)`.
   - `pad=oW:oH:cx:cy:black` puts the inner rect back into a full-size frame with black bars
     at the cropped edges.

The source is never trimmed by the freeform crop. The picture is never zoomed by the crop.

`renderer.ts` was also fixed to pass **probed** source dimensions to `buildFilterGraph` — it
was passing the output dims as `srcMeta`, which silently broke focus-based crop for sources
whose dimensions didn't match the output preset.

## Hashing

`computeEditsHash` (in `src/app/web/lib/services/clipping/clipEditService.ts`) already hashes
the whole edits object minus `updatedAt`, so adding fields to `viewport` automatically
participates in hashing — no allow-list to update.

## Tests

`tests/clipEditor/filterGraphBuilder.test.ts` covers the new behavior:

- Freeform crop does NOT touch the source (no `crop=1920:…` filter).
- Freeform crop emits an output-dim `crop=…` + `pad=…:black` pair when any edge ≠ 0.
- At default crop, neither the new crop nor the black pad is in the graph.
- Focus expression is still present when crop is non-default (crop and focus are orthogonal).
- Placement scale > 1 → upscale + crop-back-to-output; scale < 1 → downscale + pad with
  black background. Offset materially changes the crop window position.

## Caveats

- **Pad-blur background**: in the canvas preview, `pad-*` modes show natural letterboxing (the
  black viewport background) instead of the blurred bars the renderer produces. This was the
  case before this change and remains so.
- **Behavior change for legacy clips**: previously, focus-based crop was silently broken for
  any source whose dimensions didn't match the output (renderer was passing output dims as
  source dims to the filter builder). Re-rendering an old clip will now produce a different
  (correct) result. The structural hash is unchanged for unmodified edits, so existing
  `lastRenderedHash` values still match `currentEditsHash` and users won't see a spurious
  "needs re-render" indicator until they manually re-render.
