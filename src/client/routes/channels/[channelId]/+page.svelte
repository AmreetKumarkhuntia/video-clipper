<script lang="ts">
  import { page } from '$app/stores';
  import type { VideoPage, VideoSummary } from '../../../../types/index.js';

  let videos: VideoSummary[] = [];
  let nextPageToken: string | undefined;
  let prevPageToken: string | undefined;
  let isLoading = false;
  let errorMessage = '';

  $: channelId = $page.params.channelId;

  $: if (channelId) {
    void loadVideos();
  }

  async function loadVideos(pageToken?: string): Promise<void> {
    isLoading = true;
    errorMessage = '';

    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const response = await fetch(`/api/youtube/channels/${channelId}/videos${query}`);
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      const pageBody = body as VideoPage;
      videos = pageBody.videos;
      nextPageToken = pageBody.nextPageToken;
      prevPageToken = pageBody.prevPageToken;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${mins}:${String(secs).padStart(2, '0')}`;
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

<section class="page-head">
  <div>
    <p>Channel</p>
    <h1>Uploaded videos</h1>
  </div>
  <a href="/">Change channel</a>
</section>

{#if isLoading}
  <p class="muted">Loading videos...</p>
{:else if errorMessage}
  <p class="error">{errorMessage}</p>
{:else if videos.length === 0}
  <p class="muted">No public uploads found for this channel.</p>
{:else}
  <section class="video-grid" aria-label="Channel videos">
    {#each videos as video}
      <a class="video-card" href={`/videos/${video.id}`}>
        <div class="thumb">
          {#if video.thumbnail}
            <img src={video.thumbnail.url} alt="" loading="lazy" />
          {/if}
          <span>{formatDuration(video.durationSec)}</span>
        </div>
        <h2>{video.title}</h2>
        <p>{video.channelTitle}</p>
        <p>{new Date(video.publishedAt).toLocaleDateString()}</p>
      </a>
    {/each}
  </section>

  <div class="pager">
    <button type="button" disabled={!prevPageToken} on:click={() => loadVideos(prevPageToken)}>
      Previous
    </button>
    <button type="button" disabled={!nextPageToken} on:click={() => loadVideos(nextPageToken)}>
      Next
    </button>
  </div>
{/if}

<style>
  .page-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 26px;
  }

  .page-head p {
    margin: 0 0 6px;
    color: #6f746d;
    font-size: 13px;
    font-weight: 680;
    text-transform: uppercase;
  }

  .page-head h1 {
    margin: 0;
    font-size: 34px;
  }

  .page-head a,
  button {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid #c9ccc5;
    border-radius: 8px;
    background: #ffffff;
    color: #252a24;
    font-weight: 680;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 24px 16px;
  }

  .video-card {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .thumb {
    position: relative;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    background: #dedfd9;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb span {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 3px 6px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.78);
    color: #ffffff;
    font-size: 12px;
    font-weight: 720;
  }

  h2 {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .video-card p {
    margin: 0;
    color: #6a7068;
    font-size: 13px;
  }

  .pager {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 32px;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .muted {
    color: #666c65;
  }

  .error {
    color: #ad3131;
  }
</style>
