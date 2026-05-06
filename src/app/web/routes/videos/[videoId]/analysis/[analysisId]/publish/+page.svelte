<script lang="ts">
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { streamUploads, type UploadQueueItem } from '@web/lib/uploadStream.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Icon from '@web/components/Icon.svelte';
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
    if (analysisId) void loadPage();
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
  <div class="publish-loading">
    <div class="sk sk--line" style="width:220px;height:16px;margin-bottom:10px"></div>
    <div class="sk sk--line sk--short"></div>
  </div>
{:else if errorMessage && !draft}
  <p class="publish-error">{errorMessage}</p>
{/if}

{#if draft}
  <div class="publish-page">
    <div class="publish-head">
      <div>
        <p class="publish-eyebrow">Step 5 · Publish</p>
        <h2 class="publish-title">Upload clips to YouTube</h2>
        <p class="publish-sub">Upload your prepared clips to your connected YouTube channel.</p>
      </div>
      <div class="publish-nav">
        <a
          href={`/videos/${draft.videoId}/analysis/${draft.analysisId}/prepare`}
          class="vc-btn vc-btn--secondary vc-btn--sm"
        >
          ← Back to Prepare
        </a>
        <button
          class="vc-btn vc-btn--primary"
          onclick={uploadSelected}
          disabled={isUploading || !authStatus?.connected}
        >
          {#if isUploading}
            <Icon name="loader" size={14} /> Uploading…
          {:else}
            <Icon name="upload" size={14} /> Upload selected clips
          {/if}
        </button>
      </div>
    </div>

    {#if errorMessage}
      <p class="publish-error">{errorMessage}</p>
    {/if}

    <!-- Summary cards -->
    <div class="summary-grid">
      <div class="vc-card">
        <p class="sect-eyebrow">Connected channel</p>
        <p class="sect-title">{authStatus?.channel?.title ?? 'No connected channel'}</p>
        <p class="sect-body">
          {#if authStatus?.connected}
            Uploading as <strong>{authStatus.channel?.title}</strong>.
          {:else}
            No channel connected. Go back to the <a
              href={`/videos/${draft.videoId}/analysis/${draft.analysisId}/connect`}
              class="vc-link">Connect</a
            > step.
          {/if}
        </p>
      </div>

      <div class="vc-card">
        <p class="sect-eyebrow">Draft summary</p>
        <p class="sect-title">{draft.title}</p>
        <p class="sect-body">
          {draft.items.filter((i) => i.selected).length} of {draft.items.length} clips selected.
        </p>
        <ul class="draft-list">
          {#each draft.items.filter((i) => i.selected) as item (item.clipArtifactId)}
            <li class="draft-item">
              <span class="draft-item__title">{item.title}</span>
              <span class="draft-item__privacy">{item.privacyStatus}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <!-- Live upload queue -->
    <section class="history-sect">
      <div class="history-head">
        <p class="sect-eyebrow">Upload queue</p>
        <h3 class="sect-heading">Live upload progress</h3>
      </div>
      {#if uploadQueue.length === 0}
        <p class="publish-muted">No uploads queued yet. Select clips and press Upload.</p>
      {:else}
        <div class="history-list">
          {#each uploadQueue as item (item.clipArtifactId)}
            <UploadStatusCard queueItem={item} />
          {/each}
        </div>
      {/if}
    </section>

    <!-- Upload history -->
    <section class="history-sect">
      <div class="history-head">
        <p class="sect-eyebrow">Upload history</p>
        <h3 class="sect-heading">Recent publish attempts</h3>
      </div>
      {#if uploads.length === 0}
        <p class="publish-muted">No uploads recorded yet.</p>
      {:else}
        <div class="history-list">
          {#each uploads as upload (upload.id)}
            <UploadStatusCard {upload} />
          {/each}
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  .publish-loading {
    padding: 24px 0;
  }
  .publish-error {
    color: var(--vc-error);
    font-size: var(--vc-text-14);
    margin-bottom: 16px;
  }
  .publish-muted {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    margin: 0;
  }

  .publish-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .publish-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .publish-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .publish-title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-26);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
    color: var(--vc-text);
  }

  .publish-sub {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    margin: 0;
  }

  .publish-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Summary grid */
  .summary-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 16px;
    margin-bottom: 28px;
  }

  .sect-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .sect-title {
    font-size: var(--vc-text-18);
    font-weight: 500;
    color: var(--vc-text);
    margin: 0 0 8px;
    overflow-wrap: anywhere;
  }

  .sect-body {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .vc-link {
    color: var(--vc-accent);
    text-decoration: none;
  }
  .vc-link:hover {
    text-decoration: underline;
  }

  .draft-list {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .draft-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--vc-divider);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface-raised);
  }

  .draft-item__title {
    font-size: var(--vc-text-13);
    color: var(--vc-text);
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .draft-item__privacy {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--vc-text-subtle);
  }

  /* History sections */
  .history-sect {
    margin-bottom: 28px;
  }

  .history-head {
    margin-bottom: 14px;
  }

  .sect-heading {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-18);
    font-weight: 500;
    letter-spacing: -0.01em;
    margin: 0;
    color: var(--vc-text);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  @media (max-width: 900px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .publish-nav {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
