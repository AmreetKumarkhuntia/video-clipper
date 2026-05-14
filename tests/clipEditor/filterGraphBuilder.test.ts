import { describe, it, expect } from 'vitest';
import { buildFilterGraph } from '../../src/lib/services/video/clipper/editor/filterGraphBuilder.js';
import type { ClipEdits } from '../../src/lib/types/clipEdit.js';

function makeEdits(overrides: Partial<ClipEdits> = {}): ClipEdits {
  return {
    clipId: 'clip-abc',
    schemaVersion: 1,
    trim: { startSec: 0, endSec: 18 },
    viewport: {
      preset: '9:16',
      focus: { xCenter: 0.5, yCenter: 0.5 },
      fillMode: 'crop',
    },
    subtitles: [],
    overlays: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const SRC_1080P = { width: 1920, height: 1080, fps: 30 };

describe('buildFilterGraph', () => {
  describe('crop mode', () => {
    it('filterComplex contains crop filter', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(filterComplex).toContain('crop=');
    });

    it('centers crop when focus is 0.5/0.5 on 1920x1080 source for 9:16 (1080x1920 output)', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      // 9:16 output is 1080x1920; source is 1920x1080
      // cropX = clamp(0, 1920-1080, round(0.5*1920 - 1080/2)) = clamp(0,840, 420) = 420
      // cropY = clamp(0, 1080-1920, ...) => since 1080 < 1920, max is negative, clamps to 0
      expect(filterComplex).toContain('crop=1080:1920:420:0');
    });

    it('clamps crop X to valid range', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.0, yCenter: 0.5 }, fillMode: 'crop' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain(':0:');
    });

    it('uses 9:16 output resolution 1080x1920', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'crop' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('crop=1080:1920');
    });

    it('uses 16:9 output resolution 1920x1080', () => {
      const edits = makeEdits({
        viewport: { preset: '16:9', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'crop' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('crop=1920:1080');
    });

    it('uses 1:1 output resolution 1080x1080', () => {
      const edits = makeEdits({
        viewport: { preset: '1:1', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'crop' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('crop=1080:1080');
    });
  });

  describe('pad-blur mode', () => {
    it('contains boxblur filter', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'pad-blur' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('boxblur=20');
    });

    it('contains overlay filter', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'pad-blur' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('overlay=');
    });

    it('uses semicolons to separate filter branches', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'pad-blur' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex.split(';').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('pad-black mode', () => {
    it('contains pad filter with black color', () => {
      const edits = makeEdits({
        viewport: { preset: '9:16', focus: { xCenter: 0.5, yCenter: 0.5 }, fillMode: 'pad-black' },
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('pad=');
      expect(filterComplex).toContain(':black');
    });
  });

  describe('overlays', () => {
    it('chains drawtext filter for each overlay', () => {
      const edits = makeEdits({
        overlays: [
          {
            id: 'o1',
            kind: 'banner',
            startSec: 0,
            endSec: 5,
            text: 'Hey',
            position: { xCenter: 0.5, yCenter: 0.5 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('drawtext=');
    });

    it('advances map label with each overlay', () => {
      const edits = makeEdits({
        overlays: [
          {
            id: 'o1',
            kind: 'banner',
            startSec: 0,
            endSec: 5,
            text: 'A',
            position: { xCenter: 0.5, yCenter: 0.5 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
          {
            id: 'o2',
            kind: 'banner',
            startSec: 0,
            endSec: 5,
            text: 'B',
            position: { xCenter: 0.5, yCenter: 0.5 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { mapLabel } = buildFilterGraph(edits, SRC_1080P, null);
      expect(mapLabel).toBe('[v2]');
    });
  });

  describe('subtitles', () => {
    it('appends subtitles filter when assPath is provided and subtitles exist', () => {
      const edits = makeEdits({
        subtitles: [
          {
            id: 's1',
            startSec: 0,
            endSec: 2,
            text: 'hi',
            words: [],
            position: { xCenter: 0.5, yCenter: 0.85 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, '/tmp/test.ass');
      expect(filterComplex).toContain("subtitles='");
    });

    it('omits subtitles filter when assPath is null', () => {
      const edits = makeEdits({
        subtitles: [
          {
            id: 's1',
            startSec: 0,
            endSec: 2,
            text: 'hi',
            words: [],
            position: { xCenter: 0.5, yCenter: 0.85 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).not.toContain('subtitles=');
    });

    it('escapes colons in assPath', () => {
      const edits = makeEdits({
        subtitles: [
          {
            id: 's1',
            startSec: 0,
            endSec: 2,
            text: 'hi',
            words: [],
            position: { xCenter: 0.5, yCenter: 0.85 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, 'C:/Users/test.ass');
      expect(filterComplex).toContain('C\\:/Users/test.ass');
    });
  });

  describe('mapLabel', () => {
    it('returns a bracket-wrapped label like [v0]', () => {
      const { mapLabel } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(mapLabel).toMatch(/^\[v\d+\]$/);
    });

    it('reflects the number of filter steps applied', () => {
      const { mapLabel: noOverlays } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(noOverlays).toBe('[v0]');

      const edits = makeEdits({
        overlays: [
          {
            id: 'o1',
            kind: 'banner',
            startSec: 0,
            endSec: 5,
            text: 'A',
            position: { xCenter: 0.5, yCenter: 0.5 },
            style: {
              fontFamily: 'Inter',
              fontSize: 48,
              weight: 700,
              color: '#FFF',
              highlightColor: '#FFD60A',
              bgColor: null,
              bgPaddingX: 12,
              bgPaddingY: 6,
              bgRadius: 4,
              outlineColor: null,
              outlineWidth: 0,
              align: 'center',
            },
          },
        ],
      });
      const { mapLabel: oneOverlay } = buildFilterGraph(edits, SRC_1080P, null);
      expect(oneOverlay).toBe('[v1]');
    });
  });
});
