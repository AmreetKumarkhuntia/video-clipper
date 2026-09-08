<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';
  import Icon from '@web/components/Icon.svelte';
  import Pagination from '@web/components/Pagination.svelte';
  import SectionHeader from '@web/components/SectionHeader.svelte';
  import Skeleton from '@web/components/Skeleton.svelte';
  import LibraryVideoCard from '@web/widgets/LibraryVideoCard.svelte';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/stores/toast.js';
  import type { ChannelVideosResponse, LibraryMembershipResponse } from '@lib/types/api.js';
  import type { VideoSummary } from '@lib/types/youtube.js';

  // Browse hits the slow YouTube API, so it loads on the client with a skeleton
  // grid. The library, which reads our own database, uses a server load instead.
  let videos = $state<VideoSummary[]>([]);
  let savedIds = $state<string[]>([]);
  let nextPageToken = $state<string | undefined>(undefined);
  let prevPageToken = $state<string | undefined>(undefined);
  let isLoading = $state(true);
  let errorMessage = $state('');
  let busyId = $state('');

  async function loadVideos(pageToken?: string): Promise<void> {
    isLoading = true;
    errorMessage = '';
    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const data = await apiFetch<ChannelVideosResponse>(`/api/channel/videos${query}`);
      videos = data.videos;
      savedIds = data.savedIds;
      nextPageToken = data.nextPageToken;
      prevPageToken = data.prevPageToken;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function add(videoId: string): Promise<void> {
    busyId = videoId;
    try {
      await apiFetch<LibraryMembershipResponse>(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'POST',
      });
      // Marked locally rather than refetching: the page is a YouTube API call
      // that costs quota, and only this one card's state changed.
      savedIds = [...savedIds, videoId];
      showToast('success', 'Added to your videos');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : String(error));
    } finally {
      busyId = '';
    }
  }

  onMount(() => {
    void loadVideos();
  });
</script>

<svelte:head><title>Browse your channel · Video Clipper</title></svelte:head>

<main class="main">
  <SectionHeader
    eyebrow="Your channel"
    title="Browse uploads"
    subtitle="Add the videos you want to turn into clips."
  />

  {#if isLoading}
    <section class="clipgrid">
      {#each Array(8) as _, i (i)}
        <Card>
          <Skeleton height="140px" />
          <Skeleton />
          <Skeleton short />
        </Card>
      {/each}
    </section>
  {:else if errorMessage}
    <p class="error-text">{errorMessage}</p>
  {:else if videos.length === 0}
    <div class="empty">
      <div class="empty__glyph"><Icon name="youtube" size={28} /></div>
      <h2 class="empty__title">No public uploads found</h2>
      <p class="empty__lede">
        Private and unlisted uploads are not listed here yet. Only public videos on your channel
        appear.
      </p>
      <div class="browse__cta"><Button variant="secondary" href="/">Back to my videos</Button></div>
    </div>
  {:else}
    <section class="clipgrid">
      {#each videos as video (video.id)}
        <LibraryVideoCard
          {video}
          saved={savedIds.includes(video.id)}
          busy={busyId === video.id}
          onadd={add}
        />
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
</main>

<style>
  .browse__cta {
    margin-top: 18px;
  }
</style>
