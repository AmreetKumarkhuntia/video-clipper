<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/toastStore.js';
  import { configValues, configLoaded, initConfig } from '@web/lib/configStore.js';
  import { get } from 'svelte/store';
  import Icon from '@web/components/Icon.svelte';
  import PublishDraftCard from '@web/widgets/publish/PublishDraftCard.svelte';
  import PublishDraftEditor from '@web/widgets/publish/PublishDraftEditor.svelte';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';
  import Field from '@web/components/Field.svelte';
  import InputText from '@web/components/InputText.svelte';
  import Toggle from '@web/components/Toggle.svelte';
  import type { VideoDetails } from '@lib/types/index.js';
  import type {
    GeneratedPublishMetadata,
    PublishDraft,
    PublishDraftItem,
  } from '@app/web/types/publish.js';

  let draft = $state<PublishDraft | null>(null);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let isGenerating = $state(false);
  let errorMessage = $state('');
  let openIndex = $state<number | null>(null);
  let scheduleEnabled = $state(true);
  let scheduleStart = $state('');
  let scheduleInterval = $state(45);

  function toLocalDatetime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  let videoId = $derived(page.params.videoId);
  let analysisId = $derived(page.params.analysisId);

  $effect(() => {
    if (analysisId) void loadDraft();
    if (!get(configLoaded)) void initConfig();
  });

  $effect(() => {
    if (!get(configLoaded)) return;
    const vals = get(configValues);
    scheduleEnabled = vals.YT_SCHEDULE_ENABLED !== false;
    scheduleInterval =
      typeof vals.YT_SCHEDULE_INTERVAL_MIN === 'number' ? vals.YT_SCHEDULE_INTERVAL_MIN : 45;
  });

  $effect(() => {
    if (scheduleEnabled && !scheduleStart) {
      scheduleStart = toLocalDatetime(new Date());
    }
  });

  function applySchedule(): void {
    if (!draft || !scheduleEnabled || !scheduleStart) return;
    const start = new Date(scheduleStart).getTime();
    const intervalMs = scheduleInterval * 60_000;
    const selectedItems = draft.items.filter((i) => i.selected);
    let selectedIdx = 0;
    draft = {
      ...draft,
      items: draft.items.map((item) => {
        if (!item.selected) return { ...item, scheduledAt: undefined };
        const scheduledAt = new Date(start + selectedIdx * intervalMs).toISOString();
        selectedIdx++;
        return { ...item, scheduledAt };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  function clearSchedule(): void {
    if (!draft) return;
    draft = {
      ...draft,
      items: draft.items.map((item) => ({ ...item, scheduledAt: undefined })),
      updatedAt: new Date().toISOString(),
    };
  }

  function setScheduleNow(): void {
    scheduleStart = toLocalDatetime(new Date());
  }

  async function loadDraft(): Promise<void> {
    isLoading = true;
    errorMessage = '';
    try {
      const data = await apiFetch<{ draft: PublishDraft }>(`/api/publish/drafts/${analysisId}`);
      draft = data.draft;
    } catch (error) {
      draft = null;
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  function updateItem(index: number, item: PublishDraftItem): void {
    if (!draft) return;
    const items = draft.items.slice();
    items[index] = item;
    draft = { ...draft, items, updatedAt: new Date().toISOString() };
  }

  async function saveDraft(): Promise<void> {
    if (!draft) return;
    isSaving = true;
    errorMessage = '';
    try {
      const data = await apiFetch<{ draft: PublishDraft }>('/api/publish/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          analysisId: draft.analysisId,
          videoId: draft.videoId,
          title: draft.title,
          items: draft.items,
        }),
      });
      draft = data.draft;
      showToast('success', 'Publish draft saved.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', 'Failed to save publish draft.');
      throw error;
    } finally {
      isSaving = false;
    }
  }

  async function continueToPublish(): Promise<void> {
    try {
      await saveDraft();
    } catch {
      return;
    }
    await goto(`/videos/${videoId}/analysis/${analysisId}/publish`);
  }

  async function generateMetadata(items: PublishDraftItem[]): Promise<void> {
    if (!draft || items.length === 0) return;
    isGenerating = true;
    errorMessage = '';
    try {
      let videoDetails: VideoDetails | null = null;
      try {
        videoDetails = await apiFetch<VideoDetails>(`/api/youtube/videos/${videoId}`);
      } catch {}

      const data = await apiFetch<{ items: GeneratedPublishMetadata[] }>(
        '/api/publish/drafts/generate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workflowTitle: draft.title,
            items,
            videoDescription: videoDetails?.description || undefined,
            sourceChannelTitle: videoDetails?.channelTitle || undefined,
          }),
        },
      );
      applyGeneratedItems(data.items);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', 'Failed to generate metadata.');
    } finally {
      isGenerating = false;
    }
  }

  async function generateAll(): Promise<void> {
    if (!draft) return;
    await generateMetadata(draft.items.filter((item) => item.selected));
    if (!errorMessage) showToast('success', 'AI metadata generated for selected clips.');
  }

  async function generateOne(index: number, item: PublishDraftItem): Promise<void> {
    await generateMetadata([item]);
    if (!errorMessage) showToast('success', `AI metadata regenerated for clip ${index + 1}.`);
  }

  function updateDraftTitle(value: string): void {
    if (!draft) return;
    draft = { ...draft, title: value, updatedAt: new Date().toISOString() };
  }

  function selectAll(): void {
    if (!draft) return;
    draft = {
      ...draft,
      items: draft.items.map((i) => ({ ...i, selected: true })),
      updatedAt: new Date().toISOString(),
    };
  }

  function deselectAll(): void {
    if (!draft) return;
    draft = {
      ...draft,
      items: draft.items.map((i) => ({ ...i, selected: false })),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyGeneratedItems(items: GeneratedPublishMetadata[]): void {
    if (!draft || items.length === 0) return;
    const generatedById = new Map(items.map((item) => [item.clipArtifactId, item]));
    draft = {
      ...draft,
      items: draft.items.map((item) => {
        const generated = generatedById.get(item.clipArtifactId);
        if (!generated) return item;
        return {
          ...item,
          title: generated.title,
          description: generated.description,
          tags: generated.tags,
          categoryId: generated.categoryId,
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }
</script>

{#if isLoading}
  <div class="prepare-loading">
    <div class="sk sk--line" style="width:280px;height:16px"></div>
  </div>
{:else if errorMessage && !draft}
  <p class="prepare-error">{errorMessage}</p>
{/if}

{#if draft}
  <div class="prepare-page">
    <div class="prepare-head">
      <div>
        <p class="prepare-eyebrow">Step 4 · Prepare</p>
        <h2 class="prepare-title">Review titles &amp; descriptions</h2>
      </div>
      <div class="prepare-actions">
        <Button variant="secondary" onclick={selectAll} disabled={isGenerating || isSaving}>
          Select all
        </Button>
        <Button variant="secondary" onclick={deselectAll} disabled={isGenerating || isSaving}>
          Deselect all
        </Button>
        <Button variant="secondary" onclick={generateAll} disabled={isGenerating || isSaving}>
          {#if isGenerating}<Icon name="loader" size={13} /> Generating…{:else}<Icon
              name="sparkles"
              size={13}
            /> Generate all with AI{/if}
        </Button>
        <Button variant="secondary" onclick={saveDraft} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button variant="primary" onclick={continueToPublish} disabled={isGenerating || isSaving}>
          Continue to Publish <Icon name="arrow-right" size={14} />
        </Button>
      </div>
    </div>

    <!-- Workflow title -->
    <Card as="div" class="prepare-card-spaced">
      <div class="prepare-draft-header">
        <div style="flex:1">
          <Field label="Workflow title" for="draft-title">
            <InputText id="draft-title" value={draft.title} oninput={(v) => updateDraftTitle(v)} />
          </Field>
        </div>
        <p class="prepare-summary">
          {draft.items.filter((i) => i.selected).length} of {draft.items.length} clips selected
        </p>
      </div>
    </Card>

    <!-- Schedule section -->
    <Card as="div" class="prepare-card-spaced">
      <div class="schedule-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <label class="toggle-row" style="margin:0">
            <div class="toggle-row__text">
              <span class="toggle-row__t">Schedule publish</span>
              <span class="toggle-row__d">
                {scheduleEnabled
                  ? 'Clips will go live at staggered times'
                  : 'Publish immediately on upload'}
              </span>
            </div>
            <Toggle
              checked={scheduleEnabled}
              ariaLabel="Schedule publish"
              onchange={(c) => {
                scheduleEnabled = c;
                if (c) applySchedule();
                else clearSchedule();
              }}
            />
          </label>
        </div>
      </div>
      {#if scheduleEnabled}
        <div class="schedule-controls">
          <Field label="Start time" for="schedule-start">
            <div class="schedule-datetime-row">
              <input
                id="schedule-start"
                type="datetime-local"
                class="schedule-datetime-input"
                bind:value={scheduleStart}
                onchange={() => applySchedule()}
              />
              <Button variant="ghost" size="sm" onclick={setScheduleNow}>Now</Button>
            </div>
          </Field>
          <Field label="Interval (minutes)" for="schedule-interval">
            <InputText
              id="schedule-interval"
              type="number"
              value={String(scheduleInterval)}
              min={1}
              oninput={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) {
                  scheduleInterval = n;
                  applySchedule();
                }
              }}
            />
          </Field>
          <div class="schedule-actions">
            <Button variant="secondary" size="sm" onclick={applySchedule}>
              <Icon name="clock" size={13} /> Apply schedule
            </Button>
          </div>
        </div>
        {#if draft}
          <div class="schedule-preview">
            {#each draft.items.filter((i) => i.selected) as item, idx (item.clipArtifactId)}
              <span class="schedule-chip">
                <span class="schedule-chip__label">Clip {idx + 1}</span>
                <span class="schedule-chip__time">
                  {#if item.scheduledAt}
                    {new Date(item.scheduledAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  {:else}
                    —
                  {/if}
                </span>
              </span>
            {/each}
          </div>
        {/if}
      {/if}
    </Card>

    <div class="draft-grid">
      {#each draft.items as item, index (item.clipArtifactId)}
        <PublishDraftCard
          {item}
          {index}
          onupdate={(detail) => updateItem(detail.index, detail.item)}
          onopen={(detail) => (openIndex = detail.index)}
        />
      {/each}
    </div>
  </div>
{/if}

{#if draft && openIndex !== null}
  <PublishDraftEditor
    item={draft.items[openIndex]}
    index={openIndex}
    onupdate={(detail) => updateItem(detail.index, detail.item)}
    ongenerate={(detail) => generateOne(detail.index, detail.item)}
    onclose={() => (openIndex = null)}
  />
{/if}

<style>
  .prepare-loading,
  .prepare-error {
    padding: 24px 0;
  }
  .prepare-error {
    color: var(--vc-error);
    font-size: var(--vc-text-14);
  }

  .prepare-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .prepare-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .prepare-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .prepare-title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-26);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--vc-text);
  }

  .prepare-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.prepare-card-spaced) {
    margin-bottom: 20px;
  }

  .prepare-draft-header {
    display: flex;
    align-items: flex-end;
    gap: 16px;
  }

  .prepare-summary {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    margin: 0;
    white-space: nowrap;
    padding-bottom: 10px;
  }

  .draft-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .schedule-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .schedule-controls {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--vc-divider);
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

  .schedule-actions {
    padding-bottom: 4px;
  }

  .schedule-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 12px;
    border-top: 1px solid var(--vc-divider);
  }

  .schedule-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--vc-divider);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface-raised);
    font-size: var(--vc-text-13);
  }

  .schedule-chip__label {
    color: var(--vc-text-muted);
  }

  .schedule-chip__time {
    color: var(--vc-text);
    font-weight: 500;
  }
</style>
