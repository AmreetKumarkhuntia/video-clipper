<script lang="ts">
  import type { TranscriptLanguagePickerProps } from '@app/web/types/componentProps.js';
  import type { TranscriptLanguage } from '@app/web/types/analysis.js';
  import { apiFetch } from '@web/lib/api.js';
  import Button from '@web/components/Button.svelte';
  import Select from '@web/components/Select.svelte';
  import Skeleton from '@web/components/Skeleton.svelte';
  import SectionHeader from '@web/components/SectionHeader.svelte';

  let { videoId, onSelect, onCancel }: TranscriptLanguagePickerProps = $props();

  let languages = $state<TranscriptLanguage[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state('');
  let selected = $state('');

  $effect(() => {
    if (videoId) {
      apiFetch<{ languages: TranscriptLanguage[] }>(`/api/videos/${videoId}/transcript/languages`)
        .then((res) => {
          languages = res.languages;
          selected = res.languages[0]?.languageCode ?? '';
        })
        .catch((err) => {
          errorMessage = err instanceof Error ? err.message : 'Failed to load languages.';
        })
        .finally(() => {
          isLoading = false;
        });
    }
  });

  const selectOptions = $derived(
    languages.map((l) => ({
      value: l.languageCode,
      label: l.isAsr ? `${l.label} (auto-generated)` : l.label,
    })),
  );

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onCancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="lp-backdrop" role="presentation" onclick={onCancel}></div>

<div class="lp-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-title">
  <div class="lp-header">
    <SectionHeader eyebrow="Transcript" title="Choose language" />
  </div>

  <div class="lp-body">
    {#if isLoading}
      <div class="lp-skeletons">
        <Skeleton height="16px" width="60%" />
        <Skeleton height="36px" width="100%" />
      </div>
    {:else if errorMessage}
      <p class="lp-error">{errorMessage}</p>
    {:else if languages.length === 0}
      <p class="lp-empty">No caption tracks found for this video.</p>
    {:else}
      <label class="lp-label" for="lp-select">Available languages</label>
      <Select id="lp-select" options={selectOptions} bind:value={selected} />
    {/if}
  </div>

  <div class="lp-actions">
    <Button variant="ghost" onclick={onCancel}>Cancel</Button>
    <Button variant="primary" disabled={isLoading || !selected} onclick={() => onSelect(selected)}>
      Fetch transcript
    </Button>
  </div>
</div>

<style>
  .lp-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 400;
    cursor: default;
  }

  .lp-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 401;
    width: min(90vw, 420px);
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    box-shadow: var(--vc-shadow-3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .lp-header {
    padding: 20px 20px 0;
  }

  .lp-body {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .lp-skeletons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .lp-label {
    font-size: var(--vc-text-12);
    font-weight: 600;
    color: var(--vc-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .lp-empty,
  .lp-error {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    margin: 0;
  }

  .lp-error {
    color: var(--vc-error);
  }

  .lp-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 20px;
    border-top: 1px solid var(--vc-border);
  }
</style>
