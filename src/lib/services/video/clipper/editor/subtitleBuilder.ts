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
  trimStartSec: number = 0,
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

  // Each subtitle may produce multiple dialogue events (one per word window + gaps)
  // so that exactly the currently-playing word is shown in highlightColor and all
  // others revert to style.color — matching the canvas activeWordIndex behaviour.
  const dialogueLines = subtitles.flatMap((sub) => buildWordEvents(sub, output, trimStartSec));

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
): string[] {
  const marginV = Math.round((1 - sub.position.yCenter) * output.height);
  const { marginL, marginR } = alignMargins(sub.style.align, output.width);

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
