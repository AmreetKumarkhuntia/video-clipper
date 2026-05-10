<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Icon from '@web/components/Icon.svelte';
  import Button from '@web/components/Button.svelte';
  import Field from '@web/components/Field.svelte';
  import InputText from '@web/components/InputText.svelte';
  import Textarea from '@web/components/Textarea.svelte';
  import Select from '@web/components/Select.svelte';
  import Toggle from '@web/components/Toggle.svelte';
  import { formatDuration, formatTime } from '@web/lib/format.js';
  import { apiFetch } from '@web/lib/api.js';
  import {
    YOUTUBE_CATEGORIES,
    type PublishDraftItem,
    type PublishLicense,
    type PublishPrivacyStatus,
  } from '@app/web/types/publish.js';
  import type { SelectOption } from '@app/web/types/web.js';
  import type { PublishDraftEditorProps } from '@app/web/types/componentProps.js';

  let { item, index, onupdate, ongenerate, onclose }: PublishDraftEditorProps = $props();

  let isUploadingThumbnail = $state(false);
  let thumbnailError = $state('');
  let panelEl = $state<HTMLDivElement | null>(null);

  const privacyOptions: PublishPrivacyStatus[] = ['private', 'unlisted', 'public'];
  const licenseOptions: SelectOption<PublishLicense>[] = [
    { value: 'youtube', label: 'Standard YouTube License' },
    { value: 'creativeCommon', label: 'Creative Commons — Attribution' },
  ];

  function patchItem(patch: Partial<PublishDraftItem>): void {
    onupdate?.({ index, item: { ...item, ...patch } });
  }

  function toLocalDatetime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function updateTags(value: string): void {
    patchItem({
      tags: value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }

  async function handleThumbnailChange(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingThumbnail = true;
    thumbnailError = '';

    try {
      const formData = new FormData();
      formData.set('clipArtifactId', item.clipArtifactId);
      formData.set('file', file);

      const data = await apiFetch<{ path: string }>('/api/publish/thumbnails', {
        method: 'POST',
        body: formData,
      });

      patchItem({ thumbnailPath: data.path });
    } catch (error) {
      thumbnailError = error instanceof Error ? error.message : String(error);
    } finally {
      isUploadingThumbnail = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose?.();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose?.();
  }

  onMount(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelEl?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="draft-overlay"
  role="presentation"
  onclick={handleBackdropClick}
  transition:fade={{ duration: 160 }}
>
  <div
    bind:this={panelEl}
    class="draft-overlay__panel"
    role="dialog"
    aria-modal="true"
    aria-label={`Edit clip ${index + 1}`}
    tabindex="-1"
    transition:fly={{ y: 16, duration: 220 }}
  >
    <header class="draft-overlay__head">
      <div class="draft-overlay__head-info">
        <p class="card-eyebrow">Clip {index + 1}</p>
        <h2 class="draft-overlay__title">{item.filename}</h2>
        <p class="card-meta">
          {formatTime(item.startSec)} to {formatTime(item.endSec)} · {formatDuration(
            item.durationSec,
          )}
        </p>
      </div>
      <button
        class="draft-overlay__close"
        type="button"
        aria-label="Close editor"
        onclick={() => onclose?.()}
      >
        <Icon name="x" size={16} />
      </button>
    </header>

    <div class="draft-overlay__body">
      <div class="field-grid">
        <Field label="Title" for="draft-title-{index}" class="field--full">
          <InputText
            id="draft-title-{index}"
            value={item.title}
            maxlength={100}
            oninput={(v) => patchItem({ title: v })}
          />
        </Field>

        <Field label="Description" for="draft-desc-{index}" class="field--full">
          <Textarea
            id="draft-desc-{index}"
            value={item.description}
            rows={5}
            oninput={(v) => patchItem({ description: v })}
          />
        </Field>

        <Field label="Tags" for="draft-tags-{index}">
          <InputText
            id="draft-tags-{index}"
            value={item.tags.join(', ')}
            placeholder="tag1, tag2, tag3"
            oninput={(v) => updateTags(v)}
          />
        </Field>

        <Field label="Privacy" for="draft-privacy-{index}">
          <Select
            id="draft-privacy-{index}"
            value={item.privacyStatus}
            options={privacyOptions.map((o) => ({ value: o, label: o }))}
            onchange={(v) => patchItem({ privacyStatus: v as PublishPrivacyStatus })}
          />
        </Field>

        <Field label="Category" for="draft-cat-{index}">
          <Select
            id="draft-cat-{index}"
            value={item.categoryId}
            options={Object.entries(YOUTUBE_CATEGORIES).map(([id, label]) => ({
              value: id,
              label,
            }))}
            onchange={(v) => patchItem({ categoryId: v })}
          />
        </Field>

        <Field label="License" for="draft-license-{index}">
          <Select
            id="draft-license-{index}"
            value={item.license}
            options={licenseOptions}
            onchange={(v) => patchItem({ license: v as PublishLicense })}
          />
        </Field>

        <label class="toggle-row">
          <div class="toggle-row__text">
            <span class="toggle-row__t">Format</span>
            <span class="toggle-row__d">
              {item.isShort ? 'Upload as YouTube Short' : 'Standard upload'}
            </span>
          </div>
          <Toggle
            checked={item.isShort}
            ariaLabel="Format"
            onchange={(c) => patchItem({ isShort: c })}
          />
        </label>

        <label class="toggle-row">
          <div class="toggle-row__text">
            <span class="toggle-row__t">Made for kids</span>
            <span class="toggle-row__d">
              {item.selfDeclaredMadeForKids ? 'Made for children' : 'Not made for children'}
            </span>
          </div>
          <Toggle
            checked={item.selfDeclaredMadeForKids}
            ariaLabel="Made for kids"
            onchange={(c) => patchItem({ selfDeclaredMadeForKids: c })}
          />
        </label>

        <label class="toggle-row">
          <div class="toggle-row__text">
            <span class="toggle-row__t">Embeddable</span>
            <span class="toggle-row__d">
              {item.embeddable ? 'Embeddable on other sites' : 'Not embeddable'}
            </span>
          </div>
          <Toggle
            checked={item.embeddable}
            ariaLabel="Embeddable"
            onchange={(c) => patchItem({ embeddable: c })}
          />
        </label>

        <label class="toggle-row">
          <div class="toggle-row__text">
            <span class="toggle-row__t">Public stats</span>
            <span class="toggle-row__d">
              {item.publicStatsViewable ? 'View count visible to others' : 'View count hidden'}
            </span>
          </div>
          <Toggle
            checked={item.publicStatsViewable}
            ariaLabel="Public stats"
            onchange={(c) => patchItem({ publicStatsViewable: c })}
          />
        </label>

        <label class="toggle-row">
          <div class="toggle-row__text">
            <span class="toggle-row__t">AI-generated content</span>
            <span class="toggle-row__d">
              {item.containsSyntheticMedia
                ? 'Contains AI-generated content'
                : 'No AI-generated content'}
            </span>
          </div>
          <Toggle
            checked={item.containsSyntheticMedia}
            ariaLabel="AI-generated content"
            onchange={(c) => patchItem({ containsSyntheticMedia: c })}
          />
        </label>

        <div class="vc-field field--full">
          <span class="vc-label">Thumbnail</span>
          <div class="thumbnail-row">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onchange={handleThumbnailChange}
              disabled={isUploadingThumbnail}
              class="file-input"
            />
            {#if isUploadingThumbnail}
              <span class="thumb-note">Uploading...</span>
            {:else if item.thumbnailPath}
              <span class="thumb-note thumb-note--ok"
                >Saved: {item.thumbnailPath.split('/').pop()}</span
              >
            {/if}
            {#if thumbnailError}
              <span class="thumb-note thumb-note--err">{thumbnailError}</span>
            {/if}
          </div>
        </div>

        <Field label="Add to playlist (optional)" for="draft-playlist-{index}" class="field--full">
          <InputText
            id="draft-playlist-{index}"
            value={item.playlistId ?? ''}
            placeholder="PLxxxxxxxxxxxx..."
            oninput={(v) => patchItem({ playlistId: v.trim() || undefined })}
          />
        </Field>

        <Field label="Scheduled publish" for="draft-schedule-{index}" class="field--full">
          <div class="schedule-datetime-row">
            <input
              id="draft-schedule-{index}"
              type="datetime-local"
              class="schedule-datetime-input"
              value={item.scheduledAt ? toLocalDatetime(new Date(item.scheduledAt)) : ''}
              onchange={(e) => {
                const val = (e.currentTarget as HTMLInputElement).value;
                patchItem({ scheduledAt: val ? new Date(val).toISOString() : undefined });
              }}
            />
            {#if item.scheduledAt}
              <button
                type="button"
                class="schedule-clear-btn"
                onclick={() => patchItem({ scheduledAt: undefined })}
              >
                Clear
              </button>
            {/if}
          </div>
        </Field>
      </div>

      {#if item.transcriptExcerpt}
        <div class="excerpt">
          <p class="excerpt-eyebrow">Transcript excerpt</p>
          <p class="excerpt-text">{item.transcriptExcerpt}</p>
        </div>
      {/if}
    </div>

    <footer class="draft-overlay__foot">
      <Button variant="secondary" size="sm" onclick={() => ongenerate?.({ index, item })}>
        <Icon name="sparkles" size={13} /> AI regenerate metadata
      </Button>
      <Button variant="primary" size="sm" onclick={() => onclose?.()}>Done</Button>
    </footer>
  </div>
</div>

<style>
  .draft-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 24px;
    overflow-y: auto;
  }

  .draft-overlay__panel {
    width: min(820px, 100%);
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    box-shadow: var(--vc-shadow-2, 0 24px 60px rgba(0, 0, 0, 0.35));
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 96px);
    outline: none;
  }

  .draft-overlay__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--vc-divider);
  }

  .draft-overlay__head-info {
    flex: 1;
    min-width: 0;
  }

  .draft-overlay__title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-22, 20px);
    font-weight: 500;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
    color: var(--vc-text);
    overflow-wrap: anywhere;
  }

  .draft-overlay__close {
    width: 32px;
    height: 32px;
    border: 1px solid var(--vc-divider);
    border-radius: var(--vc-radius-sm, 6px);
    background: transparent;
    color: var(--vc-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
      background var(--vc-dur-fast) var(--vc-ease),
      color var(--vc-dur-fast) var(--vc-ease);
  }

  .draft-overlay__close:hover {
    background: var(--vc-surface-hover, var(--vc-surface));
    color: var(--vc-text);
  }

  .draft-overlay__body {
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
  }

  .draft-overlay__foot {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 24px;
    border-top: 1px solid var(--vc-divider);
    flex-wrap: wrap;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .card-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .card-meta {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    margin: 0;
  }

  :global(.draft-overlay__body .field--full) {
    grid-column: 1 / -1;
  }

  .thumbnail-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .file-input {
    font: inherit;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
  }

  .thumb-note {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
  }
  .thumb-note--ok {
    color: var(--vc-success, #16a34a);
  }
  .thumb-note--err {
    color: var(--vc-error);
  }

  .schedule-datetime-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .schedule-datetime-input {
    font: inherit;
    font-size: var(--vc-text-14);
    padding: 6px 10px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
  }

  .schedule-datetime-input:focus {
    outline: none;
    border-color: var(--vc-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vc-accent) 20%, transparent);
  }

  .schedule-clear-btn {
    font: inherit;
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    background: none;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-sm, 6px);
    padding: 4px 10px;
    cursor: pointer;
  }

  .schedule-clear-btn:hover {
    color: var(--vc-text);
    background: var(--vc-surface-hover, var(--vc-surface));
  }

  .excerpt {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--vc-divider);
  }

  .excerpt-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 6px;
  }

  .excerpt-text {
    margin: 0;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    line-height: 1.6;
  }

  @media (max-width: 760px) {
    .draft-overlay {
      padding: 16px;
    }
    .draft-overlay__panel {
      max-height: calc(100vh - 32px);
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .draft-overlay,
    .draft-overlay__panel {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
