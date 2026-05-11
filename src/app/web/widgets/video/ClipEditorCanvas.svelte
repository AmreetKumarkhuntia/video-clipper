<script lang="ts">
  import type { ClipEditorCanvasProps } from '@app/web/types/componentProps.js';
  import { formatTime } from '@web/lib/format.js';
  import Icon from '@web/components/Icon.svelte';

  let {
    clip,
    edits,
    currentTime = $bindable(0),
    videoEl = $bindable<HTMLVideoElement | null>(null),
  }: ClipEditorCanvasProps = $props();

  let isPlaying = $state(false);

  const ASPECT_RATIOS: Record<string, string> = {
    '9:16': '9 / 16',
    '1:1': '1 / 1',
    '16:9': '16 / 9',
  };

  let aspectRatio = $derived(ASPECT_RATIOS[edits.viewport.preset] ?? '9 / 16');

  let activeSubtitleLine = $derived(
    edits.subtitles.find((s) => s.startSec <= currentTime && s.endSec > currentTime) ?? null,
  );

  let activeWordIndex = $derived(
    activeSubtitleLine
      ? activeSubtitleLine.words.findIndex(
          (w) => w.startSec <= currentTime && w.endSec > currentTime,
        )
      : -1,
  );

  let visibleOverlays = $derived(
    edits.overlays.filter((o) => o.startSec <= currentTime && o.endSec > currentTime),
  );

  function togglePlay(): void {
    if (!videoEl) return;
    if (videoEl.paused) {
      void videoEl.play();
      isPlaying = true;
    } else {
      videoEl.pause();
      isPlaying = false;
    }
  }

  function handleEnded(): void {
    isPlaying = false;
  }

  function handleScrub(e: Event): void {
    const target = e.currentTarget as HTMLInputElement;
    if (videoEl) videoEl.currentTime = Number(target.value);
  }
</script>

<div class="canvas-wrap">
  <div class="canvas-viewport" style="aspect-ratio: {aspectRatio}">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={videoEl}
      bind:currentTime
      src="/api/clips/{clip.id}/file"
      preload="metadata"
      class="canvas-video"
      onended={handleEnded}
    ></video>

    {#if activeSubtitleLine}
      <div
        class="canvas-subtitle"
        style="bottom: {(1 - activeSubtitleLine.position.yCenter) *
          100}%; font-size: {activeSubtitleLine.style.fontSize *
          0.045}cqw; font-weight: {activeSubtitleLine.style.weight};"
      >
        {#if activeSubtitleLine.words.length > 0}
          {#each activeSubtitleLine.words as word, wi}
            <span
              class="canvas-word"
              style="color: {wi === activeWordIndex
                ? activeSubtitleLine.style.highlightColor
                : activeSubtitleLine.style.color};"
              >{word.text}
            </span>
          {/each}
        {:else}
          <span style="color: {activeSubtitleLine.style.color};">{activeSubtitleLine.text}</span>
        {/if}
      </div>
    {/if}

    {#each visibleOverlays as overlay}
      <div
        class="canvas-overlay"
        style="left: {overlay.position.xCenter * 100}%; top: {overlay.position.yCenter *
          100}%; font-size: {overlay.style.fontSize * 0.045}cqw; color: {overlay.style
          .color}; font-weight: {overlay.style.weight};"
      >
        {overlay.text}
      </div>
    {/each}
  </div>

  <div class="canvas-controls">
    <button
      type="button"
      class="canvas-playbtn"
      onclick={togglePlay}
      aria-label={isPlaying ? 'Pause' : 'Play'}
    >
      <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
    </button>
    <span class="canvas-time">{formatTime(currentTime)} / {formatTime(clip.durationSec)}</span>
    <input
      type="range"
      class="canvas-scrubber"
      min="0"
      max={clip.durationSec}
      step="0.05"
      value={currentTime}
      oninput={handleScrub}
    />
  </div>
</div>

<style>
  .canvas-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    height: 100%;
    min-height: 0;
  }

  .canvas-viewport {
    position: relative;
    background: #000;
    overflow: hidden;
    border-radius: var(--vc-radius);
    width: 100%;
    max-height: calc(100% - 48px);
    container-type: size;
  }

  .canvas-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

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

  .canvas-overlay {
    position: absolute;
    transform: translate(-50%, -50%);
    text-align: center;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    white-space: pre-wrap;
  }

  .canvas-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 0 4px;
  }

  .canvas-playbtn {
    background: none;
    border: none;
    color: var(--vc-text);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .canvas-time {
    font-size: 12px;
    font-family: var(--vc-font-mono);
    color: var(--vc-text-subtle);
    flex-shrink: 0;
    min-width: 80px;
  }

  .canvas-scrubber {
    flex: 1;
    accent-color: var(--vc-clay-500, #c8553d);
  }
</style>
