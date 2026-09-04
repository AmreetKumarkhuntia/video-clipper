<script lang="ts">
  import Badge from '@web/components/Badge.svelte';
  import Button from '@web/components/Button.svelte';
  import { formatDuration } from '@web/lib/format.js';
  import type { LibraryVideoCardProps } from '@app/web/types/componentProps.js';

  let {
    video,
    href = `/videos/${video.id}`,
    saved = false,
    busy = false,
    onadd,
    onremove,
  }: LibraryVideoCardProps = $props();
</script>

<!--
  The link covers the thumbnail and title only. The actions row sits outside it,
  because a button nested inside an anchor is invalid and the click targets fight.
-->
<article class="clipcard libcard">
  <a class="libcard__link" {href}>
    <div class="clipcard__thumb libcard__thumb">
      {#if video.thumbnail}
        <img src={video.thumbnail.url} alt="" loading="lazy" />
      {/if}
      <span class="clipcard__thumb-time">{formatDuration(video.durationSec)}</span>
    </div>
    <h2 class="clipcard__title libcard__title">{video.title}</h2>
  </a>

  <div class="clipcard__body libcard__body">
    <p class="libcard__meta">{new Date(video.publishedAt).toLocaleDateString()}</p>

    <div class="clipcard__actions">
      {#if saved}
        <Badge variant="success">Added</Badge>
        {#if onremove}
          <Button variant="ghost" size="sm" disabled={busy} onclick={() => onremove?.(video.id)}>
            Remove
          </Button>
        {/if}
      {:else if onadd}
        <Button variant="primary" size="sm" disabled={busy} onclick={() => onadd?.(video.id)}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
      {/if}
    </div>
  </div>
</article>

<style>
  .libcard {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .libcard__link {
    display: block;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  .libcard__link:focus-visible {
    outline: 2px solid var(--vc-clay-500);
    outline-offset: 2px;
  }

  /* 16:9 for source videos; the shared .clipcard__thumb is tuned for vertical clips. */
  .libcard__thumb {
    aspect-ratio: 16 / 9;
  }

  .libcard__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .libcard__title {
    padding: 10px 12px 0;
  }

  .libcard__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    justify-content: space-between;
  }

  .libcard__meta {
    margin: 0;
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
  }
</style>
