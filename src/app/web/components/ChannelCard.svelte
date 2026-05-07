<script lang="ts">
  import Button from '@web/components/Button.svelte';
  import type { ChannelCardProps } from '@app/web/types/componentProps.js';

  let { channel }: ChannelCardProps = $props();
</script>

<article class="channel-card">
  {#if channel.thumbnail}
    <img src={channel.thumbnail.url} alt="" />
  {/if}
  <div>
    <p class="card-eyebrow">Channel found</p>
    <h2 class="card-title">{channel.title}</h2>
    <p class="card-desc">{channel.description}</p>
    <Button variant="primary" href={`/channels/${channel.id}`}>Browse videos</Button>
  </div>
</article>

<style>
  .channel-card {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 18px;
    align-items: start;
    padding: 18px 0;
    border-top: 1px solid var(--vc-divider);
  }

  .channel-card img {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
  }

  .card-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .card-title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-21);
    font-weight: 500;
    letter-spacing: -0.01em;
    margin: 0 0 8px;
    color: var(--vc-text);
  }

  .card-desc {
    display: -webkit-box;
    max-width: 680px;
    margin: 0 0 14px;
    overflow: hidden;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
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
