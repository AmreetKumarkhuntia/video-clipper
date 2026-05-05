<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import FormField from '@web/components/FormField.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import PageHead from '@web/components/PageHead.svelte';
  import PublishDraftCard from '@web/components/publish/PublishDraftCard.svelte';
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
    if (analysisId) {
      void loadDraft();
    }
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
    draft = {
      ...draft,
      items,
      updatedAt: new Date().toISOString(),
    };
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
      // Best-effort: fetch source video details for richer LLM context.
      // Silently omitted if YOUTUBE_API_KEY is not configured or the call fails.
      let videoDetails: VideoDetails | null = null;
      try {
        videoDetails = await apiFetch<VideoDetails>(`/api/youtube/videos/${videoId}`);
      } catch {
        // non-fatal — LLM will work without this context
      }

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
      return;
    } finally {
      isGenerating = false;
    }
  }

  async function generateAll(): Promise<void> {
    if (!draft) return;
    const selected = draft.items.filter((item) => item.selected);
    await generateMetadata(selected);
    if (!errorMessage) showToast('success', 'AI metadata generated for selected clips.');
  }

  async function generateOne(index: number, item: PublishDraftItem): Promise<void> {
    await generateMetadata([item]);
    if (!errorMessage) showToast('success', `AI metadata regenerated for clip ${index + 1}.`);
  }

  function updateDraftTitle(value: string): void {
    if (!draft) return;
    draft = {
      ...draft,
      title: value,
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
  <MutedText>Loading publish draft...</MutedText>
{:else if errorMessage && !draft}
  <ErrorText message={errorMessage} />
{/if}

{#if draft}
  <PageHead eyebrow="Prepare" heading="Review titles, descriptions, and privacy settings">
    <div class="actions" slot="action">
      <Button variant="outline" on:click={generateAll} disabled={isGenerating || isSaving}>
        {isGenerating ? 'Generating...' : 'Generate all with AI'}
      </Button>
      <Button variant="outline" on:click={continueToPublish} disabled={isGenerating || isSaving}>
        Continue to Publish
      </Button>
      <Button variant="outline" on:click={saveDraft} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save draft'}
      </Button>
    </div>
  </PageHead>

  <section class="draft-shell">
    <div class="draft-header">
      <FormField label="Workflow title">
        <input
          value={draft.title}
          oninput={(event) => updateDraftTitle((event.currentTarget as HTMLInputElement).value)}
        />
      </FormField>
      <p class="summary">
        {draft.items.filter((item) => item.selected).length} of {draft.items.length} clips selected for
        upload.
      </p>
    </div>

    {#if errorMessage}
      <ErrorText message={errorMessage} />
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
  </section>
{/if}

<style>
  .actions {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

  .draft-shell {
    display: grid;
    gap: var(--s-lg);
  }

  .draft-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s-md);
    align-items: end;
    padding: clamp(18px, 2.4vw, 28px);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl);
    background: color-mix(in srgb, var(--c-surface) 80%, white 20%);
    box-shadow: var(--shadow-soft);
  }

  .summary {
    margin: 0;
    color: var(--c-text-secondary);
    font-weight: var(--fw-semibold);
    white-space: nowrap;
  }

  .draft-list {
    display: grid;
    gap: var(--s-lg);
  }

  @media (max-width: 760px) {
    .actions,
    .draft-header {
      grid-template-columns: 1fr;
    }

    .actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .summary {
      white-space: normal;
    }
  }
</style>
