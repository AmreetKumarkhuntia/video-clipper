<script lang="ts">
  import type { VideoSummary } from '@lib/types/index.js';
  import { formatDuration } from '@web/lib/format.js';

  interface Props {
    video: VideoSummary;
  }

  let { video }: Props = $props();
</script>

<a class="video-card" href={`/videos/${video.id}`}>
  <div class="thumb">
    {#if video.thumbnail}
      <img src={video.thumbnail.url} alt="" loading="lazy" />
    {/if}
    <span class="duration">{formatDuration(video.durationSec)}</span>
  </div>
  <h2 class="video-title">{video.title}</h2>
  <p class="video-meta">{video.channelTitle}</p>
  <p class="video-meta">{new Date(video.publishedAt).toLocaleDateString()}</p>
</a>

<style>
  .video-card {
    display: grid;
    gap: 8px;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }

  .thumb {
    position: relative;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface-raised);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .duration {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 3px 6px;
    border-radius: var(--vc-radius-sm);
    background: var(--vc-overlay);
    color: var(--vc-text-onAccent);
    font-size: var(--vc-text-12);
    font-weight: 700;
  }

  .video-title {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: var(--vc-text-14);
    font-weight: 500;
    line-height: 1.35;
    color: var(--vc-text);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .video-meta {
    margin: 0;
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
  }
</style>
