<script lang="ts">
  import type { CanvasSubtitleProps } from '@app/web/types/componentProps.js';

  let { line, currentTime }: CanvasSubtitleProps = $props();

  let activeWordIndex = $derived(
    line.words.findIndex((w) => w.startSec <= currentTime && w.endSec > currentTime),
  );

  let bottomPct = $derived((1 - line.position.yCenter) * 100);
</script>

<div
  class="canvas-subtitle"
  style="bottom: {bottomPct}%; font-size: {line.style.fontSize * 0.045}cqw; font-weight: {line.style
    .weight};"
>
  {#if line.words.length > 0}
    {#each line.words as word, wi}
      <span
        class="canvas-word"
        style="color: {wi === activeWordIndex ? line.style.highlightColor : line.style.color};"
        >{word.text}
      </span>
    {/each}
  {:else}
    <span style="color: {line.style.color};">{line.text}</span>
  {/if}
</div>

<style>
  .canvas-subtitle {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    text-align: center;
    line-height: 1.3;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .canvas-word {
    display: inline;
  }
</style>
