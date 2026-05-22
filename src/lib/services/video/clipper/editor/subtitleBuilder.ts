import type { CropRect, SubtitleLine } from '@lib/types/clipEdit.js';
import { resolveRenderedFontSize } from '@lib/utils/textScale.js';
import { escapeAss } from './textEscape.js';

const ZERO_CROP: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };

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
 * Canvas uses `width: 90%` centered inside the inner picture area (the rect inside the crop
 * bars), so the text block has 5% margins on each side of the inner area. Mirror that in ASS
 * by shifting margins by `crop.left/right` and adding a 5%-of-inner inset for left/right align.
 */
function alignMargins(
  align: 'left' | 'center' | 'right',
  outputWidth: number,
  crop: CropRect,
): { marginL: number; marginR: number } {
  const innerW = outputWidth * (1 - crop.left - crop.right);
  const baseL = Math.round(crop.left * outputWidth);
  const baseR = Math.round(crop.right * outputWidth);
  const inset = Math.round(0.05 * innerW);
  if (align === 'left') return { marginL: baseL + inset, marginR: baseR };
  if (align === 'right') return { marginL: baseL, marginR: baseR + inset };
  return { marginL: baseL, marginR: baseR };
}

/**
 * Vertical margin in ASS (PlayResY pixels) for a subtitle whose `yCenter` is expressed in
 * inner-picture coordinates (0 = top of picture area, 1 = bottom). Equivalent to the canvas's
 * `bottom: (1-yCenter)*100%` measured against the inner picture container.
 */
function verticalMargin(yCenter: number, outputHeight: number, crop: CropRect): number {
  return Math.round(outputHeight * (crop.bottom + (1 - yCenter) * (1 - crop.top - crop.bottom)));
}

export function buildAss(
  subtitles: SubtitleLine[],
  output: { width: number; height: number },
  trimStartSec: number = 0,
  crop: CropRect = ZERO_CROP,
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
    const bc = sc.bgColor ? cssToAssColor(sc.bgColor) : '&H00000000';
    const b = sc.weight >= 600 ? -1 : 0;
    const marginV = verticalMargin(sub.position.yCenter, output.height, crop);
    const renderedSize = resolveRenderedFontSize(sc.fontSize, output);
    const alignment = alignToAssCode(sc.align);
    const { marginL, marginR } = alignMargins(sc.align, output.width, crop);
    // BorderStyle=3 renders an opaque background box; Outline field becomes box padding.
    // BorderStyle=1 renders text outline (normal mode).
    const borderStyle = sc.bgColor ? 3 : 1;
    const outlineField = sc.bgColor ? sc.bgPaddingX : sc.outlineWidth;
    return `Style: ${sub.id},${sc.fontFamily},${renderedSize},${pc},&H00FFFFFF,${oc},${bc},${b},0,0,0,100,100,0,0,${borderStyle},${outlineField},0,${alignment},${marginL},${marginR},${marginV},1`;
  });

  // Each subtitle may produce multiple dialogue events (one per word window + gaps)
  // so that exactly the currently-playing word is shown in highlightColor and all
  // others revert to style.color — matching the canvas activeWordIndex behaviour.
  const dialogueLines = subtitles.flatMap((sub) =>
    buildWordEvents(sub, output, trimStartSec, crop),
  );

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

/**
 * Build one or more ASS Dialogue events for a subtitle line.
 *
 * Strategy: generate a separate event for each word's active time window, with only
 * that word overridden to highlightColor (\\1c). All other words use the style's
 * PrimaryColour (= style.color) by having no override. Gap periods between/around
 * words also get an event showing all words in the base colour.
 *
 * This is the only reliable way to match the canvas behaviour (activeWordIndex) in
 * libass: \\1c is a static text-position override and cannot be made time-dependent
 * within a single dialogue event, so a per-word-window event approach is required.
 *
 * All timestamps are shifted by trimStartSec so they reference the output video's
 * 0-based timeline rather than the original clip's absolute timeline.
 */
function buildWordEvents(
  sub: SubtitleLine,
  output: { width: number; height: number },
  trimStartSec: number,
  crop: CropRect,
): string[] {
  const marginV = verticalMargin(sub.position.yCenter, output.height, crop);
  const { marginL, marginR } = alignMargins(sub.style.align, output.width, crop);

  // Shift subtitle window into the output (trimmed) timeline.
  // Clamp the start to ≥ 0 — a subtitle that began before the trim start
  // will simply begin at the first frame of the output.
  const subStart = Math.max(0, sub.startSec - trimStartSec);
  const subEnd = Math.max(0, sub.endSec - trimStartSec);

  // Skip subtitles that fall entirely outside the output window.
  if (subStart >= subEnd) return [];

  const makeEvent = (startSec: number, endSec: number, text: string): string =>
    `Dialogue: 0,${secToAssTime(startSec)},${secToAssTime(endSec)},${sub.id},,${marginL},${marginR},${marginV},,${text}`;

  // No word timing: single event for the full duration, plain text.
  if (sub.words.length === 0) {
    return [makeEvent(subStart, subEnd, escapeAss(sub.text))];
  }

  const highlightColor = cssToAssColor(sub.style.highlightColor);

  /** All words joined in the style's base colour (no override tags). */
  const allBase = (): string => sub.words.map((w) => escapeAss(w.text)).join(' ');

  /**
   * Build text for the window when word[activeIdx] is playing:
   * – words before activeIdx: no override → PrimaryColour (base)
   * – word[activeIdx]: \\1c{highlightColor} … \\r resets to base after
   * – words after activeIdx: no override → PrimaryColour (base)
   */
  const withActive = (activeIdx: number): string =>
    sub.words
      .map((w, i) => {
        const escaped = escapeAss(w.text);
        if (i === activeIdx) return `{\\1c${highlightColor}}${escaped}{\\r}`;
        return escaped;
      })
      .join(' ');

  const events: string[] = [];
  let cursor = subStart;

  for (let wi = 0; wi < sub.words.length; wi++) {
    const word = sub.words[wi];
    // Offset word timestamps and clamp to the subtitle's (already-shifted) window.
    const wordStart = Math.max(subStart, word.startSec - trimStartSec);
    const wordEnd = Math.min(subEnd, word.endSec - trimStartSec);

    if (wordStart >= wordEnd) continue; // word outside the output window — skip

    // Gap before this word: all words in base colour.
    if (wordStart > cursor) {
      events.push(makeEvent(cursor, wordStart, allBase()));
    }

    // Word active window: only this word in highlightColor.
    events.push(makeEvent(wordStart, wordEnd, withActive(wi)));

    cursor = wordEnd;
  }

  // Gap after the last word (or if no words overlapped the subtitle window).
  if (cursor < subEnd) {
    events.push(makeEvent(cursor, subEnd, allBase()));
  }

  return events;
}
