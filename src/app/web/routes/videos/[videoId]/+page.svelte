<script lang="ts">
  import { page } from '$app/stores';
  import type { VideoDetails } from '@lib/types/index.js';
  import type { ClipPlan, TranscriptBundle } from '@app/web/types/analysis.js';
  import { apiFetch } from '../../../lib/api.js';
  import { streamAnalysis } from '../../../lib/analysisStream.js';
  import Button from '../../../components/Button.svelte';
  import ErrorText from '../../../components/ErrorText.svelte';
  import MutedText from '../../../components/MutedText.svelte';
  import AnalysisProgress from '../../../components/AnalysisProgress.svelte';
  import YouTubeEmbed from '../../../components/YouTubeEmbed.svelte';

  let video: VideoDetails | null = null;
  let transcript: TranscriptBundle | null = null;
  let plan: ClipPlan | null = null;
  let isLoadingVideo = false;
  let isLoadingTranscript = false;
  let isAnalyzing = false;
  let errorMessage = '';

  let analyzedChunks = 0;
  let totalChunks = 0;
  let analysisPhase: 'analyzing' | 'refining' | 'complete' = 'analyzing';
  let analysisText = '';

  $: videoId = $page.params.videoId;

  $: if (videoId) {
    void loadVideo();
  }

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
    totalChunks = 0;
    analysisPhase = 'analyzing';
    analysisText = '';

    try {
      plan = await streamAnalysis(
        {
          videoId,
          title: video?.title,
          durationSec: video?.durationSec,
          options: { refine: true, noCache: false },
        },
        {
          onChunkProgress: (_chunkIndex, text) => {
            analysisText += text;
          },
          onChunkAnalyzed: (chunkIndex, evaluation) => {
            if (evaluation.status === 'success') {
              analyzedChunks = chunkIndex + 1;
              if (totalChunks === 0) {
                totalChunks = chunkIndex + 1;
              }
            }
          },
          onSegmentProgress: (_rank, text) => {
            analysisPhase = 'refining';
            analysisText += text;
          },
          onSegmentRefined: () => {},
          onError: (message) => {
            errorMessage = message;
          },
        },
      );
      analysisPhase = 'complete';
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
{:else if errorMessage}
  <ErrorText message={errorMessage} />
{/if}

{#if video}
  <section class="video-layout">
    <YouTubeEmbed {videoId} title={video.title} />

    <aside class="details">
      <p class="channel">{video.channelTitle}</p>
      <h1>{video.title}</h1>
      <dl>
        <div>
          <dt>Published</dt>
          <dd>{new Date(video.publishedAt).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt>Views</dt>
          <dd>{video.viewCount?.toLocaleString() ?? 'unknown'}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{Math.round(video.durationSec)}s</dd>
        </div>
      </dl>

      <div class="actions">
        <Button on:click={loadTranscript} disabled={isLoadingTranscript}>
          {isLoadingTranscript ? 'Fetching transcript...' : 'Fetch transcript'}
        </Button>
        <Button on:click={planClips} disabled={isAnalyzing}>
          {isAnalyzing ? 'Planning clips...' : 'Plan clippers'}
        </Button>
      </div>
    </aside>
  </section>

  {#if isAnalyzing}
    <section class="progress-section">
      <AnalysisProgress {analyzedChunks} {totalChunks} phase={analysisPhase} text={analysisText} />
    </section>
  {/if}

  <section class="below">
    <article>
      <h2>Transcript</h2>
      {#if transcript}
        <p>{transcript.lines.length} lines, {transcript.chunks.length} analysis chunks.</p>
        <p class="excerpt">
          {transcript.lines
            .slice(0, 8)
            .map((line) => line.text)
            .join(' ')}
        </p>
      {:else}
        <MutedText>Transcript not loaded yet.</MutedText>
      {/if}
    </article>

    <article>
      <h2>Clip plan</h2>
      {#if plan}
        <p>{plan.candidates.length} candidate moments created.</p>
        <a class="btn-link" href={`/videos/${videoId}/analysis/${plan.id}`}>Review candidates</a>
      {:else}
        <MutedText>No clip plan generated yet.</MutedText>
      {/if}
    </article>
  </section>
{/if}

<style>
  .video-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.55fr);
    gap: var(--s-lg);
    align-items: start;
  }

  .details {
    display: grid;
    gap: var(--s-md);
  }

  .channel {
    margin: 0;
    color: var(--c-text-secondary);
    font-weight: var(--fw-semibold);
  }

  h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.12;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-sm);
    margin: 0;
  }

  dt {
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
  }

  dd {
    margin: 3px 0 0;
    font-weight: var(--fw-bold);
  }

  .actions {
    display: grid;
    gap: var(--s-sm);
  }

  .progress-section {
    margin-top: var(--s-lg);
    padding: var(--s-md);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
  }

  .below {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-lg);
    margin-top: 28px;
  }

  article {
    padding-top: 18px;
    border-top: 1px solid var(--c-border);
  }

  h2 {
    margin: 0 0 var(--s-sm);
    font-size: 18px;
  }

  .excerpt {
    color: var(--c-text-muted);
  }

  .btn-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--r-md);
    background: var(--c-primary);
    color: var(--c-primary-text);
    font-weight: var(--fw-bold);
  }

  @media (max-width: 900px) {
    .video-layout,
    .below {
      grid-template-columns: 1fr;
    }
  }
</style>
