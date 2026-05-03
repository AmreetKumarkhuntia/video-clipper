<script lang="ts">
  import { page } from '$app/stores';
  import type { VideoPage } from '@lib/types/index.js';
  import { apiFetch } from '$lib/api.js';
  import ErrorText from '../../../components/ErrorText.svelte';
  import MutedText from '../../../components/MutedText.svelte';
  import PageHead from '../../../components/PageHead.svelte';
  import VideoCard from '../../../components/VideoCard.svelte';
  import Pagination from '../../../components/Pagination.svelte';

  let videos: VideoPage['videos'] = [];
  let nextPageToken: string | undefined;
  let prevPageToken: string | undefined;
  let isLoading = false;
  let errorMessage = '';

  $: channelId = $page.params.channelId;

  $: if (channelId) {
    void loadVideos();
  }

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

<PageHead eyebrow="Channel" heading="Uploaded videos">
  <a slot="action" href="/">Change channel</a>
</PageHead>

{#if isLoading}
  <MutedText>Loading videos...</MutedText>
{:else if errorMessage}
  <ErrorText message={errorMessage} />
{:else if videos.length === 0}
  <MutedText>No public uploads found for this channel.</MutedText>
{:else}
  <section class="video-grid" aria-label="Channel videos">
    {#each videos as video}
      <VideoCard {video} />
    {/each}
  </section>

  <Pagination
    hasPrev={!!prevPageToken}
    hasNext={!!nextPageToken}
    on:prev={() => loadVideos(prevPageToken)}
    on:next={() => loadVideos(nextPageToken)}
  />
{/if}

<style>
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--s-lg) var(--s-md);
  }
</style>
