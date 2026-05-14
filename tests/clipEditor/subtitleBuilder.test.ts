import { describe, it, expect } from 'vitest';
import { buildAss } from '../../src/lib/services/video/clipper/editor/subtitleBuilder.js';
import type { SubtitleLine } from '../../src/lib/types/clipEdit.js';

const DEFAULT_STYLE = {
  fontFamily: 'Inter',
  fontSize: 48,
  weight: 700,
  color: '#FFFFFF',
  highlightColor: '#FFD60A',
  bgColor: null,
  bgPaddingX: 12,
  bgPaddingY: 6,
  bgRadius: 4,
  outlineColor: '#000000',
  outlineWidth: 2,
  align: 'center' as const,
};

const DEFAULT_POSITION = { xCenter: 0.5, yCenter: 0.85 };

function makeSubtitle(overrides: Partial<SubtitleLine> = {}): SubtitleLine {
  return {
    id: 'sub1',
    startSec: 0.3,
    endSec: 2.4,
    text: 'Hello there',
    words: [],
    position: DEFAULT_POSITION,
    style: DEFAULT_STYLE,
    ...overrides,
  };
}

const OUTPUT = { width: 1080, height: 1920 };

describe('buildAss', () => {
  describe('script info section', () => {
    it('sets PlayResX and PlayResY from output dimensions', () => {
      const result = buildAss([makeSubtitle()], OUTPUT);
      expect(result).toContain('PlayResX: 1080');
      expect(result).toContain('PlayResY: 1920');
    });

    it('sets ScriptType to v4.00+', () => {
      const result = buildAss([makeSubtitle()], OUTPUT);
      expect(result).toContain('ScriptType: v4.00+');
    });
  });

  describe('styles section', () => {
    it('converts CSS hex color #FFFFFF to ASS &H00FFFFFF format (white)', () => {
      const result = buildAss([makeSubtitle()], OUTPUT);
      expect(result).toContain('&H00FFFFFF');
    });

    it('converts CSS hex color #FF0000 (red) to ASS &H000000FF (BGR reversed)', () => {
      const sub = makeSubtitle({ style: { ...DEFAULT_STYLE, color: '#FF0000' } });
      const result = buildAss([sub], OUTPUT);
      expect(result).toContain('&H000000FF');
    });

    it('maps weight>=600 to Bold=-1', () => {
      const sub = makeSubtitle({ style: { ...DEFAULT_STYLE, weight: 700 } });
      const result = buildAss([sub], OUTPUT);
      const styleLine = result.split('\n').find((l) => l.startsWith('Style:'));
      expect(styleLine).toBeDefined();
      expect(styleLine).toContain(',-1,');
    });

    it('maps weight<600 to Bold=0', () => {
      const sub = makeSubtitle({ style: { ...DEFAULT_STYLE, weight: 400 } });
      const result = buildAss([sub], OUTPUT);
      const styleLine = result.split('\n').find((l) => l.startsWith('Style:'));
      expect(styleLine).toBeDefined();
      expect(styleLine).toContain(',0,');
    });

    it('sets MarginV from yCenter position', () => {
      const sub = makeSubtitle({ position: { xCenter: 0.5, yCenter: 0.85 } });
      const result = buildAss([sub], OUTPUT);
      const expectedMarginV = Math.round((1 - 0.85) * 1920);
      expect(result).toContain(String(expectedMarginV));
    });
  });

  describe('events section', () => {
    it('emits one Dialogue per subtitle', () => {
      const subs = [makeSubtitle({ id: 'a' }), makeSubtitle({ id: 'b', startSec: 3, endSec: 5 })];
      const result = buildAss(subs, OUTPUT);
      const dialogues = result.split('\n').filter((l) => l.startsWith('Dialogue:'));
      expect(dialogues).toHaveLength(2);
    });

    it('formats start/end times as H:MM:SS.cc', () => {
      const sub = makeSubtitle({ startSec: 0.3, endSec: 2.4 });
      const result = buildAss([sub], OUTPUT);
      expect(result).toContain('0:00:00.30');
      expect(result).toContain('0:00:02.40');
    });

    it('emits plain text when words array is empty', () => {
      const sub = makeSubtitle({ text: 'Hello world', words: [] });
      const result = buildAss([sub], OUTPUT);
      const dialogue = result.split('\n').find((l) => l.startsWith('Dialogue:'))!;
      expect(dialogue).toContain('Hello world');
      expect(dialogue).not.toContain('\\k');
    });

    it('emits one Dialogue event per word window (multi-event approach)', () => {
      const sub = makeSubtitle({
        words: [
          { text: 'Hi', startSec: 0.3, endSec: 0.8, highlight: false },
          { text: 'there', startSec: 0.8, endSec: 1.4, highlight: false },
        ],
      });
      const result = buildAss([sub], OUTPUT);
      const dialogues = result.split('\n').filter((l) => l.startsWith('Dialogue:'));
      // One event per word + a trailing gap event (1.4 → 2.4)
      expect(dialogues.length).toBeGreaterThanOrEqual(2);
      // First event: Hi is active — must carry \1c highlight; there is plain
      expect(dialogues[0]).toContain('\\1c');
      expect(dialogues[0]).toContain('Hi');
      // No \k karaoke tags in any event
      expect(result).not.toContain('\\k');
    });

    it('applies highlight color tag to highlighted words', () => {
      const sub = makeSubtitle({
        style: { ...DEFAULT_STYLE, highlightColor: '#FFD60A' },
        words: [{ text: 'Hi', startSec: 0.3, endSec: 0.8, highlight: true }],
      });
      const result = buildAss([sub], OUTPUT);
      const dialogue = result.split('\n').find((l) => l.startsWith('Dialogue:'))!;
      expect(dialogue).toContain('\\1c&H');
      expect(dialogue).toContain('Hi');
    });

    it('resets style after highlighted word with \\r', () => {
      const sub = makeSubtitle({
        words: [
          { text: 'Hi', startSec: 0.3, endSec: 0.8, highlight: true },
          { text: 'there', startSec: 0.8, endSec: 1.4, highlight: false },
        ],
      });
      const result = buildAss([sub], OUTPUT);
      const dialogue = result.split('\n').find((l) => l.startsWith('Dialogue:'))!;
      expect(dialogue).toContain('{\\r}');
    });

    it('escapes ASS special characters in text', () => {
      const sub = makeSubtitle({ text: 'a{b}c', words: [] });
      const result = buildAss([sub], OUTPUT);
      const dialogue = result.split('\n').find((l) => l.startsWith('Dialogue:'))!;
      expect(dialogue).toContain('a\\{b\\}c');
    });
  });

  describe('edge cases', () => {
    it('returns empty events block for empty subtitles array', () => {
      const result = buildAss([], OUTPUT);
      expect(result).toContain('[Events]');
      const dialogues = result.split('\n').filter((l) => l.startsWith('Dialogue:'));
      expect(dialogues).toHaveLength(0);
    });

    it('handles subtitle with single word', () => {
      const sub = makeSubtitle({
        words: [{ text: 'Hi', startSec: 0.3, endSec: 0.8, highlight: false }],
      });
      const result = buildAss([sub], OUTPUT);
      const dialogues = result.split('\n').filter((l) => l.startsWith('Dialogue:'));
      // Active event for the word window + gap event for remainder
      expect(dialogues.length).toBeGreaterThanOrEqual(1);
      expect(dialogues[0]).toContain('\\1c');
      expect(dialogues[0]).toContain('Hi');
      expect(result).not.toContain('\\k');
    });
  });
});
