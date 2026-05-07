<script lang="ts">
  import Icon from '@web/components/Icon.svelte';
  import type { UploadStatusCardProps } from '@app/web/types/componentProps.js';

  let { upload = null, queueItem = null }: UploadStatusCardProps = $props();

  let title = $derived(upload?.title ?? queueItem?.title ?? 'Upload');
  let status = $derived(upload?.status ?? queueItem?.status ?? 'queued');
  let youtubeUrl = $derived(upload?.youtubeUrl ?? queueItem?.youtubeUrl);
  let error = $derived(upload?.error ?? queueItem?.error);
</script>

<article class="vc-card upload-card">
  <div class="card-head">
    <div class="card-info">
      <p class="card-eyebrow">Upload</p>
      <p class="card-title">{title}</p>
    </div>

    {#if status === 'uploading'}
      <span class="status status--uploading">
        <span class="spinner" aria-hidden="true"></span>
        Uploading
      </span>
    {:else if status === 'uploaded'}
      <span class="status status--ok">
        <Icon name="check" size={11} />
        Uploaded
      </span>
    {:else if status === 'failed'}
      <span class="status status--err">Failed</span>
    {:else}
      <span class="status status--queued">{status}</span>
    {/if}
  </div>

  {#if youtubeUrl}
    <p class="card-link">
      <a href={youtubeUrl} target="_blank" rel="noreferrer" class="vc-link">
        Open on YouTube <Icon name="external-link" size={12} />
      </a>
    </p>
  {/if}

  {#if error}
    <p class="card-error">{error}</p>
  {/if}
</article>

<style>
  .upload-card {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .card-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .card-title {
    font-size: var(--vc-text-16);
    font-weight: 500;
    color: var(--vc-text);
    margin: 0;
    overflow-wrap: anywhere;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .status--queued {
    background: var(--vc-surface-raised);
    color: var(--vc-text-muted);
  }

  .status--uploading {
    background: color-mix(in srgb, var(--vc-accent) 12%, var(--vc-surface));
    color: var(--vc-accent);
  }

  .status--ok {
    background: color-mix(in srgb, var(--vc-success, #16a34a) 12%, var(--vc-surface));
    color: var(--vc-success, #16a34a);
  }

  .status--err {
    background: color-mix(in srgb, var(--vc-error) 12%, var(--vc-surface));
    color: var(--vc-error);
  }

  .spinner {
    width: 11px;
    height: 11px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: vc-spin 0.8s linear infinite;
  }

  .card-link {
    margin: 12px 0 0;
    font-size: var(--vc-text-14);
  }

  .vc-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--vc-accent);
    text-decoration: none;
  }

  .vc-link:hover {
    text-decoration: underline;
  }

  .card-error {
    margin: 10px 0 0;
    font-size: var(--vc-text-13);
    color: var(--vc-error);
  }
</style>
