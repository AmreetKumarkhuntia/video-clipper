import type { TextOverlay } from '@lib/types/clipEdit.js';
import { resolveRenderedFontSize } from '@lib/utils/textScale.js';
import { escapeDrawtext } from './textEscape.js';

export function buildDrawtext(
  overlay: TextOverlay,
  output: { width: number; height: number },
): string {
  const xPx = Math.round(overlay.position.xCenter * output.width);
  const yPx = Math.round(overlay.position.yCenter * output.height);
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

  const parts: string[] = [
    `text='${escapeDrawtext(overlay.text)}'`,
    `enable='between(t,${overlay.startSec},${overlay.endSec})'`,
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
    parts.push(`boxborderw=4`);
  }

  return `drawtext=${parts.join(':')}`;
}
