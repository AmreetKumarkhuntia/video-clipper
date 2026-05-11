import type { ClipEdits, FilterGraphResult } from '@lib/types/clipEdit.js';
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
    segments.push(`${inLabel}${buildDrawtext(overlay, { width: oW, height: oH })}${outLabel}`);
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
  srcMeta: { width: number; height: number },
  oW: number,
  oH: number,
  n: number,
): { filter: string; nextN: number } {
  const { fillMode, focus } = edits.viewport;
  const outLabel = `[v${n}]`;

  if (fillMode === 'crop') {
    const cropX = Math.max(
      0,
      Math.min(srcMeta.width - oW, Math.round(focus.xCenter * srcMeta.width - oW / 2)),
    );
    const cropY = Math.max(
      0,
      Math.min(srcMeta.height - oH, Math.round(focus.yCenter * srcMeta.height - oH / 2)),
    );
    return {
      filter: `[0:v]crop=${oW}:${oH}:${cropX}:${cropY}${outLabel}`,
      nextN: n + 1,
    };
  }

  if (fillMode === 'pad-blur') {
    const bgLabel = `[bg${n}]`;
    const fgLabel = `[fg${n}]`;
    const filter = [
      `[0:v]scale=${oW}:${oH}:force_original_aspect_ratio=decrease,boxblur=20${bgLabel}`,
      `[0:v]scale=${oW}:-2:force_original_aspect_ratio=decrease${fgLabel}`,
      `${bgLabel}${fgLabel}overlay=(W-w)/2:(H-h)/2${outLabel}`,
    ].join(';');
    return { filter, nextN: n + 1 };
  }

  // pad-black
  return {
    filter: `[0:v]scale=${oW}:-2:force_original_aspect_ratio=decrease,pad=${oW}:${oH}:(ow-iw)/2:(oh-ih)/2:black${outLabel}`,
    nextN: n + 1,
  };
}
