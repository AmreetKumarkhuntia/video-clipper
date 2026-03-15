import { describe, it, expect } from 'vitest';
import { parseUrl } from '../src/services/urlParser/index.js';

describe('parseUrl', () => {
  describe('valid URLs', () => {
    it('parses a standard youtube.com/watch URL', () => {
      expect(parseUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/watch URL without www', () => {
      expect(parseUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtu.be short URL', () => {
      expect(parseUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtu.be URL with extra query params', () => {
      expect(parseUrl('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/embed URL', () => {
      expect(parseUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/shorts URL', () => {
      expect(parseUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a watch URL with additional query params', () => {
      expect(parseUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLxxx')).toBe(
        'dQw4w9WgXcQ',
      );
    });
  });

  describe('invalid URLs', () => {
    it('throws on a completely invalid string', () => {
      expect(() => parseUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('throws on a non-YouTube URL', () => {
      expect(() => parseUrl('https://vimeo.com/123456789')).toThrow('Could not extract video ID');
    });

    it('throws on a YouTube URL with no video ID', () => {
      expect(() => parseUrl('https://www.youtube.com/watch')).toThrow('Could not extract video ID');
    });

    it('throws on a YouTube URL with an empty video ID', () => {
      expect(() => parseUrl('https://www.youtube.com/watch?v=')).toThrow();
    });

    it('throws if the video ID is shorter than 11 characters', () => {
      expect(() => parseUrl('https://www.youtube.com/watch?v=short')).toThrow(
        'expected 11 characters',
      );
    });

    it('throws if the video ID is longer than 11 characters', () => {
      expect(() => parseUrl('https://www.youtube.com/watch?v=toolongvideoid')).toThrow(
        'expected 11 characters',
      );
    });

    it('throws on an empty string', () => {
      expect(() => parseUrl('')).toThrow('Invalid URL');
    });
  });
});
