<script lang="ts">
  import type { ClipEditorCanvasProps } from '@app/web/types/componentProps.js';
  import type { TextOverlay } from '@lib/types/clipEdit.js';
  import CanvasSubtitle from './CanvasSubtitle.svelte';
  import CanvasOverlay from './CanvasOverlay.svelte';
  import FocusPicker from './FocusPicker.svelte';
  import PlaybackBar from './PlaybackBar.svelte';

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

  const ASPECT_RATIOS: Record<string, string> = {
    '9:16': '9 / 16',
    '1:1': '1 / 1',
    '16:9': '16 / 9',
  };

  let aspectRatio = $derived(ASPECT_RATIOS[edits.viewport.preset] ?? '9 / 16');

  // For crop mode the canvas must show the video cropped to the output aspect ratio — matching
  // what FFmpeg will produce — so that subtitle/overlay positions reference visible content, not
  // letterbox bars. object-position mirrors the user-controlled focus point.
  // For pad modes (pad-blur, pad-black) the video IS letterboxed in the output too, so
  // object-fit:contain is correct and position math already matches.
  let videoStyle = $derived(
    edits.viewport.fillMode === 'crop'
      ? `object-fit:cover;object-position:${edits.viewport.focus.xCenter * 100}% ${edits.viewport.focus.yCenter * 100}%`
      : 'object-fit:contain',
  );

  let activeSubtitleLine = $derived(
    edits.subtitles.find((s) => s.startSec <= currentTime && s.endSec > currentTime) ?? null,
  );

  let visibleOverlays = $derived(
    edits.overlays.filter((o) => o.startSec <= currentTime && o.endSec > currentTime),
  );

  // Trim: duration shown in the timeline/playback bar is the trimmed length.
  let trimDuration = $derived(edits.trim.endSec - edits.trim.startSec);

  // Clamp playback to [trim.startSec, trim.endSec].
  $effect(() => {
    if (!videoEl) return;
    if (currentTime >= edits.trim.endSec) {
      videoEl.pause();
      videoEl.currentTime = edits.trim.endSec;
    }
  });

  // Seek to trim start whenever the trim window changes.
  $effect(() => {
    const start = edits.trim.startSec;
    if (videoEl && videoEl.currentTime < start) {
      videoEl.currentTime = start;
    }
  });

  function handlePlay(): void {
    isPlaying = true;
  }
  function handlePause(): void {
    isPlaying = false;
  }
  function handleEnded(): void {
    isPlaying = false;
  }

  function handleFocusChange(focus: { xCenter: number; yCenter: number }): void {
    onupdate?.({ ...edits, viewport: { ...edits.viewport, focus } });
  }

  function handleOverlayUpdate(next: TextOverlay): void {
    if (!onupdate) return;
    onupdate({
      ...edits,
      overlays: edits.overlays.map((o) => (o.id === next.id ? next : o)),
    });
  }
</script>

<div class="canvas-wrap">
  <div class="canvas-stage">
    <div class="canvas-viewport" style="aspect-ratio: {aspectRatio}" bind:this={viewportEl}>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        bind:currentTime
        src="/api/clips/{clip.id}/file?variant=original"
        preload="metadata"
        class="canvas-video"
        style={videoStyle}
        onplay={handlePlay}
        onpause={handlePause}
        onended={handleEnded}
      ></video>

      {#if activeSubtitleLine}
        <CanvasSubtitle line={activeSubtitleLine} {currentTime} />
      {/if}

      {#each visibleOverlays as overlay (overlay.id)}
        <CanvasOverlay
          {overlay}
          selected={overlay.id === selectedItemId}
          containerEl={viewportEl}
          onSelect={() => onSelectItem?.(overlay.id)}
          onUpdate={handleOverlayUpdate}
        />
      {/each}

      {#if edits.viewport.fillMode === 'crop'}
        <FocusPicker
          focus={edits.viewport.focus}
          containerEl={viewportEl}
          onchange={handleFocusChange}
        />
      {/if}
    </div>
  </div>

  <PlaybackBar {videoEl} {currentTime} durationSec={trimDuration} {isPlaying} />
</div>

<style>
  .canvas-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .canvas-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    min-height: 0;
    overflow: hidden;
  }

  .canvas-viewport {
    position: relative;
    background: #000;
    border-radius: var(--vc-radius);
    overflow: hidden;
    height: 100%;
    max-width: 100%;
    container-type: size;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }

  .canvas-video {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
