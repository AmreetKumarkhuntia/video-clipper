<script lang="ts">
  import type { ClipEditorCanvasProps } from '@app/web/types/componentProps.js';
  import { formatTime } from '@web/lib/format.js';
  import Icon from '@web/components/Icon.svelte';

  let {
    clip,
    edits,
    currentTime = $bindable(0),
    videoEl = $bindable<HTMLVideoElement | null>(null),
    selectedItemId,
    onSelectItem,
    onupdate,
  }: ClipEditorCanvasProps = $props();

  let isPlaying = $state(false);
  let viewportEl = $state<HTMLDivElement | null>(null);
  let currentlyDragging = false;

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

  function startOverlayDrag(
    e: PointerEvent,
    overlayId: string,
    origX: number,
    origY: number,
  ): void {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    currentlyDragging = false;

    function onMove(ev: PointerEvent): void {
      if (!viewportEl || !onupdate) return;
      if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
        currentlyDragging = true;
      }
      if (!currentlyDragging) return;
      const rect = viewportEl.getBoundingClientRect();
      const xCenter = Math.max(0, Math.min(1, origX + (ev.clientX - startX) / rect.width));
      const yCenter = Math.max(0, Math.min(1, origY + (ev.clientY - startY) / rect.height));
      onupdate({
        ...edits,
        overlays: edits.overlays.map((o) =>
          o.id === overlayId ? { ...o, position: { xCenter, yCenter } } : o,
        ),
      });
    }

    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setTimeout(() => {
        currentlyDragging = false;
      }, 0);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startFocusDrag(e: PointerEvent): void {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = edits.viewport.focus.xCenter;
    const origY = edits.viewport.focus.yCenter;

    function onMove(ev: PointerEvent): void {
      if (!viewportEl || !onupdate) return;
      const rect = viewportEl.getBoundingClientRect();
      const xCenter = Math.max(0, Math.min(1, origX + (ev.clientX - startX) / rect.width));
      const yCenter = Math.max(0, Math.min(1, origY + (ev.clientY - startY) / rect.height));
      onupdate({
        ...edits,
        viewport: { ...edits.viewport, focus: { xCenter, yCenter } },
      });
    }

    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
</script>

<div class="canvas-wrap">
  <div class="canvas-viewport" style="aspect-ratio: {aspectRatio}" bind:this={viewportEl}>
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
        class:canvas-overlay--selected={overlay.id === selectedItemId}
        style="left: {overlay.position.xCenter * 100}%; top: {overlay.position.yCenter *
          100}%; font-size: {overlay.style.fontSize * 0.045}cqw; color: {overlay.style
          .color}; font-weight: {overlay.style.weight};"
        role="button"
        tabindex="0"
        onpointerdown={(e) =>
          startOverlayDrag(e, overlay.id, overlay.position.xCenter, overlay.position.yCenter)}
        onclick={() => {
          if (!currentlyDragging) onSelectItem?.(overlay.id);
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectItem?.(overlay.id);
          }
        }}
      >
        {overlay.text}
      </div>
    {/each}

    {#if edits.viewport.fillMode === 'crop'}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="canvas-focus-handle"
        style="left: {edits.viewport.focus.xCenter * 100}%; top: {edits.viewport.focus.yCenter *
          100}%;"
        onpointerdown={startFocusDrag}
      ></div>
    {/if}
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
    white-space: pre-wrap;
    cursor: grab;
  }

  .canvas-overlay:active {
    cursor: grabbing;
  }

  .canvas-overlay--selected {
    outline: 2px solid rgba(255, 255, 255, 0.7);
    outline-offset: 4px;
    border-radius: 2px;
  }

  .canvas-focus-handle {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.5),
      0 0 8px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%);
    cursor: grab;
    z-index: 5;
  }

  .canvas-focus-handle:active {
    cursor: grabbing;
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
