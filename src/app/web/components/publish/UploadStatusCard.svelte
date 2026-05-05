<script lang="ts">
  import Panel from '@web/components/Panel.svelte';
  import type { UploadArtifact } from '@app/web/types/publish.js';
  import type { UploadQueueItem } from '@web/lib/uploadStream.js';

  interface Props {
    upload?: UploadArtifact | null;
    queueItem?: UploadQueueItem | null;
  }

  let { upload = null, queueItem = null }: Props = $props();

  let title = $derived(upload?.title ?? queueItem?.title ?? 'Upload');
  let status = $derived(upload?.status ?? queueItem?.status ?? 'queued');
  let youtubeUrl = $derived(upload?.youtubeUrl ?? queueItem?.youtubeUrl);
  let error = $derived(upload?.error ?? queueItem?.error);
</script>

<Panel tag="article">
  <div class="head">
    <div>
      <p class="eyebrow">Upload</p>
      <h2>{title}</h2>
    </div>
    {#if status === 'uploading'}
      <span class="status status-uploading">
        <span class="spinner" aria-hidden="true"></span>
        Uploading
      </span>
    {:else}
      <span
        class="status"
        class:status-success={status === 'uploaded'}
        class:status-error={status === 'failed'}
      >
        {status}
      </span>
    {/if}
  </div>

  {#if youtubeUrl}
    <p><a href={youtubeUrl} target="_blank" rel="noreferrer">Open uploaded video</a></p>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</Panel>

<style>
  .head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--s-md);
  }

  h2 {
    margin: 4px 0 0;
    font-size: 20px;
    line-height: 1.2;
  }

  .status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--c-surface-muted);
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: var(--fw-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    gap: 8px;
  }

  .status-success {
    background: var(--c-success-soft);
    color: var(--c-success);
  }

  .status-error {
    background: color-mix(in srgb, var(--c-error) 10%, var(--c-surface));
    color: var(--c-error);
  }

  .status-uploading {
    background: color-mix(in srgb, var(--c-accent) 12%, var(--c-surface));
    color: var(--c-accent);
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  p {
    margin: var(--s-md) 0 0;
    color: var(--c-text-secondary);
  }

  .error {
    color: var(--c-error);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
