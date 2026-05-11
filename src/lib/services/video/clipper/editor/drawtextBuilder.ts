import type { TextOverlay } from '@lib/types/clipEdit.js';
import { escapeDrawtext } from './textEscape.js';

export function buildDrawtext(
  overlay: TextOverlay,
  output: { width: number; height: number },
): string {
  const xPx = Math.round(overlay.position.xCenter * output.width);
  const yPx = Math.round(overlay.position.yCenter * output.height);

  const parts: string[] = [
    `text='${escapeDrawtext(overlay.text)}'`,
    `enable='between(t,${overlay.startSec},${overlay.endSec})'`,
    `x=(${xPx}-tw/2)`,
    `y=(${yPx}-th/2)`,
    `fontsize=${overlay.style.fontSize}`,
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
