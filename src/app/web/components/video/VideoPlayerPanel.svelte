<script lang="ts">
  import YouTubeEmbed from '@web/components/YouTubeEmbed.svelte';

  interface Props {
    videoId: string;
    title: string;
  }

  let { videoId, title }: Props = $props();
</script>

<div class="player-embed">
  <YouTubeEmbed {videoId} {title} />
</div>

<style>
  .player-embed {
    position: absolute;
    inset: 0;
  }

  .player-embed :global(.embed) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
</style>
