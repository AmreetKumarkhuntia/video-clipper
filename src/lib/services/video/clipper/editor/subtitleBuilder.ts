import type { SubtitleLine } from '@lib/types/clipEdit.js';
import { resolveRenderedFontSize } from '@lib/utils/textScale.js';
import { escapeAss } from './textEscape.js';

function cssToAssColor(hex: string): string {
  const h = hex.replace('#', '');
  const rr = h.slice(0, 2);
  const gg = h.slice(2, 4);
  const bb = h.slice(4, 6);
  return `&H00${bb}${gg}${rr}`.toUpperCase();
}

function secToAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Map style.align to ASS numpad alignment (bottom row: 1=left, 2=center, 3=right). */
function alignToAssCode(align: 'left' | 'center' | 'right'): number {
  if (align === 'left') return 1;
  if (align === 'right') return 3;
  return 2; // center
}

/**
 * Canvas uses `width: 90%` centered, so the text block has 5% margins on each side.
 * Mirror those margins in ASS so left/right aligned text matches the canvas anchor.
 */
function alignMargins(
  align: 'left' | 'center' | 'right',
  outputWidth: number,
): { marginL: number; marginR: number } {
  const margin = Math.round(0.05 * outputWidth);
  if (align === 'left') return { marginL: margin, marginR: 0 };
  if (align === 'right') return { marginL: 0, marginR: margin };
  return { marginL: 0, marginR: 0 };
}

export function buildAss(
  subtitles: SubtitleLine[],
  output: { width: number; height: number },
): string {
  if (subtitles.length === 0) {
    return (
      buildHeader(output) +
      '\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
    );
  }

  const styleLines = subtitles.map((sub) => {
    const sc = sub.style;
    const pc = cssToAssColor(sc.color);
    const oc = sc.outlineColor ? cssToAssColor(sc.outlineColor) : '&H00000000';
    const b = sc.weight >= 600 ? -1 : 0;
    const marginV = Math.round((1 - sub.position.yCenter) * output.height);
    const renderedSize = resolveRenderedFontSize(sc.fontSize, output);
    const alignment = alignToAssCode(sc.align);
    const { marginL, marginR } = alignMargins(sc.align, output.width);
    return `Style: ${sub.id},${sc.fontFamily},${renderedSize},${pc},&H00FFFFFF,${oc},&H00000000,${b},0,0,0,100,100,0,0,1,${sc.outlineWidth},0,${alignment},${marginL},${marginR},${marginV},1`;
  });

  const dialogueLines = subtitles.map((sub) => {
    const start = secToAssTime(sub.startSec);
    const end = secToAssTime(sub.endSec);
    const marginV = Math.round((1 - sub.position.yCenter) * output.height);
    const { marginL, marginR } = alignMargins(sub.style.align, output.width);
    const text = buildKaraokeText(sub);
    return `Dialogue: 0,${start},${end},${sub.id},,${marginL},${marginR},${marginV},,${text}`;
  });

  const lines = [
    buildHeader(output),
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styleLines,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...dialogueLines,
  ];

  return lines.join('\n') + '\n';
}

function buildHeader(output: { width: number; height: number }): string {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${output.width}`,
    `PlayResY: ${output.height}`,
    'WrapStyle: 0',
    '',
  ].join('\n');
}

function buildKaraokeText(sub: SubtitleLine): string {
  if (sub.words.length === 0) {
    return escapeAss(sub.text);
  }

  const highlightBgr = cssToAssColor(sub.style.highlightColor).replace('&H00', '');

  return sub.words
    .map((word) => {
      const cs = Math.round((word.endSec - word.startSec) * 100);
      const escaped = escapeAss(word.text);
      if (word.highlight) {
        return `{\\1c&H${highlightBgr}&\\k${cs}}${escaped}{\\r}`;
      }
      return `{\\k${cs}}${escaped}`;
    })
    .join(' ');
}
