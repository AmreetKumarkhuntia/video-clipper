import { describe, it, expect } from 'vitest';
import { parseVtt } from '../src/services/transcriptAnalyzers/ytdlp.js';

const BASIC_VTT = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:03.500
Hello world

00:00:04.000 --> 00:00:06.000
This is a test

`;

const INLINE_TAGS_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
<00:00:01.000><c>Hello</c> <00:00:02.000><c>world</c>

00:00:05.000 --> 00:00:08.000
<c>Some</c> <c>tagged</c> <c>text</c>

`;

const DUPLICATE_CUES_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
Repeated line

00:00:02.000 --> 00:00:04.000
Repeated line

00:00:04.000 --> 00:00:06.000
New line

`;

const HTML_ENTITIES_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello &amp; world

00:00:04.000 --> 00:00:06.000
&lt;tag&gt; content

`;

const MULTILINE_CUE_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
First line
Second line

`;

const EMPTY_CUES_VTT = `WEBVTT

00:00:01.000 --> 00:00:03.000
<c></c>

00:00:04.000 --> 00:00:06.000
Real content

`;

const HOURS_VTT = `WEBVTT

01:30:00.000 --> 01:30:05.500
Deep into the video

`;

const COMMA_SEPARATOR_VTT = `WEBVTT

00:00:01,000 --> 00:00:03,500
Comma separated timestamps

`;

describe('parseVtt', () => {
  describe('basic parsing', () => {
    it('parses a standard VTT with two cues', () => {
      const result = parseVtt(BASIC_VTT);
      expect(result).toHaveLength(2);
    });

    it('normalizes timestamps to seconds', () => {
      const result = parseVtt(BASIC_VTT);
      expect(result[0].start).toBeCloseTo(1.0);
      expect(result[0].duration).toBeCloseTo(2.5);
      expect(result[1].start).toBeCloseTo(4.0);
      expect(result[1].duration).toBeCloseTo(2.0);
    });

    it('preserves cue text', () => {
      const result = parseVtt(BASIC_VTT);
      expect(result[0].text).toBe('Hello world');
      expect(result[1].text).toBe('This is a test');
    });
  });

  describe('inline tag stripping', () => {
    it('strips VTT timestamp tags and <c> tags', () => {
      const result = parseVtt(INLINE_TAGS_VTT);
      expect(result[0].text).toBe('Hello world');
      expect(result[1].text).toBe('Some tagged text');
    });
  });

  describe('deduplication', () => {
    it('skips consecutive duplicate cue text', () => {
      const result = parseVtt(DUPLICATE_CUES_VTT);
      // "Repeated line" should appear only once
      expect(result.filter((l) => l.text === 'Repeated line')).toHaveLength(1);
    });

    it('keeps non-duplicate cues after duplicates', () => {
      const result = parseVtt(DUPLICATE_CUES_VTT);
      expect(result[result.length - 1].text).toBe('New line');
    });
  });

  describe('HTML entity decoding', () => {
    it('decodes &amp;', () => {
      const result = parseVtt(HTML_ENTITIES_VTT);
      expect(result[0].text).toBe('Hello & world');
    });

    it('decodes &lt; and &gt;', () => {
      const result = parseVtt(HTML_ENTITIES_VTT);
      expect(result[1].text).toBe('<tag> content');
    });
  });

  describe('multiline cues', () => {
    it('joins multiple text lines within a cue with a space', () => {
      const result = parseVtt(MULTILINE_CUE_VTT);
      expect(result[0].text).toBe('First line Second line');
    });
  });

  describe('empty cues', () => {
    it('skips cues that are empty after tag stripping', () => {
      const result = parseVtt(EMPTY_CUES_VTT);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Real content');
    });
  });

  describe('timestamp formats', () => {
    it('handles HH:MM:SS.mmm with large hours', () => {
      const result = parseVtt(HOURS_VTT);
      expect(result[0].start).toBeCloseTo(1 * 3600 + 30 * 60);
      expect(result[0].duration).toBeCloseTo(5.5);
    });

    it('handles comma as decimal separator in timestamps', () => {
      const result = parseVtt(COMMA_SEPARATOR_VTT);
      expect(result[0].start).toBeCloseTo(1.0);
      expect(result[0].duration).toBeCloseTo(2.5);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseVtt('')).toEqual([]);
    });

    it('returns empty array for WEBVTT header only', () => {
      expect(parseVtt('WEBVTT\n')).toEqual([]);
    });

    it('returns empty array when all cues are empty after stripping', () => {
      const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<c></c>\n\n';
      expect(parseVtt(vtt)).toEqual([]);
    });
  });
});
