<script lang="ts">
  export let videoId = '';
  export let title = '';
  export let startSec: number | undefined = undefined;
</script>

{#key startSec}
  <div class="embed">
    <iframe
      {title}
      src={`https://www.youtube.com/embed/${videoId}${startSec != null ? `?start=${Math.floor(startSec)}` : ''}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </div>
{/key}

<style>
  .embed {
    overflow: hidden;
    aspect-ratio: 16 / 9;
    border-radius: var(--vc-radius-md);
    background: var(--vc-overlay);
  }

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>
