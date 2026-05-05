<script lang="ts">
  import Button from '@web/components/Button.svelte';
  import FormField from '@web/components/FormField.svelte';
  import Panel from '@web/components/Panel.svelte';
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

<Panel tag="article">
  <div class="card-head">
    <div>
      <p class="eyebrow">Clip {index + 1}</p>
      <h2>{item.filename}</h2>
      <p class="meta">
        {formatTime(item.startSec)} to {formatTime(item.endSec)} · {formatDuration(
          item.durationSec,
        )}
      </p>
    </div>

    <label class="toggle">
      <input
        type="checkbox"
        checked={item.selected}
        onchange={(event) =>
          patchItem({ selected: (event.currentTarget as HTMLInputElement).checked })}
      />
      <span>Include in publish</span>
    </label>
  </div>

  <div class="field-grid">
    <!-- Row 1: Title (full width) -->
    <FormField label="Title" full>
      <input
        value={item.title}
        oninput={(event) => patchItem({ title: (event.currentTarget as HTMLInputElement).value })}
        maxlength="100"
      />
    </FormField>

    <!-- Row 2: Description (full width) -->
    <FormField label="Description" full>
      <textarea
        rows="5"
        oninput={(event) =>
          patchItem({ description: (event.currentTarget as HTMLTextAreaElement).value })}
        >{item.description}</textarea
      >
    </FormField>

    <!-- Row 3: Tags + Privacy -->
    <FormField label="Tags">
      <input
        value={item.tags.join(', ')}
        placeholder="tag1, tag2, tag3"
        oninput={(event) => updateTags((event.currentTarget as HTMLInputElement).value)}
      />
    </FormField>

    <FormField label="Privacy">
      <select
        value={item.privacyStatus}
        onchange={(event) =>
          patchItem({
            privacyStatus: (event.currentTarget as HTMLSelectElement).value as PublishPrivacyStatus,
          })}
      >
        {#each privacyOptions as option}
          <option value={option}>{option}</option>
        {/each}
      </select>
    </FormField>

    <!-- Row 4: Category + License -->
    <FormField label="Category">
      <select
        value={item.categoryId}
        onchange={(event) =>
          patchItem({ categoryId: (event.currentTarget as HTMLSelectElement).value })}
      >
        {#each Object.entries(YOUTUBE_CATEGORIES) as [id, label]}
          <option value={id}>{label}</option>
        {/each}
      </select>
    </FormField>

    <FormField label="License">
      <select
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
    </FormField>

    <!-- Row 5: Boolean toggles -->
    <FormField label="Made for kids">
      <label class="checkbox-label">
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
    </FormField>

    <FormField label="Embeddable">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={item.embeddable}
          onchange={(event) =>
            patchItem({ embeddable: (event.currentTarget as HTMLInputElement).checked })}
        />
        <span>Allow embedding on other sites</span>
      </label>
    </FormField>

    <FormField label="Public stats">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={item.publicStatsViewable}
          onchange={(event) =>
            patchItem({ publicStatsViewable: (event.currentTarget as HTMLInputElement).checked })}
        />
        <span>Make view count visible to others</span>
      </label>
    </FormField>

    <FormField label="AI-generated content">
      <label class="checkbox-label">
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
    </FormField>

    <!-- Row 6: Thumbnail (full width) -->
    <FormField label="Thumbnail" full>
      <div class="thumbnail-row">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange={handleThumbnailChange}
          disabled={isUploadingThumbnail}
          class="file-input"
        />
        {#if isUploadingThumbnail}
          <span class="thumb-status">Uploading...</span>
        {:else if item.thumbnailPath}
          <span class="thumb-status thumb-status--ok"
            >Saved: {item.thumbnailPath.split('/').pop()}</span
          >
        {/if}
        {#if thumbnailError}
          <span class="thumb-status thumb-status--err">{thumbnailError}</span>
        {/if}
      </div>
    </FormField>

    <!-- Row 7: Playlist ID (full width) -->
    <FormField label="Add to playlist (optional)" full>
      <input
        value={item.playlistId ?? ''}
        placeholder="PLxxxxxxxxxxxx..."
        oninput={(event) => {
          const val = (event.currentTarget as HTMLInputElement).value.trim();
          patchItem({ playlistId: val || undefined });
        }}
      />
    </FormField>
  </div>

  {#if item.transcriptExcerpt}
    <div class="excerpt">
      <p class="eyebrow">Transcript excerpt</p>
      <p>{item.transcriptExcerpt}</p>
    </div>
  {/if}

  <div class="actions">
    <Button variant="outline" on:click={() => ongenerate?.({ index, item })}>
      AI regenerate metadata
    </Button>
  </div>
</Panel>

<style>
  .actions {
    display: flex;
    justify-content: flex-start;
    margin-top: var(--s-lg);
  }

  .card-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--s-md);
    margin-bottom: var(--s-lg);
  }

  h2 {
    margin: 4px 0 0;
    font-size: 22px;
    line-height: 1.15;
  }

  .meta {
    margin: var(--s-xs) 0 0;
    color: var(--c-text-secondary);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--s-xs);
    color: var(--c-text-secondary);
    font-size: 14px;
    font-weight: var(--fw-semibold);
    white-space: nowrap;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-md);
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: var(--s-xs);
    font-size: 14px;
    color: var(--c-text-secondary);
    cursor: pointer;
    padding: 10px 0;
  }

  .checkbox-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    accent-color: var(--c-accent);
    cursor: pointer;
  }

  .thumbnail-row {
    display: flex;
    flex-direction: column;
    gap: var(--s-xs);
  }

  .file-input {
    font: inherit;
    color: var(--c-text-secondary);
    font-size: 14px;
  }

  .thumb-status {
    font-size: 13px;
    color: var(--c-text-muted);
  }

  .thumb-status--ok {
    color: var(--c-success, #16a34a);
  }

  .thumb-status--err {
    color: var(--c-error, #dc2626);
  }

  .excerpt {
    margin-top: var(--s-lg);
    padding-top: var(--s-md);
    border-top: 1px solid var(--c-border);
  }

  .excerpt p:last-child {
    margin: var(--s-xs) 0 0;
    color: var(--c-text-secondary);
    line-height: 1.6;
  }

  @media (max-width: 760px) {
    .card-head {
      flex-direction: column;
      align-items: start;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
