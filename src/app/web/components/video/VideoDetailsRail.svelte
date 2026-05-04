<script lang="ts">
  import type { VideoDetails } from '@lib/types/index.js';
  import { formatDuration } from '@web/lib/format.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import Panel from '@web/components/Panel.svelte';

  export let video: VideoDetails;
  export let isLoadingTranscript = false;
  export let isAnalyzing = false;
  export let errorMessage = '';
  export let onLoadTranscript: () => void;
  export let onPlanClips: () => void;
</script>

<Panel tag="aside">
  <div class="details">
    <div class="title-block">
      <p class="eyebrow">Video workspace</p>
      <h1>{video.title}</h1>
      <p class="channel">{video.channelTitle}</p>
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

    <p class="description">{video.description || 'No video description available.'}</p>

    <div class="actions">
      <Button
        variant="outline"
        on:click={onLoadTranscript}
        disabled={isLoadingTranscript || isAnalyzing}
      >
        {isLoadingTranscript ? 'Fetching transcript...' : 'Load transcript'}
      </Button>
      <Button on:click={onPlanClips} disabled={isAnalyzing}>
        {isAnalyzing ? 'Planning clips...' : 'Plan clip candidates'}
      </Button>
    </div>

    {#if errorMessage}
      <ErrorText message={errorMessage} />
    {/if}
  </div>
</Panel>

<style>
  .details {
    display: grid;
    gap: var(--s-lg);
    align-self: stretch;
  }

  .title-block {
    display: grid;
    gap: var(--s-xs);
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 40px);
    line-height: 1.02;
  }

  .channel {
    margin: 0;
    color: var(--c-text-secondary);
    font-weight: var(--fw-semibold);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--s-sm);
    margin: 0;
  }

  .stats div {
    padding: 14px;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background: var(--c-surface-muted);
  }

  dt {
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  dd {
    margin: 8px 0 0;
    font-size: 15px;
    font-weight: var(--fw-bold);
  }

  .description {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--c-text-secondary);
    line-height: 1.6;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    line-clamp: 5;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-sm);
  }

  @media (max-width: 980px) {
    .actions {
      grid-template-columns: 1fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
