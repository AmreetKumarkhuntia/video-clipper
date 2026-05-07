<script lang="ts">
  import type { VideoDetails } from '@lib/types/index.js';
  import { formatDuration } from '@web/lib/format.js';
  import Button from '@web/components/Button.svelte';

  interface Props {
    video: VideoDetails;
    isLoadingTranscript?: boolean;
    isAnalyzing?: boolean;
    errorMessage?: string;
    onLoadTranscript?: () => void;
    onPlanClips?: () => void;
  }

  let {
    video,
    isLoadingTranscript = false,
    isAnalyzing = false,
    errorMessage = '',
    onLoadTranscript,
    onPlanClips,
  }: Props = $props();
</script>

<aside class="vc-card rail-card">
  <div class="title-block">
    <p class="rail-eyebrow">Video workspace</p>
    <h1 class="rail-title">{video.title}</h1>
    <p class="rail-channel">{video.channelTitle}</p>
  </div>

  <dl class="stats">
    <div>
      <dt>Published</dt>
      <dd>{new Date(video.publishedAt).toLocaleDateString()}</dd>
    </div>
    <div>
      <dt>Duration</dt>
      <dd>{formatDuration(video.durationSec)}</dd>
    </div>
    <div>
      <dt>Views</dt>
      <dd>{video.viewCount?.toLocaleString() ?? 'unknown'}</dd>
    </div>
  </dl>

  <p class="rail-desc">{video.description || 'No video description available.'}</p>

  <div class="rail-actions">
    <Button
      variant="secondary"
      onclick={onLoadTranscript}
      disabled={isLoadingTranscript || isAnalyzing}
    >
      {isLoadingTranscript ? 'Fetching transcript...' : 'Load transcript'}
    </Button>
    <Button variant="primary" onclick={onPlanClips} disabled={isAnalyzing}>
      {isAnalyzing ? 'Planning clips...' : 'Plan clip candidates'}
    </Button>
  </div>

  {#if errorMessage}
    <p class="rail-error">{errorMessage}</p>
  {/if}
</aside>

<style>
  .rail-card {
    display: grid;
    gap: 20px;
    align-self: stretch;
  }

  .title-block {
    display: grid;
    gap: 6px;
  }

  .rail-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .rail-title {
    margin: 0;
    font-family: var(--vc-font-display);
    font-size: clamp(26px, 4vw, 36px);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: var(--vc-text);
  }

  .rail-channel {
    margin: 0;
    font-size: var(--vc-text-14);
    font-weight: 600;
    color: var(--vc-text-muted);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }

  .stats div {
    padding: 12px 14px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface-raised);
  }

  dt {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vc-text-muted);
  }

  dd {
    margin: 6px 0 0;
    font-size: var(--vc-text-14);
    font-weight: 700;
    color: var(--vc-text);
  }

  .rail-desc {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    line-height: 1.6;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    line-clamp: 5;
  }

  .rail-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .rail-error {
    margin: 0;
    font-size: var(--vc-text-13);
    color: var(--vc-error);
  }

  @media (max-width: 980px) {
    .rail-actions {
      grid-template-columns: 1fr;
    }
    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
