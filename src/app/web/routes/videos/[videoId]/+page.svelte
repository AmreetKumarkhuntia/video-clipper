<script lang="ts">
  import { page } from '$app/stores';
  import type { VideoDetails } from '@lib/types/index.js';
  import type { ClipPlan, TranscriptBundle } from '@app/web/types/analysis.js';
  import type { ActivityPhase } from '@app/web/types/activity.js';
  import { apiFetch } from '@web/lib/api.js';
  import { streamAnalysis } from '@web/lib/analysisStream.js';
  import { formatTime } from '@web/lib/format.js';
  import {
    appendSystemActivity,
    createInitialActivityState,
    createStartedActivityState,
    upsertChunkCompletion,
    upsertChunkProgress,
    upsertChunkStarted,
    upsertSegmentCompletion,
    upsertSegmentProgress,
    upsertSegmentStarted,
  } from '@web/lib/activity/analysisActivity.js';
  import ErrorText from '@web/components/ErrorText.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import ActivityPanel from '@web/components/video/ActivityPanel.svelte';
  import ClipPlanSummary from '@web/components/video/ClipPlanSummary.svelte';
  import TranscriptPanel from '@web/components/video/TranscriptPanel.svelte';
  import VideoDetailsRail from '@web/components/video/VideoDetailsRail.svelte';
  import VideoPlayerPanel from '@web/components/video/VideoPlayerPanel.svelte';
  import { logAnalysisEvent, previewStreamText } from '@web/lib/activity/analysisLogging.js';

  let video: VideoDetails | null = null;
  let transcript: TranscriptBundle | null = null;
  let plan: ClipPlan | null = null;
  let isLoadingVideo = false;
  let isLoadingTranscript = false;
  let isAnalyzing = false;
  let errorMessage = '';

  let analyzedChunks = 0;
  let totalChunks = 0;
  let analysisPhase: ActivityPhase = 'idle';
  let activityState = createInitialActivityState();
  let completedChunkIndexes = new Set<number>();

  $: videoId = $page.params.videoId;

  $: if (videoId) {
    void loadVideo();
  }

  $: transcriptRows = transcript?.lines ?? [];
  $: candidateRanges =
    plan?.candidates.map((candidate) => ({ start: candidate.startSec, end: candidate.endSec })) ??
    [];

  async function loadVideo(): Promise<void> {
    isLoadingVideo = true;
    errorMessage = '';

    try {
      video = await apiFetch<VideoDetails>(`/api/youtube/videos/${videoId}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoadingVideo = false;
    }
  }

  async function loadTranscript(): Promise<void> {
    isLoadingTranscript = true;
    errorMessage = '';

    try {
      transcript = await apiFetch<TranscriptBundle>(`/api/youtube/videos/${videoId}/transcript`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoadingTranscript = false;
    }
  }

  async function planClips(): Promise<void> {
    isAnalyzing = true;
    errorMessage = '';
    analyzedChunks = 0;
    totalChunks = transcript?.chunks.length ?? 0;
    analysisPhase = 'analyzing';
    activityState = createStartedActivityState();
    completedChunkIndexes = new Set();

    try {
      plan = await streamAnalysis(
        {
          videoId,
          title: video?.title,
          description: video?.description,
          channelTitle: video?.channelTitle,
          durationSec: video?.durationSec,
          options: { refine: true, noCache: false },
        },
        {
          onChunkStarted: (chunkIndex) => {
            logAnalysisEvent('chunk_started', { chunkIndex });
            activityState = upsertChunkStarted(activityState, chunkIndex);
          },
          onChunkProgress: (chunkIndex, text) => {
            logAnalysisEvent(
              'chunk_progress',
              {
                chunkIndex,
                textLength: text.length,
                preview: previewStreamText(text),
              },
              'debug',
            );
            activityState = upsertChunkProgress(activityState, chunkIndex, text);
          },
          onChunkAnalyzed: (chunkIndex, evaluation) => {
            logAnalysisEvent('chunk_analyzed', {
              chunkIndex,
              status: evaluation.status,
              interesting: evaluation.status === 'success' ? evaluation.interesting : undefined,
              score: evaluation.status === 'success' ? evaluation.score : undefined,
            });
            totalChunks = Math.max(totalChunks, chunkIndex + 1);
            if (!completedChunkIndexes.has(chunkIndex)) {
              completedChunkIndexes = new Set(completedChunkIndexes).add(chunkIndex);
            }
            analyzedChunks = completedChunkIndexes.size;
            activityState = upsertChunkCompletion(activityState, chunkIndex, evaluation);
          },
          onSegmentStarted: (rank) => {
            logAnalysisEvent('segment_started', { rank });
            analysisPhase = 'refining';
            activityState = upsertSegmentStarted(activityState, rank);
          },
          onSegmentProgress: (rank, text) => {
            logAnalysisEvent(
              'segment_progress',
              {
                rank,
                textLength: text.length,
                preview: previewStreamText(text),
              },
              'debug',
            );
            analysisPhase = 'refining';
            activityState = upsertSegmentProgress(activityState, rank, text);
          },
          onSegmentRefined: (rank, segment) => {
            logAnalysisEvent('segment_refined', {
              rank,
              start: segment.start,
              end: segment.end,
              score: segment.score,
            });
            analysisPhase = 'refining';
            activityState = upsertSegmentCompletion(activityState, rank, segment, formatTime);
          },
          onError: (message) => {
            logAnalysisEvent('error', { message }, 'error');
            errorMessage = message;
            activityState = appendSystemActivity(activityState, {
              title: 'Analysis failed',
              status: 'error',
              detail: message,
            });
          },
        },
      );

      logAnalysisEvent('analysis_complete', {
        candidateCount: plan.candidates.length,
      });

      analysisPhase = 'complete';
      activityState = appendSystemActivity(activityState, {
        title: 'Clip plan ready',
        status: 'done',
        detail: `${plan.candidates.length} candidate moments are ready for review.`,
      });
    } catch (error) {
      if (!errorMessage) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    } finally {
      isAnalyzing = false;
    }
  }
</script>

{#if isLoadingVideo}
  <MutedText>Loading video details...</MutedText>
{:else if errorMessage && !video}
  <ErrorText message={errorMessage} />
{/if}

{#if video}
  <section class="video-page-columns">
    <div class="left-column">
      <VideoPlayerPanel {videoId} title={video.title} />

      <ActivityPanel
        {analyzedChunks}
        {totalChunks}
        phase={analysisPhase}
        items={activityState.items}
        {isAnalyzing}
      />
    </div>

    <div class="right-column">
      <VideoDetailsRail
        {video}
        {isLoadingTranscript}
        {isAnalyzing}
        errorMessage={errorMessage && video ? errorMessage : ''}
        onLoadTranscript={loadTranscript}
        onPlanClips={planClips}
      />

      <TranscriptPanel
        lines={transcriptRows}
        chunkCount={transcript?.chunks.length ?? 0}
        highlightRanges={candidateRanges}
      />
    </div>
  </section>

  <div class="plan-panel">
    <ClipPlanSummary {plan} {videoId} />
  </div>
{/if}

<style>
  .video-page-columns {
    display: grid;
    grid-template-columns: minmax(0, var(--video-page-main)) minmax(340px, var(--video-page-rail));
    gap: var(--s-lg);
    align-items: start;
  }

  .left-column,
  .right-column {
    display: grid;
    gap: var(--s-lg);
    align-content: start;
  }

  .plan-panel {
    margin-top: var(--s-lg);
  }

  @media (max-width: 980px) {
    .video-page-columns {
      grid-template-columns: minmax(0, var(--video-page-main-soft)) minmax(
          300px,
          var(--video-page-rail-soft)
        );
    }
  }

  @media (max-width: 800px) {
    .video-page-columns {
      grid-template-columns: 1fr;
    }

    .right-column,
    .plan-panel {
      margin-top: var(--s-lg);
    }
  }
</style>
