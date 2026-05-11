import { describe, it, expect } from 'vitest';
import {
  escapeDrawtext,
  escapeAss,
} from '../../src/lib/services/video/clipper/editor/textEscape.js';

describe('escapeDrawtext', () => {
  it('leaves plain text untouched', () => {
    expect(escapeDrawtext('hello world')).toBe('hello world');
  });

  it('escapes backslash before other chars', () => {
    expect(escapeDrawtext('a\\b')).toBe('a\\\\b');
  });

  it('escapes colon', () => {
    expect(escapeDrawtext('time:00')).toBe('time\\:00');
  });

  it('escapes single quote', () => {
    expect(escapeDrawtext("it's")).toBe("it\\'s");
  });

  it('escapes percent', () => {
    expect(escapeDrawtext('100%')).toBe('100\\%');
  });

  it('handles multiple special chars in sequence', () => {
    expect(escapeDrawtext("a:b'c%d\\e")).toBe("a\\:b\\'c\\%d\\\\e");
  });

  it('handles empty string', () => {
    expect(escapeDrawtext('')).toBe('');
  });

  it('escapes backslash before colon independently', () => {
    expect(escapeDrawtext('a\\:b')).toBe('a\\\\\\:b');
  });
});

describe('escapeAss', () => {
  it('leaves plain text untouched', () => {
    expect(escapeAss('hello world')).toBe('hello world');
  });

  it('escapes backslash', () => {
    expect(escapeAss('a\\b')).toBe('a\\\\b');
  });

  it('escapes opening curly brace', () => {
    expect(escapeAss('a{b')).toBe('a\\{b');
  });

  it('escapes closing curly brace', () => {
    expect(escapeAss('a}b')).toBe('a\\}b');
  });

  it('converts newline character to \\N', () => {
    expect(escapeAss('line1\nline2')).toBe('line1\\Nline2');
  });

  it('handles empty string', () => {
    expect(escapeAss('')).toBe('');
  });

  it('escapes backslash before curly brace independently', () => {
    expect(escapeAss('a\\{b')).toBe('a\\\\\\{b');
  });
});
