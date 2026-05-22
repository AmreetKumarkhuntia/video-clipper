import { describe, it, expect } from 'vitest';
import { buildFilterGraph } from '../../src/lib/services/video/clipper/editor/filterGraphBuilder.js';
import type { ClipEdits, Viewport } from '../../src/lib/types/clipEdit.js';

const DEFAULT_VIEWPORT: Viewport = {
  preset: '9:16',
  focus: { xCenter: 0.5, yCenter: 0.5 },
  fillMode: 'crop',
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  placement: { offsetX: 0, offsetY: 0, scale: 1 },
};

function makeEdits(overrides: Partial<ClipEdits> = {}): ClipEdits {
  return {
    clipId: 'clip-abc',
    schemaVersion: 1,
    trim: { startSec: 0, endSec: 18 },
    viewport: DEFAULT_VIEWPORT,
    subtitles: [],
    overlays: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function viewport(partial: Partial<Viewport>): Viewport {
  return { ...DEFAULT_VIEWPORT, ...partial };
}

const SRC_1080P = { width: 1920, height: 1080, fps: 30 };

describe('buildFilterGraph', () => {
  describe('crop mode (no freeform crop)', () => {
    it('scales to cover output and crops to output dims', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(filterComplex).toContain('scale=1080:1920:force_original_aspect_ratio=increase');
      expect(filterComplex).toContain('crop=1080:1920');
    });

    it('uses focus center to position the crop window', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(filterComplex).toContain('(iw-1080)*0.5');
      expect(filterComplex).toContain('(ih-1920)*0.5');
    });

    it('clamps focus to [0,1]', () => {
      const edits = makeEdits({
        viewport: viewport({ focus: { xCenter: -0.5, yCenter: 1.5 } }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('(iw-1080)*0');
      expect(filterComplex).toContain('(ih-1920)*1');
    });

    it('uses 16:9 output resolution 1920x1080', () => {
      const edits = makeEdits({ viewport: viewport({ preset: '16:9' }) });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('scale=1920:1080:force_original_aspect_ratio=increase');
    });

    it('uses 1:1 output resolution 1080x1080', () => {
      const edits = makeEdits({ viewport: viewport({ preset: '1:1' }) });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('scale=1080:1080:force_original_aspect_ratio=increase');
    });
  });

  describe('freeform crop (mask edges, no zoom)', () => {
    it('does not emit a source-dim crop filter when any edge is non-zero', () => {
      const edits = makeEdits({
        viewport: viewport({ crop: { top: 0.1, right: 0, bottom: 0.1, left: 0 } }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      // The freeform crop must NOT touch the source — i.e. the source's full width (1920)
      // should never appear as the W argument of a crop filter.
      expect(filterComplex).not.toMatch(/crop=1920:/);
    });

    it('emits an output-dim crop + pad pair to paint black bars on cropped edges', () => {
      const edits = makeEdits({
        viewport: viewport({ crop: { top: 0.1, right: 0, bottom: 0.1, left: 0 } }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      // 9:16 output is 1080x1920. ih = round(1920 * 0.8) = 1536; cy = round(1920*0.1) = 192.
      expect(filterComplex).toContain('crop=1080:1536:0:192');
      expect(filterComplex).toContain('pad=1080:1920:0:192:black');
    });

    it('skips the crop+pad pair entirely at default (fast-path)', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      // No black-bar pad after the fit stage when crop is default.
      expect(filterComplex).not.toContain(':black');
    });

    it('still honors focus when freeform crop is non-default', () => {
      const edits = makeEdits({
        viewport: viewport({
          crop: { top: 0.1, right: 0, bottom: 0.1, left: 0 },
          focus: { xCenter: 0.25, yCenter: 0.75 },
        }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      // The fit-stage focus expression must still be present — crop and focus are orthogonal.
      expect(filterComplex).toContain('(iw-1080)*0.25');
      expect(filterComplex).toContain('(ih-1920)*0.75');
    });
  });

  describe('placement', () => {
    it('skips placement filters at identity', () => {
      const { filterComplex } = buildFilterGraph(makeEdits(), SRC_1080P, null);
      expect(filterComplex).not.toContain('scale=2160');
      expect(filterComplex).not.toContain('scale=540');
    });

    it('scale > 1 emits an upscale and crop-back-to-output', () => {
      const edits = makeEdits({
        viewport: viewport({ placement: { offsetX: 0, offsetY: 0, scale: 2 } }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('scale=2160:3840');
      expect(filterComplex).toMatch(/crop=1080:1920:\d+:\d+/);
    });

    it('scale < 1 emits a downscale and a pad with black background', () => {
      const edits = makeEdits({
        viewport: viewport({ placement: { offsetX: 0, offsetY: 0, scale: 0.5 } }),
      });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('scale=540:960');
      expect(filterComplex).toMatch(/pad=1080:1920:\d+:\d+:black/);
    });

    it('offset shifts the crop window for scale > 1', () => {
      const eCentered = makeEdits({
        viewport: viewport({ placement: { offsetX: 0, offsetY: 0, scale: 2 } }),
      });
      const eShifted = makeEdits({
        viewport: viewport({ placement: { offsetX: 0.1, offsetY: 0, scale: 2 } }),
      });
      const a = buildFilterGraph(eCentered, SRC_1080P, null).filterComplex;
      const b = buildFilterGraph(eShifted, SRC_1080P, null).filterComplex;
      expect(a).not.toBe(b);
    });
  });

  describe('pad-blur mode', () => {
    it('contains boxblur filter', () => {
      const edits = makeEdits({ viewport: viewport({ fillMode: 'pad-blur' }) });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('boxblur=20');
    });

    it('contains overlay filter', () => {
      const edits = makeEdits({ viewport: viewport({ fillMode: 'pad-blur' }) });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex).toContain('overlay=');
    });

    it('uses semicolons to separate filter branches', () => {
      const edits = makeEdits({ viewport: viewport({ fillMode: 'pad-blur' }) });
      const { filterComplex } = buildFilterGraph(edits, SRC_1080P, null);
      expect(filterComplex.split(';').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('pad-black mode', () => {
    it('contains pad filter with black color', () => {
      const edits = makeEdits({ viewport: viewport({ fillMode: 'pad-black' }) });
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
