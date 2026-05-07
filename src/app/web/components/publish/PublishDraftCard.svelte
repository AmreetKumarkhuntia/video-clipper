<script lang="ts">
  import Icon from '@web/components/Icon.svelte';
  import { formatDuration, formatTime } from '@web/lib/format.js';
  import Button from '@web/components/Button.svelte';
  import Field from '@web/components/Field.svelte';
  import InputText from '@web/components/InputText.svelte';
  import Textarea from '@web/components/Textarea.svelte';
  import Select from '@web/components/Select.svelte';
  import Checkbox from '@web/components/Checkbox.svelte';
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
      <Checkbox
        class="include-check"
        checked={item.selected}
        label="Include in publish"
        onchange={(checked) => patchItem({ selected: checked })}
      />
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
      <Field label="Title" for="draft-title-{index}" class="field--full">
        <InputText
          id="draft-title-{index}"
          value={item.title}
          maxlength={100}
          oninput={(v) => patchItem({ title: v })}
        />
      </Field>

      <!-- Description (full width) -->
      <Field label="Description" for="draft-desc-{index}" class="field--full">
        <Textarea
          id="draft-desc-{index}"
          value={item.description}
          rows={5}
          oninput={(v) => patchItem({ description: v })}
        />
      </Field>

      <!-- Tags -->
      <Field label="Tags" for="draft-tags-{index}">
        <InputText
          id="draft-tags-{index}"
          value={item.tags.join(', ')}
          placeholder="tag1, tag2, tag3"
          oninput={(v) => updateTags(v)}
        />
      </Field>

      <!-- Privacy -->
      <Field label="Privacy" for="draft-privacy-{index}">
        <Select
          id="draft-privacy-{index}"
          value={item.privacyStatus}
          options={privacyOptions.map((o) => ({ value: o, label: o }))}
          onchange={(v) => patchItem({ privacyStatus: v as PublishPrivacyStatus })}
        />
      </Field>

      <!-- Category -->
      <Field label="Category" for="draft-cat-{index}">
        <Select
          id="draft-cat-{index}"
          value={item.categoryId}
          options={Object.entries(YOUTUBE_CATEGORIES).map(([id, label]) => ({ value: id, label }))}
          onchange={(v) => patchItem({ categoryId: v })}
        />
      </Field>

      <!-- License -->
      <Field label="License" for="draft-license-{index}">
        <Select
          id="draft-license-{index}"
          value={item.license}
          options={licenseOptions}
          onchange={(v) => patchItem({ license: v as PublishLicense })}
        />
      </Field>

      <!-- Boolean toggles -->
      <div class="vc-field">
        <span class="vc-label">Format</span>
        <Checkbox
          checked={item.isShort}
          label="Upload as YouTube Short"
          onchange={(c) => patchItem({ isShort: c })}
        />
      </div>

      <div class="vc-field">
        <span class="vc-label">Made for kids</span>
        <Checkbox
          checked={item.selfDeclaredMadeForKids}
          label="This content is made for children"
          onchange={(c) => patchItem({ selfDeclaredMadeForKids: c })}
        />
      </div>

      <div class="vc-field">
        <span class="vc-label">Embeddable</span>
        <Checkbox
          checked={item.embeddable}
          label="Allow embedding on other sites"
          onchange={(c) => patchItem({ embeddable: c })}
        />
      </div>

      <div class="vc-field">
        <span class="vc-label">Public stats</span>
        <Checkbox
          checked={item.publicStatsViewable}
          label="Make view count visible to others"
          onchange={(c) => patchItem({ publicStatsViewable: c })}
        />
      </div>

      <div class="vc-field">
        <span class="vc-label">AI-generated content</span>
        <Checkbox
          checked={item.containsSyntheticMedia}
          label="Contains AI-generated content"
          onchange={(c) => patchItem({ containsSyntheticMedia: c })}
        />
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
      <Field label="Add to playlist (optional)" for="draft-playlist-{index}" class="field--full">
        <InputText
          id="draft-playlist-{index}"
          value={item.playlistId ?? ''}
          placeholder="PLxxxxxxxxxxxx..."
          oninput={(v) => patchItem({ playlistId: v.trim() || undefined })}
        />
      </Field>
    </div>

    {#if item.transcriptExcerpt}
      <div class="excerpt">
        <p class="excerpt-eyebrow">Transcript excerpt</p>
        <p class="excerpt-text">{item.transcriptExcerpt}</p>
      </div>
    {/if}

    <div class="card-footer">
      <Button variant="secondary" size="sm" onclick={() => ongenerate?.({ index, item })}>
        <Icon name="sparkles" size={13} /> AI regenerate metadata
      </Button>
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

  :global(.include-check) {
    font-size: var(--vc-text-13);
    font-weight: 500;
    color: var(--vc-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .field--full {
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
