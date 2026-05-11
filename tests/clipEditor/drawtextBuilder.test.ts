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

  it('applies fontsize', () => {
    const result = buildDrawtext(makeOverlay(), OUTPUT);
    expect(result).toContain('fontsize=48');
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
});
