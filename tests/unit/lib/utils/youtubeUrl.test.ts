import { describe, it, expect } from 'vitest';
import { parseVideoId } from '@lib/utils/youtubeUrl.js';

describe('parseVideoId', () => {
  describe('valid URLs', () => {
    it('parses a standard youtube.com/watch URL', () => {
      expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/watch URL without www', () => {
      expect(parseVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtu.be short URL', () => {
      expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtu.be URL with extra query params', () => {
      expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/embed URL', () => {
      expect(parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a youtube.com/shorts URL', () => {
      expect(parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('parses a watch URL with additional query params', () => {
      expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLxxx')).toBe(
        'dQw4w9WgXcQ',
      );
    });
  });

  describe('invalid URLs', () => {
    it('throws on a completely invalid string', () => {
      expect(() => parseVideoId('not-a-url')).toThrow('Invalid URL');
    });

    it('throws on a non-YouTube URL', () => {
      expect(() => parseVideoId('https://vimeo.com/123456789')).toThrow(
        'Could not extract video ID',
      );
    });

    it('throws on a YouTube URL with no video ID', () => {
      expect(() => parseVideoId('https://www.youtube.com/watch')).toThrow(
        'Could not extract video ID',
      );
    });

    it('throws on a YouTube URL with an empty video ID', () => {
      expect(() => parseVideoId('https://www.youtube.com/watch?v=')).toThrow();
    });

    it('throws if the video ID is shorter than 11 characters', () => {
      expect(() => parseVideoId('https://www.youtube.com/watch?v=short')).toThrow(
        'expected 11 characters',
      );
    });

    it('throws if the video ID is longer than 11 characters', () => {
      expect(() => parseVideoId('https://www.youtube.com/watch?v=toolongvideoid')).toThrow(
        'expected 11 characters',
      );
    });

    it('throws on an empty string', () => {
      expect(() => parseVideoId('')).toThrow('Invalid URL');
    });
  });
});
