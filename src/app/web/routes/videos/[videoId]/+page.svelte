<script lang="ts">
  import { page } from '$app/stores';
  import type { VideoDetails } from '@lib/types/index.js';
  import type { ClipCandidate, ClipPlan, TranscriptBundle } from '@app/web/types/analysis.js';
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
  import Button from '@web/components/Button.svelte';
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
  let streamingCandidates = $state<ClipCandidate[]>([]);
  let isLoadingVideo = $state(false);
  let isLoadingTranscript = $state(false);
  let isAnalyzing = $state(false);
  let errorMessage = $state('');
  let abortController: AbortController | null = $state(null);

  let analyzedChunks = $state(0);
  let totalChunks = $state(0);
  let analysisPhase = $state<ActivityPhase>('idle');
  let activityState = $state(createInitialActivityState());
  let completedChunkIndexes = $state<Set<number>>(new Set());

  let selectedCandidateId = $state<string | null>(null);
  let seekToSec = $state<number | undefined>(undefined);

  let videoId = $derived($page.params.videoId);

  let transcriptRows = $derived(transcript?.lines ?? []);
  let displayCandidates = $derived(plan?.candidates ?? streamingCandidates);
  let candidateRanges = $derived(
    displayCandidates.map((candidate) => ({ start: candidate.startSec, end: candidate.endSec })),
  );

  let selectedCandidate = $derived(
    selectedCandidateId
      ? (displayCandidates.find((c) => c.id === selectedCandidateId) ?? null)
      : null,
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
    streamingCandidates = [];
    plan = null;
    abortController = new AbortController();

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
            const candidate: ClipCandidate = {
              id: `streaming-${rank}`,
              rank,
              startSec: segment.start,
              endSec: segment.end,
              score: segment.score,
              reason: segment.reason,
              source: segment.source,
              audioEvent: segment.audio_event,
              transcriptExcerpt: '',
              selected: false,
            };
            const existingIdx = streamingCandidates.findIndex((c) => c.rank === rank);
            if (existingIdx >= 0) {
              const next = [...streamingCandidates];
              next[existingIdx] = candidate;
              streamingCandidates = next;
            } else {
              streamingCandidates = [...streamingCandidates, candidate].sort(
                (a, b) => a.rank - b.rank,
              );
            }
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
        abortController.signal,
      );

      logAnalysisEvent('analysis_complete', { candidateCount: plan.candidates.length });
      analysisPhase = 'complete';
      activityState = appendSystemActivity(activityState, {
        title: 'Clip plan ready',
        status: 'done',
        detail: `${plan.candidates.length} candidate moments are ready for review.`,
      });
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (isAbort) {
        analysisPhase = 'idle';
        activityState = appendSystemActivity(activityState, {
          title: 'Analysis stopped',
          status: 'done',
          detail: 'Stopped by user. Partial results kept.',
        });
      } else if (!errorMessage) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    } finally {
      isAnalyzing = false;
      abortController = null;
    }
  }

  function stopAnalysis(): void {
    abortController?.abort();
  }

  async function clearTranscript(): Promise<void> {
    if (!confirm('Clear cached transcript for this video?')) return;
    try {
      await apiFetch<{ ok: true }>(`/api/cache/videos/${videoId}/transcript`, {
        method: 'DELETE',
      });
      transcript = null;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function clearAnalysis(): Promise<void> {
    if (!confirm('Clear cached LLM analysis for this video?')) return;
    try {
      await apiFetch<{ ok: true }>(`/api/cache/videos/${videoId}/analysis`, {
        method: 'DELETE',
      });
      plan = null;
      streamingCandidates = [];
      selectedCandidateId = null;
      analysisPhase = 'idle';
      activityState = createInitialActivityState();
      analyzedChunks = 0;
      totalChunks = 0;
      completedChunkIndexes = new Set();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function selectCandidate(id: string): void {
    if (selectedCandidateId === id) {
      selectedCandidateId = null;
      seekToSec = undefined;
      return;
    }
    selectedCandidateId = id;
    const c = displayCandidates.find((c) => c.id === id);
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
      {#if video.durationSec && (plan || isAnalyzing)}
        <div class="sect">
          <div class="sect__h">
            <h3>Segments</h3>
            <div class="sect__h-actions">
              <span class="sect__h-meta">
                {displayCandidates.length}
                {plan ? 'found' : 'streaming'}
              </span>
              <Button variant="ghost" size="sm" onclick={clearAnalysis} disabled={isAnalyzing}>
                Clear analysis
              </Button>
            </div>
          </div>
          <ClipTimeline
            durationSec={video.durationSec}
            candidates={displayCandidates}
            activeCandidateId={selectedCandidateId ?? undefined}
            isStreaming={isAnalyzing && !plan}
            onSelect={selectCandidate}
          />
        </div>
      {/if}

      <!-- Segment preview / streaming list / plan summary -->
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
        onStop={stopAnalysis}
      />

      {#if transcriptRows.length > 0}
        <div style="margin-top: 20px">
          <TranscriptPanel
            lines={transcriptRows}
            chunkCount={transcript?.chunks.length ?? 0}
            highlightRanges={candidateRanges}
            {activeRange}
            onClear={clearTranscript}
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

  .sect__h-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  @media (max-width: 900px) {
    .analyze-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
