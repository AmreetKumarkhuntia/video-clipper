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
  import { logAnalysisEvent, previewStreamText } from '@web/lib/activity/analysisLogging.js';
  import Icon from '@web/components/Icon.svelte';
  import Badge from '@web/components/Badge.svelte';
  import ActivityPanel from '@web/components/video/ActivityPanel.svelte';
  import ClipPlanSummary from '@web/components/video/ClipPlanSummary.svelte';
  import ClipTimeline from '@web/components/video/ClipTimeline.svelte';
  import SegmentPreview from '@web/components/video/SegmentPreview.svelte';
  import TranscriptPanel from '@web/components/video/TranscriptPanel.svelte';
  import VideoDetailsRail from '@web/components/video/VideoDetailsRail.svelte';
  import VideoPlayerPanel from '@web/components/video/VideoPlayerPanel.svelte';

  let video = $state<VideoDetails | null>(null);
  let transcript = $state<TranscriptBundle | null>(null);
  let plan = $state<ClipPlan | null>(null);
  let isLoadingVideo = $state(false);
  let isLoadingTranscript = $state(false);
  let isAnalyzing = $state(false);
  let errorMessage = $state('');

  let analyzedChunks = $state(0);
  let totalChunks = $state(0);
  let analysisPhase = $state<ActivityPhase>('idle');
  let activityState = $state(createInitialActivityState());
  let completedChunkIndexes = $state<Set<number>>(new Set());

  let selectedCandidateId = $state<string | null>(null);
  let seekToSec = $state<number | undefined>(undefined);

  let videoId = $derived($page.params.videoId);

  let transcriptRows = $derived(transcript?.lines ?? []);
  let candidateRanges = $derived(
    plan?.candidates.map((candidate) => ({ start: candidate.startSec, end: candidate.endSec })) ??
      [],
  );

  let selectedCandidate = $derived(
    selectedCandidateId ? plan?.candidates.find((c) => c.id === selectedCandidateId) : null,
  );

  let activeRange = $derived(
    selectedCandidate
      ? { start: selectedCandidate.startSec, end: selectedCandidate.endSec }
      : undefined,
  );

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

  $effect(() => {
    if (videoId) void loadVideo();
  });

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
              { chunkIndex, textLength: text.length, preview: previewStreamText(text) },
              'debug',
            );
            activityState = upsertChunkProgress(activityState, chunkIndex, text);
          },
          onChunkAnalyzed: (chunkIndex, evaluation) => {
            logAnalysisEvent('chunk_analyzed', { chunkIndex, status: evaluation.status });
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
              { rank, textLength: text.length, preview: previewStreamText(text) },
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

      logAnalysisEvent('analysis_complete', { candidateCount: plan.candidates.length });
      analysisPhase = 'complete';
      activityState = appendSystemActivity(activityState, {
        title: 'Clip plan ready',
        status: 'done',
        detail: `${plan.candidates.length} candidate moments are ready for review.`,
      });
    } catch (error) {
      if (!errorMessage) errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isAnalyzing = false;
    }
  }

  function selectCandidate(id: string): void {
    if (selectedCandidateId === id) {
      selectedCandidateId = null;
      seekToSec = undefined;
      return;
    }
    selectedCandidateId = id;
    const c = plan?.candidates.find((c) => c.id === id);
    if (c) {
      seekToSec = c.startSec;
    }
  }

  function closePreview(): void {
    selectedCandidateId = null;
    seekToSec = undefined;
  }
</script>

{#if isLoadingVideo}
  <div class="analyze-loading">
    <div class="sk sk--line" style="width:240px;height:16px"></div>
  </div>
{:else if errorMessage && !video}
  <p class="analyze-error">{errorMessage}</p>
{/if}

{#if video}
  <div class="analyze-layout">
    <div class="analyze-main">
      <!-- Player -->
      <div class="player">
        <div class="player__bg"></div>
        <div class="player__title">
          <Icon name="video" size={13} />
          {video.title}
        </div>
        <VideoPlayerPanel {videoId} title={video.title} startSec={seekToSec} />
      </div>

      <!-- Timeline -->
      {#if plan && video.durationSec}
        <div class="sect">
          <div class="sect__h">
            <h3>Segments</h3>
            <span class="sect__h-meta">{plan.candidates.length} found</span>
          </div>
          <ClipTimeline
            durationSec={video.durationSec}
            candidates={plan.candidates}
            activeCandidateId={selectedCandidateId ?? undefined}
            onSelect={selectCandidate}
          />
        </div>
      {/if}

      <!-- Segment preview -->
      {#if selectedCandidate && transcript}
        <div class="sect">
          <SegmentPreview
            candidate={selectedCandidate}
            transcriptLines={transcript.lines}
            onClose={closePreview}
          />
        </div>
      {:else if plan}
        <div class="sect">
          <div class="sect__h">
            <h3>Clip plan</h3>
            <span class="sect__h-meta">{plan.candidates.length} candidates</span>
          </div>
          <ClipPlanSummary {plan} {videoId} />
        </div>
      {/if}

      <!-- Activity log -->
      <div class="sect">
        <div class="sect__h">
          <h3>Activity</h3>
          {#if isAnalyzing}
            <Badge variant="clay">
              <span class="status-line__dot dot--run"></span>
              Analyzing {analyzedChunks}/{totalChunks}
            </Badge>
          {/if}
        </div>
        <ActivityPanel
          {analyzedChunks}
          {totalChunks}
          phase={analysisPhase}
          items={activityState.items}
          {isAnalyzing}
        />
      </div>
    </div>

    <div class="analyze-side">
      <VideoDetailsRail
        {video}
        {isLoadingTranscript}
        {isAnalyzing}
        errorMessage={errorMessage && video ? errorMessage : ''}
        onLoadTranscript={loadTranscript}
        onPlanClips={planClips}
      />

      {#if transcriptRows.length > 0}
        <div style="margin-top: 20px">
          <TranscriptPanel
            lines={transcriptRows}
            chunkCount={transcript?.chunks.length ?? 0}
            highlightRanges={candidateRanges}
            {activeRange}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .analyze-loading {
    padding: 32px;
  }

  .analyze-error {
    padding: 32px;
    color: var(--vc-error);
    font-size: var(--vc-text-14);
  }

  .analyze-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 24px;
    align-items: start;
  }

  .analyze-main {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .analyze-side {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
  }

  .sect__h-meta {
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-12);
    color: var(--vc-text-subtle);
  }

  @media (max-width: 900px) {
    .analyze-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
