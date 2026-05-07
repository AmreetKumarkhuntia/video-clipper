<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Icon from '@web/components/Icon.svelte';
  import PublishDraftCard from '@web/components/publish/PublishDraftCard.svelte';
  import Button from '@web/components/Button.svelte';
  import Field from '@web/components/Field.svelte';
  import InputText from '@web/components/InputText.svelte';
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

  let videoId = $derived(page.params.videoId);
  let analysisId = $derived(page.params.analysisId);

  $effect(() => {
    if (analysisId) void loadDraft();
  });

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
    <div class="vc-card" style="margin-bottom:20px">
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
    </div>

    {#if errorMessage}
      <p class="prepare-error">{errorMessage}</p>
    {/if}

    <div class="draft-list">
      {#each draft.items as item, index (item.clipArtifactId)}
        <PublishDraftCard
          {item}
          {index}
          onupdate={(detail) => updateItem(detail.index, detail.item)}
          ongenerate={(detail) => generateOne(detail.index, detail.item)}
        />
      {/each}
    </div>
  </div>
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

  .draft-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
