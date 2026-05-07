<script lang="ts">
  import Icon from '@web/components/Icon.svelte';
  import { formatDuration, formatTime } from '@web/lib/format.js';
  import { apiFetch } from '@web/lib/api.js';
  import {
    YOUTUBE_CATEGORIES,
    type PublishDraftItem,
    type PublishLicense,
    type PublishPrivacyStatus,
  } from '@app/web/types/publish.js';

  interface Props {
    item: PublishDraftItem;
    index: number;
    onupdate?: (detail: { index: number; item: PublishDraftItem }) => void;
    ongenerate?: (detail: { index: number; item: PublishDraftItem }) => void;
  }

  let { item, index, onupdate, ongenerate }: Props = $props();

  let collapsed = $state(true);
  let isUploadingThumbnail = $state(false);
  let thumbnailError = $state('');

  const privacyOptions: PublishPrivacyStatus[] = ['private', 'unlisted', 'public'];
  const licenseOptions: { value: PublishLicense; label: string }[] = [
    { value: 'youtube', label: 'Standard YouTube License' },
    { value: 'creativeCommon', label: 'Creative Commons — Attribution' },
  ];

  function patchItem(patch: Partial<PublishDraftItem>): void {
    onupdate?.({ index, item: { ...item, ...patch } });
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
</script>

<article class="vc-card draft-card" class:draft-card--selected={item.selected}>
  <div class="card-head">
    <div class="card-head__info">
      <p class="card-eyebrow">Clip {index + 1}</p>
      <h3 class="card-title">{item.filename}</h3>
      <p class="card-meta">
        {formatTime(item.startSec)} to {formatTime(item.endSec)} · {formatDuration(
          item.durationSec,
        )}
      </p>
    </div>

    <div class="card-head__controls">
      <label class="include-toggle">
        <input
          type="checkbox"
          checked={item.selected}
          onchange={(event) =>
            patchItem({ selected: (event.currentTarget as HTMLInputElement).checked })}
        />
        <span>Include in publish</span>
      </label>
      <button
        class="collapse-btn"
        class:is-open={!collapsed}
        type="button"
        aria-label={collapsed ? 'Expand card' : 'Collapse card'}
        onclick={() => (collapsed = !collapsed)}
      >
        <Icon name="chevron-down" size={16} />
      </button>
    </div>
  </div>

  {#if collapsed}
    <p class="card-summary">
      {item.title || '—'} · {item.privacyStatus} · {formatDuration(item.durationSec)}
    </p>
  {/if}

  {#if !collapsed}
    <div class="field-grid">
      <!-- Title (full width) -->
      <div class="vc-field field--full">
        <label class="vc-label" for="draft-title-{index}">Title</label>
        <input
          id="draft-title-{index}"
          class="vc-input"
          value={item.title}
          maxlength="100"
          oninput={(event) => patchItem({ title: (event.currentTarget as HTMLInputElement).value })}
        />
      </div>

      <!-- Description (full width) -->
      <div class="vc-field field--full">
        <label class="vc-label" for="draft-desc-{index}">Description</label>
        <textarea
          id="draft-desc-{index}"
          class="vc-textarea"
          rows={5}
          oninput={(event) =>
            patchItem({ description: (event.currentTarget as HTMLTextAreaElement).value })}
          >{item.description}</textarea
        >
      </div>

      <!-- Tags -->
      <div class="vc-field">
        <label class="vc-label" for="draft-tags-{index}">Tags</label>
        <input
          id="draft-tags-{index}"
          class="vc-input"
          value={item.tags.join(', ')}
          placeholder="tag1, tag2, tag3"
          oninput={(event) => updateTags((event.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <!-- Privacy -->
      <div class="vc-field">
        <label class="vc-label" for="draft-privacy-{index}">Privacy</label>
        <select
          id="draft-privacy-{index}"
          class="vc-select"
          value={item.privacyStatus}
          onchange={(event) =>
            patchItem({
              privacyStatus: (event.currentTarget as HTMLSelectElement)
                .value as PublishPrivacyStatus,
            })}
        >
          {#each privacyOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <!-- Category -->
      <div class="vc-field">
        <label class="vc-label" for="draft-cat-{index}">Category</label>
        <select
          id="draft-cat-{index}"
          class="vc-select"
          value={item.categoryId}
          onchange={(event) =>
            patchItem({ categoryId: (event.currentTarget as HTMLSelectElement).value })}
        >
          {#each Object.entries(YOUTUBE_CATEGORIES) as [id, label]}
            <option value={id}>{label}</option>
          {/each}
        </select>
      </div>

      <!-- License -->
      <div class="vc-field">
        <label class="vc-label" for="draft-license-{index}">License</label>
        <select
          id="draft-license-{index}"
          class="vc-select"
          value={item.license}
          onchange={(event) =>
            patchItem({
              license: (event.currentTarget as HTMLSelectElement).value as PublishLicense,
            })}
        >
          {#each licenseOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <!-- Boolean toggles -->
      <div class="vc-field">
        <span class="vc-label">Format</span>
        <label class="check-row">
          <input
            type="checkbox"
            checked={item.isShort}
            onchange={(event) =>
              patchItem({ isShort: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>Upload as YouTube Short</span>
        </label>
      </div>

      <div class="vc-field">
        <span class="vc-label">Made for kids</span>
        <label class="check-row">
          <input
            type="checkbox"
            checked={item.selfDeclaredMadeForKids}
            onchange={(event) =>
              patchItem({
                selfDeclaredMadeForKids: (event.currentTarget as HTMLInputElement).checked,
              })}
          />
          <span>This content is made for children</span>
        </label>
      </div>

      <div class="vc-field">
        <span class="vc-label">Embeddable</span>
        <label class="check-row">
          <input
            type="checkbox"
            checked={item.embeddable}
            onchange={(event) =>
              patchItem({ embeddable: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>Allow embedding on other sites</span>
        </label>
      </div>

      <div class="vc-field">
        <span class="vc-label">Public stats</span>
        <label class="check-row">
          <input
            type="checkbox"
            checked={item.publicStatsViewable}
            onchange={(event) =>
              patchItem({ publicStatsViewable: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>Make view count visible to others</span>
        </label>
      </div>

      <div class="vc-field">
        <span class="vc-label">AI-generated content</span>
        <label class="check-row">
          <input
            type="checkbox"
            checked={item.containsSyntheticMedia}
            onchange={(event) =>
              patchItem({
                containsSyntheticMedia: (event.currentTarget as HTMLInputElement).checked,
              })}
          />
          <span>Contains AI-generated content</span>
        </label>
      </div>

      <!-- Thumbnail (full width) -->
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

      <!-- Playlist ID (full width) -->
      <div class="vc-field field--full">
        <label class="vc-label" for="draft-playlist-{index}">Add to playlist (optional)</label>
        <input
          id="draft-playlist-{index}"
          class="vc-input"
          value={item.playlistId ?? ''}
          placeholder="PLxxxxxxxxxxxx..."
          oninput={(event) => {
            const val = (event.currentTarget as HTMLInputElement).value.trim();
            patchItem({ playlistId: val || undefined });
          }}
        />
      </div>
    </div>

    {#if item.transcriptExcerpt}
      <div class="excerpt">
        <p class="excerpt-eyebrow">Transcript excerpt</p>
        <p class="excerpt-text">{item.transcriptExcerpt}</p>
      </div>
    {/if}

    <div class="card-footer">
      <button
        class="vc-btn vc-btn--secondary vc-btn--sm"
        onclick={() => ongenerate?.({ index, item })}
      >
        <Icon name="sparkles" size={13} /> AI regenerate metadata
      </button>
    </div>
  {/if}
</article>

<style>
  .draft-card {
    display: flex;
    flex-direction: column;
    gap: 0;
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      background 0.15s;
  }

  .draft-card--selected {
    border-color: var(--vc-clay-500);
    box-shadow: 0 0 0 1px var(--vc-clay-500);
    background: var(--vc-clay-50);
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 0;
    flex-wrap: wrap;
  }

  .card-head__info {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }

  .card-head__controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--vc-divider);
    border-radius: var(--vc-radius-sm, 4px);
    background: transparent;
    color: var(--vc-text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .collapse-btn:hover {
    background: var(--vc-surface-hover, var(--vc-surface));
    color: var(--vc-text);
  }

  .collapse-btn :global(svg) {
    transition: transform 0.2s ease;
  }

  .collapse-btn.is-open :global(svg) {
    transform: rotate(180deg);
  }

  .card-summary {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    margin: 8px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
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
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-18);
    font-weight: 500;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
    color: var(--vc-text);
  }

  .card-meta {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    margin: 0;
  }

  .include-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--vc-text-13);
    font-weight: 500;
    color: var(--vc-text-muted);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .include-toggle input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: var(--vc-accent);
    cursor: pointer;
  }

  .field--full {
    grid-column: 1 / -1;
  }

  .check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    cursor: pointer;
    padding: 10px 0;
  }

  .check-row input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: var(--vc-accent);
    cursor: pointer;
    flex-shrink: 0;
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

  .card-footer {
    display: flex;
    justify-content: flex-start;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--vc-divider);
  }

  @media (max-width: 760px) {
    .card-head {
      flex-direction: column;
      align-items: flex-start;
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
