import type { CropRect, TextOverlay } from '@lib/types/clipEdit.js';
import { resolveRenderedFontSize } from '@lib/utils/textScale.js';
import { escapeDrawtext } from './textEscape.js';

const ZERO_CROP: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };

export function buildDrawtext(
  overlay: TextOverlay,
  output: { width: number; height: number },
  trimStartSec: number = 0,
  crop: CropRect = ZERO_CROP,
): string {
  // Map xCenter/yCenter from inner-picture coordinates to output pixel coordinates, so the
  // overlay anchors to the visible picture rect (not the full output frame).
  const innerX = crop.left + overlay.position.xCenter * (1 - crop.left - crop.right);
  const innerY = crop.top + overlay.position.yCenter * (1 - crop.top - crop.bottom);
  const xPx = Math.round(innerX * output.width);
  const yPx = Math.round(innerY * output.height);
  const renderedSize = resolveRenderedFontSize(overlay.style.fontSize, output);

  // Mirror the canvas transform: translate(-50%, -50%) for center, (0, -50%) for left,
  // (-100%, -50%) for right — so xCenter is always the semantic anchor.
  let xExpr: string;
  if (overlay.style.align === 'left') {
    xExpr = `${xPx}`;
  } else if (overlay.style.align === 'right') {
    xExpr = `(${xPx}-tw)`;
  } else {
    xExpr = `(${xPx}-tw/2)`;
  }

  // Shift the enable window into the output (trimmed) timeline so the overlay
  // appears at the correct time relative to the 0-based output video.
  const enableStart = Math.max(0, overlay.startSec - trimStartSec);
  const enableEnd = Math.max(0, overlay.endSec - trimStartSec);

  const parts: string[] = [
    `text='${escapeDrawtext(overlay.text)}'`,
    `enable='between(t,${enableStart},${enableEnd})'`,
    `x=${xExpr}`,
    `y=(${yPx}-th/2)`,
    `fontsize=${renderedSize}`,
    `fontcolor=${overlay.style.color}`,
  ];

  if (overlay.style.outlineColor !== null) {
    parts.push(`borderw=${overlay.style.outlineWidth}`);
    parts.push(`bordercolor=${overlay.style.outlineColor}`);
  }

  if (overlay.style.bgColor !== null) {
    parts.push(`box=1`);
    parts.push(`boxcolor=${overlay.style.bgColor}`);
    parts.push(`boxborderw=${overlay.style.bgPaddingX}`);
  }

  return `drawtext=${parts.join(':')}`;
}
