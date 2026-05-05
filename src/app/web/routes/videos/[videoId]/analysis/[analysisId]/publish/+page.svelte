<script lang="ts">
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { streamUploads, type UploadQueueItem } from '@web/lib/uploadStream.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import NavLink from '@web/components/NavLink.svelte';
  import PageHead from '@web/components/PageHead.svelte';
  import Panel from '@web/components/Panel.svelte';
  import UploadStatusCard from '@web/components/publish/UploadStatusCard.svelte';
  import type { PublishDraft, UploadArtifact, YouTubeAuthStatus } from '@app/web/types/publish.js';

  let draft = $state<PublishDraft | null>(null);
  let authStatus = $state<YouTubeAuthStatus | null>(null);
  let uploads = $state<UploadArtifact[]>([]);
  let uploadQueue = $state<UploadQueueItem[]>([]);
  let isLoading = $state(false);
  let isUploading = $state(false);
  let errorMessage = $state('');

  let analysisId = $derived(page.params.analysisId);

  $effect(() => {
    if (analysisId) {
      void loadPage();
    }
  });

  async function loadPage(): Promise<void> {
    isLoading = true;
    errorMessage = '';

    try {
      const [draftData, authData, uploadData] = await Promise.all([
        apiFetch<{ draft: PublishDraft }>(`/api/publish/drafts/${analysisId}`),
        apiFetch<YouTubeAuthStatus>('/api/youtube/auth/status'),
        apiFetch<{ uploads: UploadArtifact[] }>(
          `/api/youtube/uploads?analysisId=${encodeURIComponent(analysisId)}`,
        ),
      ]);

      draft = draftData.draft;
      authStatus = authData;
      uploads = uploadData.uploads;
      resetQueue();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function uploadSelected(): Promise<void> {
    if (!draft) return;

    isUploading = true;
    errorMessage = '';
    resetQueue();

    try {
      const finalUploads = await streamUploads(analysisId, {
        onUploadStarted: (clipArtifactId) => {
          updateQueue(clipArtifactId, { status: 'uploading' });
        },
        onUploadFinished: (upload) => {
          updateQueue(upload.clipArtifactId, {
            status: 'uploaded',
            youtubeUrl: upload.youtubeUrl,
            youtubeVideoId: upload.youtubeVideoId,
          });
        },
        onUploadFailed: (upload) => {
          updateQueue(upload.clipArtifactId, {
            status: 'failed',
            error: upload.error,
          });
        },
        onComplete: (allUploads) => {
          uploads = allUploads;
        },
        onError: (message) => {
          errorMessage = message;
        },
      });

      uploads = finalUploads;
      showToast('success', 'Upload run completed.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', 'Failed to upload selected clips.');
    } finally {
      isUploading = false;
    }
  }

  function resetQueue(): void {
    uploadQueue =
      draft?.items
        .filter((item) => item.selected)
        .map((item) => ({
          clipArtifactId: item.clipArtifactId,
          title: item.title,
          status: 'queued',
        })) ?? [];
  }

  function updateQueue(clipArtifactId: string, patch: Partial<UploadQueueItem>): void {
    uploadQueue = uploadQueue.map((item) =>
      item.clipArtifactId === clipArtifactId ? { ...item, ...patch } : item,
    );
  }
</script>

{#if isLoading}
  <MutedText>Loading publish workspace...</MutedText>
{:else if errorMessage && !draft}
  <ErrorText message={errorMessage} />
{/if}

{#if draft}
  <PageHead eyebrow="Publish" heading="Upload prepared clips to your YouTube channel">
    <div class="actions" slot="action">
      <NavLink href={`/videos/${draft.videoId}/analysis/${draft.analysisId}/prepare`}>
        Back to Prepare
      </NavLink>
      <Button on:click={uploadSelected} disabled={isUploading || !authStatus?.connected}>
        {isUploading ? 'Uploading...' : 'Upload selected clips'}
      </Button>
    </div>
  </PageHead>

  {#if errorMessage}
    <ErrorText message={errorMessage} />
  {/if}

  <div class="publish-grid">
    <Panel tag="section">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Connected channel</p>
          <h2>{authStatus?.channel?.title ?? 'No connected channel'}</h2>
        </div>
      </div>

      <p class="helper">
        Uploading as {authStatus?.channel?.title}. {draft.items.filter((item) => item.selected)
          .length}
        clips are queued from this prepared draft.
      </p>
    </Panel>

    <Panel tag="section">
      <p class="eyebrow">Draft summary</p>
      <h2>{draft.title}</h2>
      <p class="helper">
        {draft.items.filter((item) => item.selected).length} of {draft.items.length} clips selected.
      </p>
      <ul class="draft-list">
        {#each draft.items.filter((item) => item.selected) as item}
          <li>
            <strong>{item.title}</strong>
            <span>{item.privacyStatus}</span>
          </li>
        {/each}
      </ul>
    </Panel>
  </div>

  <section class="history">
    <div class="history-head">
      <div>
        <p class="eyebrow">Upload queue</p>
        <h2>Live upload progress</h2>
      </div>
    </div>

    {#if uploadQueue.length === 0}
      <MutedText>No selected uploads queued yet.</MutedText>
    {:else}
      <div class="history-list">
        {#each uploadQueue as item (item.clipArtifactId)}
          <UploadStatusCard queueItem={item} />
        {/each}
      </div>
    {/if}
  </section>

  <section class="history">
    <div class="history-head">
      <div>
        <p class="eyebrow">Upload history</p>
        <h2>Recent publish attempts</h2>
      </div>
    </div>

    {#if uploads.length === 0}
      <MutedText>No uploads recorded yet.</MutedText>
    {:else}
      <div class="history-list">
        {#each uploads as upload (upload.id)}
          <UploadStatusCard {upload} />
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .actions {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

  .publish-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    gap: var(--s-lg);
  }

  .panel-head,
  .history-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--s-md);
    margin-bottom: var(--s-md);
  }

  h2 {
    margin: 4px 0 0;
    font-size: clamp(22px, 2.6vw, 28px);
    line-height: 1.12;
    overflow-wrap: anywhere;
  }

  .helper {
    margin: 0;
    color: var(--c-text-secondary);
    line-height: 1.6;
  }

  .draft-list {
    margin: var(--s-md) 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--s-sm);
  }

  .draft-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-md);
    padding: 12px 14px;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background: var(--c-surface-muted);
  }

  .draft-list strong {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .draft-list span {
    flex-shrink: 0;
    color: var(--c-text-muted);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .history {
    margin-top: var(--s-lg);
  }

  .history-list {
    display: grid;
    gap: var(--s-lg);
  }

  @media (max-width: 900px) {
    .publish-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .draft-list li {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
