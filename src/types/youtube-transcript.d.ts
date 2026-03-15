// Re-export types from the package root for the ESM subpath import used in transcriptFetcher.
// This is needed because youtube-transcript has no "exports" field, so the subpath
// 'youtube-transcript/dist/youtube-transcript.esm.js' has no type declaration.
declare module 'youtube-transcript/dist/youtube-transcript.esm.js' {
  export { YoutubeTranscript, fetchTranscript } from 'youtube-transcript';
  export type { TranscriptConfig, TranscriptResponse } from 'youtube-transcript';
}
