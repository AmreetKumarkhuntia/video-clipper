<script lang="ts">
  import { page } from '$app/state';
  import type { VideoPage } from '@lib/types/index.js';
  import { apiFetch } from '@web/lib/api.js';
  import VideoCard from '@web/widgets/VideoCard.svelte';
  import Pagination from '@web/components/Pagination.svelte';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';

  let channelId = $derived(page.params.channelId);

  let videos = $state<VideoPage['videos']>([]);
  let nextPageToken = $state<string | undefined>(undefined);
  let prevPageToken = $state<string | undefined>(undefined);
  let isLoading = $state(false);
  let errorMessage = $state('');

  $effect(() => {
    if (channelId) void loadVideos();
  });

  async function loadVideos(pageToken?: string): Promise<void> {
    isLoading = true;
    errorMessage = '';
    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const data = await apiFetch<VideoPage>(`/api/youtube/channels/${channelId}/videos${query}`);
      videos = data.videos;
      nextPageToken = data.nextPageToken;
      prevPageToken = data.prevPageToken;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="channel-page">
  <div class="channel-page__head">
    <div>
      <p class="channel-page__eyebrow">Channel</p>
      <h2 class="channel-page__title">Uploaded videos</h2>
    </div>
    <Button variant="secondary" size="sm" href="/">Change channel</Button>
  </div>

  {#if isLoading}
    <div class="clipgrid">
      {#each Array(8) as _}
        <Card class="clipcard">
          <div class="clipcard__thumb"><div class="clipcard__thumb-bg"></div></div>
          <div class="clipcard__body">
            <div class="sk sk--line" style="width:90%;margin-bottom:8px"></div>
            <div class="sk sk--line sk--short"></div>
          </div>
        </Card>
      {/each}
    </div>
  {:else if errorMessage}
    <p class="error-msg">{errorMessage}</p>
  {:else if videos.length === 0}
    <p class="empty-msg">No public uploads found for this channel.</p>
  {:else}
    <section class="clipgrid" aria-label="Channel videos">
      {#each videos as video}
        <VideoCard {video} />
      {/each}
    </section>

    {#if prevPageToken || nextPageToken}
      <Pagination
        hasPrev={!!prevPageToken}
        hasNext={!!nextPageToken}
        onprev={() => loadVideos(prevPageToken)}
        onnext={() => loadVideos(nextPageToken)}
      />
    {/if}
  {/if}
</div>

<style>
  .channel-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }

  .channel-page__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
  }

  .channel-page__eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .channel-page__title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-32);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--vc-text);
  }

  .error-msg {
    color: var(--vc-error);
    font-size: var(--vc-text-14);
  }

  .empty-msg {
    color: var(--vc-text-muted);
    font-size: var(--vc-text-14);
  }
</style>
