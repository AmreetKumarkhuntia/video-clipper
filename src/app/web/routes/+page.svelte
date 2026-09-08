<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';
  import Pagination from '@web/components/Pagination.svelte';
  import SectionHeader from '@web/components/SectionHeader.svelte';
  import LibraryVideoCard from '@web/widgets/LibraryVideoCard.svelte';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/stores/toast.js';
  import type { LibraryMembershipResponse } from '@lib/types/api.js';
  import type { LibraryVideoEntry } from '@lib/types/auth.js';
  import type { VideoSummary } from '@lib/types/youtube.js';

  let { data } = $props();

  let busyId = $state('');

  let hasPrev = $derived(data.page > 1);
  let hasNext = $derived(data.page * data.pageSize < data.total);
  let rangeStart = $derived(data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
  let rangeEnd = $derived(Math.min(data.page * data.pageSize, data.total));

  /** The card takes a catalog summary; a saved row carries the same fields. */
  function toSummary(entry: LibraryVideoEntry): VideoSummary {
    return {
      id: entry.videoId,
      channelId: entry.channelId,
      channelTitle: entry.channelTitle,
      title: entry.title,
      description: '',
      publishedAt: entry.publishedAt,
      durationSec: entry.durationSec,
      ...(entry.thumbnailUrl ? { thumbnail: { url: entry.thumbnailUrl } } : {}),
    };
  }

  async function remove(videoId: string): Promise<void> {
    busyId = videoId;
    try {
      await apiFetch<LibraryMembershipResponse>(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      // The list came from a server load, so the page has to re-ask rather than
      // splice locally — the row that fills the gap lives on the next page.
      await invalidateAll();
      showToast('success', 'Removed from your videos');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : String(error));
    } finally {
      busyId = '';
    }
  }

  function goToPage(next: number): void {
    void goto(next === 1 ? '/' : `/?page=${next}`, { noScroll: true });
  }
</script>

<svelte:head><title>My videos · Video Clipper</title></svelte:head>

<main class="main">
  {#if data.total === 0}
    <div class="empty">
      <div class="empty__glyph"><Icon name="video" size={28} /></div>
      <h1 class="empty__title">No videos yet</h1>
      <p class="empty__lede">
        Add videos from your channel and they will show up here, ready to analyse and clip.
      </p>
      <div class="library__cta">
        <Button variant="primary" href="/browse">Browse your channel</Button>
      </div>
    </div>
  {:else}
    <SectionHeader
      eyebrow="Library"
      title="My videos"
      subtitle={`Showing ${rangeStart}–${rangeEnd} of ${data.total}`}
    />

    <section class="clipgrid">
      {#each data.videos as entry (entry.videoId)}
        <LibraryVideoCard
          video={toSummary(entry)}
          saved
          busy={busyId === entry.videoId}
          onremove={remove}
        />
      {/each}
    </section>

    {#if hasPrev || hasNext}
      <Pagination
        {hasPrev}
        {hasNext}
        onprev={() => goToPage(data.page - 1)}
        onnext={() => goToPage(data.page + 1)}
      />
    {/if}
  {/if}
</main>

<style>
  .library__cta {
    margin-top: 18px;
  }
</style>
