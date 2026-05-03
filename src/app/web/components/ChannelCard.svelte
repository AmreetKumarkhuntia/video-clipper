<script lang="ts">
  import type { ChannelSummary } from '@lib/types/index.js';

  export let channel: ChannelSummary;
</script>

<article class="channel-card">
  {#if channel.thumbnail}
    <img src={channel.thumbnail.url} alt="" />
  {/if}
  <div>
    <p class="eyebrow">Channel found</p>
    <h2>{channel.title}</h2>
    <p class="description">{channel.description}</p>
    <a class="btn-link" href={`/channels/${channel.id}`}>Browse videos</a>
  </div>
</article>

<style>
  .channel-card {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 18px;
    align-items: start;
    padding: 18px 0;
    border-top: 1px solid var(--c-border);
  }

  .channel-card img {
    width: 96px;
    height: 96px;
    border-radius: var(--r-full);
    object-fit: cover;
  }

  h2 {
    margin: 4px 0 var(--s-sm);
    font-size: 24px;
  }

  .description {
    display: -webkit-box;
    max-width: 680px;
    margin: 0 0 var(--s-md);
    overflow: hidden;
    color: var(--c-text-muted);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .btn-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border-radius: var(--r-md);
    background: var(--c-primary);
    color: var(--c-primary-text);
    font-weight: var(--fw-bold);
  }

  @media (max-width: 620px) {
    .channel-card {
      grid-template-columns: 1fr;
    }

    .channel-card img {
      width: 72px;
      height: 72px;
    }
  }
</style>
