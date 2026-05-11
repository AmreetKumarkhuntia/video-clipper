import { writable, derived } from 'svelte/store';
import type { VideoDetails } from '@lib/types/index.js';
import type { TranscriptBundle, ClipPlan, ClipArtifact } from '@app/web/types/analysis.js';
import type { VideoStore, VideoEntry, AnalysisEntry } from '@app/web/types/videoStore.js';

const _store = writable<VideoStore>({});

export const videoStore = derived(_store, ($s) => $s);

function ensureVideoEntry(videoId: string): void {
  _store.update((s) => {
    if (!s[videoId]) {
      s[videoId] = { video: null, transcript: null, analyses: {} };
    }
    return s;
  });
}

function ensureAnalysisEntry(videoId: string, analysisId: string): void {
  _store.update((s) => {
    if (!s[videoId]) {
      s[videoId] = { video: null, transcript: null, analyses: {} };
    }
    if (!s[videoId].analyses[analysisId]) {
      s[videoId].analyses[analysisId] = { plan: null, clips: [] };
    }
    return s;
  });
}

export function setVideo(videoId: string, video: VideoDetails): void {
  ensureVideoEntry(videoId);
  _store.update((s) => {
    s[videoId].video = video;
    return s;
  });
}

export function setTranscript(videoId: string, transcript: TranscriptBundle): void {
  ensureVideoEntry(videoId);
  _store.update((s) => {
    s[videoId].transcript = transcript;
    return s;
  });
}

export function clearTranscript(videoId: string): void {
  _store.update((s) => {
    if (s[videoId]) s[videoId].transcript = null;
    return s;
  });
}

export function setAnalysisPlan(videoId: string, analysisId: string, plan: ClipPlan): void {
  ensureAnalysisEntry(videoId, analysisId);
  _store.update((s) => {
    s[videoId].analyses[analysisId].plan = plan;
    return s;
  });
}

export function setClips(videoId: string, analysisId: string, clips: ClipArtifact[]): void {
  ensureAnalysisEntry(videoId, analysisId);
  _store.update((s) => {
    s[videoId].analyses[analysisId].clips = clips;
    return s;
  });
}

export function clearAnalysis(videoId: string): void {
  _store.update((s) => {
    if (s[videoId]) s[videoId].analyses = {};
    return s;
  });
}

export type { VideoStore, VideoEntry, AnalysisEntry };
