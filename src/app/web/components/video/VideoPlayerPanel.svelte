<script lang="ts">
  import YouTubeEmbed from '@web/components/YouTubeEmbed.svelte';
  import type { VideoPlayerPanelProps } from '@app/web/types/componentProps.js';

  let { videoId, title }: VideoPlayerPanelProps = $props();
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
