<script lang="ts">
  import Panel from '@web/components/Panel.svelte';
  import YouTubeEmbed from '@web/components/YouTubeEmbed.svelte';

  export let videoId: string;
  export let title: string;
</script>

<Panel tag="section" padded={false}>
  <div class="video-panel">
    <YouTubeEmbed {videoId} {title} />
  </div>
</Panel>

<style>
  .video-panel {
    padding: 16px;
  }
</style>
