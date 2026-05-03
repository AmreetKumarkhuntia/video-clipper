<script lang="ts">
  import type { VideoSummary } from '@lib/types/index.js';
  import { formatDuration } from '$lib/format.js';

  export let video: VideoSummary;
</script>

<a class="video-card" href={`/videos/${video.id}`}>
  <div class="thumb">
    {#if video.thumbnail}
      <img src={video.thumbnail.url} alt="" loading="lazy" />
    {/if}
    <span>{formatDuration(video.durationSec)}</span>
  </div>
  <h2>{video.title}</h2>
  <p class="meta">{video.channelTitle}</p>
  <p class="meta">{new Date(video.publishedAt).toLocaleDateString()}</p>
</a>

<style>
  .video-card {
    display: grid;
    gap: var(--s-xs);
    min-width: 0;
  }

  .thumb {
    position: relative;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: var(--r-md);
    background: var(--c-thumb-bg);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb span {
    position: absolute;
    right: var(--s-xs);
    bottom: var(--s-xs);
    padding: 3px 6px;
    border-radius: var(--r-sm);
    background: var(--c-overlay);
    color: var(--c-primary-text);
    font-size: 12px;
    font-weight: var(--fw-bold);
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

  .meta {
    margin: 0;
    color: var(--c-text-secondary);
    font-size: 13px;
  }
</style>
