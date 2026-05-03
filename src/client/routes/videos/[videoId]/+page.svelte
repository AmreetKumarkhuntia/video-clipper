<script lang="ts">
  import { page } from '$app/stores';
  import type { ClipPlan, TranscriptBundle, VideoDetails } from '../../../../types/index.js';

  let video: VideoDetails | null = null;
  let transcript: TranscriptBundle | null = null;
  let plan: ClipPlan | null = null;
  let isLoadingVideo = false;
  let isLoadingTranscript = false;
  let isAnalyzing = false;
  let errorMessage = '';

  $: videoId = $page.params.videoId;

  $: if (videoId) {
    void loadVideo();
  }

  async function loadVideo(): Promise<void> {
    isLoadingVideo = true;
    errorMessage = '';

    try {
      const response = await fetch(`/api/youtube/videos/${videoId}`);
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      video = body as VideoDetails;
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
      const response = await fetch(`/api/youtube/videos/${videoId}/transcript`);
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      transcript = body as TranscriptBundle;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoadingTranscript = false;
    }
  }

  async function planClips(): Promise<void> {
    isAnalyzing = true;
    errorMessage = '';

    try {
      const response = await fetch('/api/analysis/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoId,
          title: video?.title,
          durationSec: video?.durationSec,
          options: { refine: true },
        }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      plan = body as ClipPlan;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isAnalyzing = false;
    }
  }

  function readApiError(body: unknown): string {
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }

    return 'Something went wrong.';
  }
</script>

{#if isLoadingVideo}
  <p class="muted">Loading video details...</p>
{:else if errorMessage}
  <p class="error">{errorMessage}</p>
{/if}

{#if video}
  <section class="video-layout">
    <div class="player">
      <iframe
        title={video.title}
        src={`https://www.youtube.com/embed/${video.id}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    </div>

    <aside class="details">
      <p>{video.channelTitle}</p>
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
        <button type="button" on:click={loadTranscript} disabled={isLoadingTranscript}>
          {isLoadingTranscript ? 'Fetching transcript...' : 'Fetch transcript'}
        </button>
        <button type="button" on:click={planClips} disabled={isAnalyzing}>
          {isAnalyzing ? 'Planning clips...' : 'Plan clippers'}
        </button>
      </div>
    </aside>
  </section>

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
        <p class="muted">Transcript not loaded yet.</p>
      {/if}
    </article>

    <article>
      <h2>Clip plan</h2>
      {#if plan}
        <p>{plan.candidates.length} candidate moments created.</p>
        <a class="button-link" href={`/videos/${videoId}/analysis/${plan.id}`}>Review candidates</a>
      {:else}
        <p class="muted">No clip plan generated yet.</p>
      {/if}
    </article>
  </section>
{/if}

<style>
  .video-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.55fr);
    gap: 24px;
    align-items: start;
  }

  .player {
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    background: #111;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  .details {
    display: grid;
    gap: 16px;
  }

  .details > p {
    margin: 0;
    color: #6a7068;
    font-weight: 680;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.12;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 0;
  }

  dt {
    color: #6c716a;
    font-size: 12px;
    font-weight: 680;
    text-transform: uppercase;
  }

  dd {
    margin: 3px 0 0;
    font-weight: 720;
  }

  .actions {
    display: grid;
    gap: 10px;
  }

  button,
  .button-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #20251f;
    color: #fff;
    font-weight: 720;
  }

  button:disabled {
    opacity: 0.58;
  }

  .below {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-top: 28px;
  }

  article {
    padding-top: 18px;
    border-top: 1px solid #ddded9;
  }

  h2 {
    margin: 0 0 10px;
    font-size: 18px;
  }

  .excerpt,
  .muted {
    color: #666c65;
  }

  .error {
    color: #ad3131;
  }

  @media (max-width: 900px) {
    .video-layout,
    .below {
      grid-template-columns: 1fr;
    }
  }
</style>
