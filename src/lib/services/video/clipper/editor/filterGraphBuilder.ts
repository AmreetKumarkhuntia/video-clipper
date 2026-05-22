import type { ClipEdits, FilterGraphResult } from '@lib/types/clipEdit.js';
import { isDefaultCrop, isPlacementIdentity } from '@lib/types/clipEdit.js';
import { buildDrawtext } from './drawtextBuilder.js';

const RESOLUTIONS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
};

export function buildFilterGraph(
  edits: ClipEdits,
  srcMeta: { width: number; height: number; fps: number },
  assPath: string | null,
): FilterGraphResult {
  const { w: oW, h: oH } = RESOLUTIONS[edits.viewport.preset];
  const segments: string[] = [];
  let labelN = 0;

  const reframeResult = buildReframe(edits, srcMeta, oW, oH, labelN);
  segments.push(reframeResult.filter);
  labelN = reframeResult.nextN;

  for (const overlay of edits.overlays) {
    const inLabel = `[v${labelN - 1}]`;
    const outLabel = `[v${labelN}]`;
    segments.push(
      `${inLabel}${buildDrawtext(overlay, { width: oW, height: oH }, edits.trim.startSec, edits.viewport.crop)}${outLabel}`,
    );
    labelN++;
  }

  if (assPath !== null && edits.subtitles.length > 0) {
    const inLabel = `[v${labelN - 1}]`;
    const outLabel = `[v${labelN}]`;
    const escapedPath = assPath.replace(/:/g, '\\:');
    segments.push(`${inLabel}subtitles='${escapedPath}'${outLabel}`);
    labelN++;
  }

  const mapLabel = `[v${labelN - 1}]`;
  const filterComplex = segments.join(';');

  return { filterComplex, mapLabel };
}

function buildReframe(
  edits: ClipEdits,
  _srcMeta: { width: number; height: number },
  oW: number,
  oH: number,
  n: number,
): { filter: string; nextN: number } {
  const { fillMode, focus, crop, placement } = edits.viewport;
  const hasPlacement = !isPlacementIdentity(placement);
  const hasCrop = !isDefaultCrop(crop);

  const filters: string[] = [];
  let inLabel = '[0:v]';
  let scratch = 0;

  // Stage 1 — fit to output dimensions according to fill mode. Focus is honored independently
  // of any freeform crop.
  {
    const stageIsLast = !hasPlacement && !hasCrop;
    const out = stageIsLast ? `[v${n}]` : `[s${scratch}]`;

    if (fillMode === 'crop') {
      filters.push(
        `${inLabel}scale=${oW}:${oH}:force_original_aspect_ratio=increase,` +
          `crop=${oW}:${oH}:'(iw-${oW})*${clamp01(focus.xCenter)}':'(ih-${oH})*${clamp01(focus.yCenter)}'${out}`,
      );
    } else if (fillMode === 'pad-blur') {
      const aLabel = `[a${scratch}]`;
      const bLabel = `[b${scratch}]`;
      const bgLabel = `[bg${scratch}]`;
      const fgLabel = `[fg${scratch}]`;
      filters.push(`${inLabel}split=2${aLabel}${bLabel}`);
      filters.push(
        `${aLabel}scale=${oW}:${oH}:force_original_aspect_ratio=increase,crop=${oW}:${oH},boxblur=20${bgLabel}`,
      );
      filters.push(`${bLabel}scale=${oW}:-2:force_original_aspect_ratio=decrease${fgLabel}`);
      filters.push(`${bgLabel}${fgLabel}overlay=(W-w)/2:(H-h)/2${out}`);
    } else {
      // pad-black
      filters.push(
        `${inLabel}scale=${oW}:${oH}:force_original_aspect_ratio=decrease,` +
          `pad=${oW}:${oH}:(ow-iw)/2:(oh-ih)/2:black${out}`,
      );
    }
    inLabel = out;
    if (!stageIsLast) scratch++;
  }

  // Stage 2 — placement (scale + offset). Moves the picture; crop bars added in stage 3 stay
  // pinned to the output frame edges.
  if (hasPlacement) {
    const scaledW = Math.max(2, Math.round(oW * placement.scale));
    const scaledH = Math.max(2, Math.round(oH * placement.scale));
    const scaledLabel = `[s${scratch}]`;
    filters.push(`${inLabel}scale=${scaledW}:${scaledH}${scaledLabel}`);
    inLabel = scaledLabel;
    scratch++;

    const stageIsLast = !hasCrop;
    const out = stageIsLast ? `[v${n}]` : `[s${scratch}]`;
    if (placement.scale >= 1) {
      const cx = Math.max(
        0,
        Math.min(scaledW - oW, Math.round((scaledW - oW) / 2 - placement.offsetX * oW)),
      );
      const cy = Math.max(
        0,
        Math.min(scaledH - oH, Math.round((scaledH - oH) / 2 - placement.offsetY * oH)),
      );
      filters.push(`${inLabel}crop=${oW}:${oH}:${cx}:${cy}${out}`);
    } else {
      const px = Math.max(
        0,
        Math.min(oW - scaledW, Math.round((oW - scaledW) / 2 + placement.offsetX * oW)),
      );
      const py = Math.max(
        0,
        Math.min(oH - scaledH, Math.round((oH - scaledH) / 2 + placement.offsetY * oH)),
      );
      filters.push(`${inLabel}pad=${oW}:${oH}:${px}:${py}:black${out}`);
    }
    inLabel = out;
    if (!stageIsLast) scratch++;
  }

  // Stage 3 — freeform crop as black bars over the output. Extract the inner visible rect, then
  // pad back to full output dims with black at the cropped position. The picture is NOT scaled
  // up: this is a window-frame mask, not a zoom.
  if (hasCrop) {
    const iw = Math.max(2, Math.round(oW * (1 - crop.left - crop.right)));
    const ih = Math.max(2, Math.round(oH * (1 - crop.top - crop.bottom)));
    const cx = Math.round(oW * crop.left);
    const cy = Math.round(oH * crop.top);
    const innerLabel = `[s${scratch}]`;
    filters.push(`${inLabel}crop=${iw}:${ih}:${cx}:${cy}${innerLabel}`);
    const out = `[v${n}]`;
    filters.push(`${innerLabel}pad=${oW}:${oH}:${cx}:${cy}:black${out}`);
  }

  return { filter: filters.join(';'), nextN: n + 1 };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
