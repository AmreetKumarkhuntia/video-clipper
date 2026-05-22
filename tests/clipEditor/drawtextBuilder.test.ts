import { describe, it, expect } from 'vitest';
import { buildDrawtext } from '../../src/lib/services/video/clipper/editor/drawtextBuilder.js';
import type { TextOverlay } from '../../src/lib/types/clipEdit.js';

function makeOverlay(overrides: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: 'ov1',
    kind: 'banner',
    startSec: 1.0,
    endSec: 3.0,
    text: 'Hello',
    position: { xCenter: 0.5, yCenter: 0.5 },
    style: {
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
      align: 'center',
    },
    ...overrides,
  };
}

const OUTPUT = { width: 1080, height: 1920 };

describe('buildDrawtext', () => {
  it('produces a drawtext= fragment', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toMatch(/^drawtext=/);
  });

  it('includes enable expression with correct times', () => {
    const result = buildDrawtext(makeOverlay({ startSec: 2.5, endSec: 5.0 }), OUTPUT);
    expect(result).toContain("enable='between(t,2.5,5)'");
  });

  it('positions overlay at center of output when xCenter=0.5, yCenter=0.5', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toContain('x=(540-tw/2)');
    expect(result).toContain('y=(960-th/2)');
  });

  it('applies fontsize scaled to output dimensions', () => {
    // resolveRenderedFontSize(48, { width: 1080 }) = Math.round(48 * 0.045 * 1080 / 100) = 23
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toContain('fontsize=23');
  });

  it('applies fontcolor', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toContain('fontcolor=#FFFFFF');
  });

  it('includes borderw and bordercolor when outlineColor is set', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toContain('borderw=2');
    expect(result).toContain('bordercolor=#000000');
  });

  it('omits border fields when outlineColor is null', () => {
    const result = buildDrawtext(
      makeOverlay({
        style: {
          fontFamily: 'Inter',
          fontSize: 48,
          weight: 700,
          color: '#FFFFFF',
          highlightColor: '#FFD60A',
          bgColor: null,
          bgPaddingX: 12,
          bgPaddingY: 6,
          bgRadius: 4,
          outlineColor: null,
          outlineWidth: 2,
          align: 'center',
        },
      }),
      OUTPUT,
    );
    expect(result).not.toContain('borderw');
    expect(result).not.toContain('bordercolor');
  });

  it('includes box=1 when bgColor is set', () => {
    const result = buildDrawtext(
      makeOverlay({
        style: {
          fontFamily: 'Inter',
          fontSize: 48,
          weight: 700,
          color: '#FFFFFF',
          highlightColor: '#FFD60A',
          bgColor: '#FF0000',
          bgPaddingX: 12,
          bgPaddingY: 6,
          bgRadius: 4,
          outlineColor: null,
          outlineWidth: 0,
          align: 'center',
        },
      }),
      OUTPUT,
    );
    expect(result).toContain('box=1');
    expect(result).toContain('boxcolor=#FF0000');
  });

  it('omits box when bgColor is null', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).not.toContain('box=1');
    expect(result).not.toContain('boxcolor');
  });

  it('escapes special characters in text', () => {
    const result = buildDrawtext(makeOverlay({ text: "time:00's" }), OUTPUT);
    expect(result).toContain("time\\:00\\'s");
  });

  describe('crop-aware positioning', () => {
    it('maps xCenter/yCenter to the full frame when crop is default', () => {
      const result = buildDrawtext(makeOverlay(), OUTPUT);
      // xCenter=0.5 → 540 px; yCenter=0.5 → 960 px.
      expect(result).toContain('540-tw/2');
      expect(result).toContain('960-th/2');
    });

    it('maps xCenter/yCenter into the inner picture rect when crop is set', () => {
      const result = buildDrawtext(makeOverlay(), OUTPUT, 0, {
        top: 0.1,
        right: 0.1,
        bottom: 0.1,
        left: 0.1,
      });
      // Inner rect spans [108..972] horizontally and [192..1728] vertically.
      // xCenter=0.5 → 108 + 0.5*864 = 540 (unchanged, symmetric crop).
      // yCenter=0.5 → 192 + 0.5*1536 = 960 (unchanged).
      // To verify the math actually engages, use an asymmetric crop:
      const r2 = buildDrawtext(makeOverlay(), OUTPUT, 0, {
        top: 0.2,
        right: 0,
        bottom: 0,
        left: 0.1,
      });
      // xCenter=0.5 → 108 + 0.5*(1080-108-0) = 108 + 486 = 594.
      // yCenter=0.5 → 384 + 0.5*(1920-384-0) = 384 + 768 = 1152.
      expect(r2).toContain('594-tw/2');
      expect(r2).toContain('1152-th/2');
      // Sanity: the symmetric-crop result coincides with the no-crop result for center anchor.
      expect(result).toContain('540-tw/2');
    });
  });
});
