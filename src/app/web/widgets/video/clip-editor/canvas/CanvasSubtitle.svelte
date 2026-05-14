<script lang="ts">
  import type { CanvasSubtitleProps } from '@app/web/types/componentProps.js';

  let { line, currentTime }: CanvasSubtitleProps = $props();

  let activeWordIndex = $derived(
    line.words.findIndex((w) => w.startSec <= currentTime && w.endSec > currentTime),
  );

  let bottomPct = $derived((1 - line.position.yCenter) * 100);

  // Mirror the 90%-wide centered block from CSS, switching anchor based on align.
  // Canvas margin on each side = 5% (half of the 10% that "width: 90%" leaves out).
  let alignStyle = $derived(
    line.style.align === 'left'
      ? 'left: 5%; right: auto; transform: none; text-align: left;'
      : line.style.align === 'right'
        ? 'left: auto; right: 5%; transform: none; text-align: right;'
        : 'left: 50%; right: auto; transform: translateX(-50%); text-align: center;',
  );
</script>

<div
  class="canvas-subtitle"
  style="bottom: {bottomPct}%; font-size: {line.style.fontSize * 0.045}cqw; font-weight: {line.style
    .weight}; {alignStyle}"
>
  {#if line.words.length > 0}
    {#each line.words as word, wi}
      <span
        class="canvas-word"
        style="color: {wi === activeWordIndex ? line.style.highlightColor : line.style.color};"
        >{word.text}</span
      >{#if wi < line.words.length - 1}{' '}{/if}
    {/each}
  {:else}
    <span style="color: {line.style.color};">{line.text}</span>
  {/if}
</div>

<style>
  .canvas-subtitle {
    position: absolute;
    width: 90%;
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
