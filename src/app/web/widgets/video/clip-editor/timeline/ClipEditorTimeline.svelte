<script lang="ts">
  import type { ClipEditorTimelineProps } from '@app/web/types/componentProps.js';
  import { formatTime } from '@web/lib/format.js';
  import Button from '@web/components/Button.svelte';
  import TimelineSegment from './TimelineSegment.svelte';

  let {
    edits,
    durationSec,
    currentTime,
    selectedItemId,
    onSelectItem,
    onupdate,
  }: ClipEditorTimelineProps = $props();

  const ZOOM_MIN = 3;

  let viewStart = $state(0);
  let viewEnd = $state(0);
  let subtitleTrackEl = $state<HTMLDivElement | null>(null);
  let overlayTrackEl = $state<HTMLDivElement | null>(null);
  let trimTrackEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    viewEnd = durationSec;
  });

  let viewDuration = $derived(viewEnd - viewStart);

  function computeTickInterval(sec: number): number {
    if (sec <= 10) return 1;
    if (sec <= 30) return 5;
    if (sec <= 120) return 15;
    return 30;
  }

  let ticks = $derived.by(() => {
    if (viewDuration <= 0) return [];
    const interval = computeTickInterval(viewDuration);
    const result: number[] = [];
    const start = Math.ceil(viewStart / interval) * interval;
    for (let t = start; t <= viewEnd; t += interval) result.push(t);
    return result;
  });

  function itemLeft(startSec: number): number {
    if (viewDuration <= 0) return 0;
    return ((startSec - viewStart) / viewDuration) * 100;
  }

  function itemWidth(startSec: number, endSec: number, trackEl: HTMLDivElement | null): number {
    if (viewDuration <= 0) return 0;
    const rawW = ((endSec - startSec) / viewDuration) * 100;
    const minW = trackEl ? (20 / trackEl.offsetWidth) * 100 : 0.5;
    return Math.max(rawW, minW);
  }

  let playheadPct = $derived(
    currentTime >= viewStart && currentTime <= viewEnd
      ? ((currentTime - viewStart) / viewDuration) * 100
      : -1,
  );

  function handleWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const trackEl = subtitleTrackEl ?? overlayTrackEl ?? trimTrackEl;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const cursorSec = viewStart + cursorRatio * viewDuration;
    const factor = e.deltaY > 0 ? 1.15 : 0.85;
    const newDur = Math.max(ZOOM_MIN, Math.min(durationSec, viewDuration * factor));
    const newStart = Math.max(0, cursorSec - cursorRatio * newDur);
    const newEnd = Math.min(durationSec, newStart + newDur);
    viewStart = newEnd === durationSec ? Math.max(0, durationSec - newDur) : newStart;
    viewEnd = viewStart + newDur;
  }

  function handleZoomOut(): void {
    viewStart = 0;
    viewEnd = durationSec;
  }

  function handleZoomStep(factor: number): void {
    const center = (viewStart + viewEnd) / 2;
    const newDur = Math.max(ZOOM_MIN, Math.min(durationSec, viewDuration * factor));
    const newStart = Math.max(0, center - newDur / 2);
    viewStart = Math.max(0, Math.min(durationSec - newDur, newStart));
    viewEnd = viewStart + newDur;
  }

  function startDrag(
    e: PointerEvent,
    kind: 'subtitle' | 'overlay' | 'trim',
    id: string,
    origStart: number,
    origEnd: number,
    mode: 'shift' | 'resize-start' | 'resize-end',
    trackEl: HTMLDivElement | null,
  ): void {
    if (!trackEl) return;
    e.stopPropagation();
    const startX = e.clientX;
    const trackWidth = trackEl.offsetWidth;
    let moved = false;

    function onMove(ev: PointerEvent): void {
      const delta = ((ev.clientX - startX) / trackWidth) * viewDuration;
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      if (!moved) return;

      let newStart = origStart;
      let newEnd = origEnd;

      if (mode === 'shift') {
        const dur = origEnd - origStart;
        newStart = Math.max(0, Math.min(durationSec - dur, origStart + delta));
        newEnd = newStart + dur;
      } else if (mode === 'resize-start') {
        newStart = Math.max(0, Math.min(origEnd - 0.1, origStart + delta));
      } else {
        newEnd = Math.min(durationSec, Math.max(origStart + 0.1, origEnd + delta));
      }

      patchEdits(kind, id, newStart, newEnd);
    }

    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved && mode === 'shift' && kind !== 'trim') {
        onSelectItem(id);
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function patchEdits(
    kind: 'subtitle' | 'overlay' | 'trim',
    id: string,
    newStart: number,
    newEnd: number,
  ): void {
    if (kind === 'subtitle') {
      onupdate({
        ...edits,
        subtitles: edits.subtitles.map((s) =>
          s.id === id ? { ...s, startSec: newStart, endSec: newEnd } : s,
        ),
      });
    } else if (kind === 'overlay') {
      onupdate({
        ...edits,
        overlays: edits.overlays.map((o) =>
          o.id === id ? { ...o, startSec: newStart, endSec: newEnd } : o,
        ),
      });
    } else {
      onupdate({ ...edits, trim: { startSec: newStart, endSec: newEnd } });
    }
  }
</script>

<div class="ce-timeline" onwheel={handleWheel}>
  <div class="ce-tl-top">
    <Button size="sm" onclick={handleZoomOut}>Fit all</Button>
    <span class="ce-tl-range">{formatTime(viewStart)} – {formatTime(viewEnd)}</span>
    <span class="ce-tl-cursor">cursor {formatTime(currentTime)}</span>
    <span class="spacer"></span>
    <Button size="sm" variant="ghost" onclick={() => handleZoomStep(1.25)} aria-label="Zoom out">
      −
    </Button>
    <Button size="sm" variant="ghost" onclick={() => handleZoomStep(0.8)} aria-label="Zoom in">
      +
    </Button>
  </div>

  <div class="ce-tl-tracks">
    <div class="ce-tl-track">
      <span class="ce-tl-lbl">Subs</span>
      <div class="ce-tl-body" bind:this={subtitleTrackEl}>
        {#each edits.subtitles as sub (sub.id)}
          {#if sub.startSec < viewEnd && sub.endSec > viewStart}
            <TimelineSegment
              kind="sub"
              leftPct={itemLeft(sub.startSec)}
              widthPct={itemWidth(sub.startSec, sub.endSec, subtitleTrackEl)}
              selected={sub.id === selectedItemId}
            >
              <div
                class="seg-handle seg-handle--l"
                role="presentation"
                onpointerdown={(e) =>
                  startDrag(
                    e,
                    'subtitle',
                    sub.id,
                    sub.startSec,
                    sub.endSec,
                    'resize-start',
                    subtitleTrackEl,
                  )}
              ></div>
              <div
                class="seg-body"
                role="button"
                tabindex="0"
                onpointerdown={(e) =>
                  startDrag(
                    e,
                    'subtitle',
                    sub.id,
                    sub.startSec,
                    sub.endSec,
                    'shift',
                    subtitleTrackEl,
                  )}
              >
                {sub.text}
              </div>
              <div
                class="seg-handle seg-handle--r"
                role="presentation"
                onpointerdown={(e) =>
                  startDrag(
                    e,
                    'subtitle',
                    sub.id,
                    sub.startSec,
                    sub.endSec,
                    'resize-end',
                    subtitleTrackEl,
                  )}
              ></div>
            </TimelineSegment>
          {/if}
        {/each}
      </div>
    </div>

    <div class="ce-tl-track">
      <span class="ce-tl-lbl">Ovlys</span>
      <div class="ce-tl-body" bind:this={overlayTrackEl}>
        {#each edits.overlays as ov (ov.id)}
          {#if ov.startSec < viewEnd && ov.endSec > viewStart}
            <TimelineSegment
              kind="overlay"
              leftPct={itemLeft(ov.startSec)}
              widthPct={itemWidth(ov.startSec, ov.endSec, overlayTrackEl)}
              selected={ov.id === selectedItemId}
            >
              <div
                class="seg-handle seg-handle--l"
                role="presentation"
                onpointerdown={(e) =>
                  startDrag(
                    e,
                    'overlay',
                    ov.id,
                    ov.startSec,
                    ov.endSec,
                    'resize-start',
                    overlayTrackEl,
                  )}
              ></div>
              <div
                class="seg-body"
                role="button"
                tabindex="0"
                onpointerdown={(e) =>
                  startDrag(e, 'overlay', ov.id, ov.startSec, ov.endSec, 'shift', overlayTrackEl)}
              >
                {ov.text}
              </div>
              <div
                class="seg-handle seg-handle--r"
                role="presentation"
                onpointerdown={(e) =>
                  startDrag(
                    e,
                    'overlay',
                    ov.id,
                    ov.startSec,
                    ov.endSec,
                    'resize-end',
                    overlayTrackEl,
                  )}
              ></div>
            </TimelineSegment>
          {/if}
        {/each}
      </div>
    </div>

    <div class="ce-tl-track">
      <span class="ce-tl-lbl">Trim</span>
      <div class="ce-tl-body" bind:this={trimTrackEl}>
        <TimelineSegment
          kind="trim"
          leftPct={itemLeft(edits.trim.startSec)}
          widthPct={itemWidth(edits.trim.startSec, edits.trim.endSec, trimTrackEl)}
        >
          <div
            class="trim-handle trim-handle--l"
            role="presentation"
            onpointerdown={(e) =>
              startDrag(
                e,
                'trim',
                'trim',
                edits.trim.startSec,
                edits.trim.endSec,
                'resize-start',
                trimTrackEl,
              )}
          ></div>
          <div
            class="trim-body"
            role="presentation"
            onpointerdown={(e) =>
              startDrag(
                e,
                'trim',
                'trim',
                edits.trim.startSec,
                edits.trim.endSec,
                'shift',
                trimTrackEl,
              )}
          ></div>
          <div
            class="trim-handle trim-handle--r"
            role="presentation"
            onpointerdown={(e) =>
              startDrag(
                e,
                'trim',
                'trim',
                edits.trim.startSec,
                edits.trim.endSec,
                'resize-end',
                trimTrackEl,
              )}
          ></div>
        </TimelineSegment>
      </div>
    </div>
  </div>

  <div class="ce-tl-ticks">
    {#each ticks as t (t)}
      <span>{formatTime(t)}</span>
    {/each}
  </div>

  {#if playheadPct >= 0}
    <div
      class="ce-tl-cursor-line"
      style="left: calc(66px + {playheadPct}% * (100% - 84px) / 100)"
    ></div>
  {/if}
</div>

<style>
  .ce-timeline {
    user-select: none;
  }

  .spacer {
    flex: 1;
  }

  .seg-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: rgba(255, 255, 255, 0.12);
    z-index: 2;
  }
  .seg-handle:hover {
    background: rgba(255, 255, 255, 0.28);
  }
  .seg-handle--l {
    left: 0;
  }
  .seg-handle--r {
    right: 0;
  }

  .seg-body {
    position: absolute;
    left: 6px;
    right: 6px;
    top: 0;
    bottom: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: grab;
    display: flex;
    align-items: center;
    padding: 0 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seg-body:active {
    cursor: grabbing;
  }

  .trim-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: rgba(255, 255, 255, 0.18);
    z-index: 2;
  }
  .trim-handle--l {
    left: 0;
  }
  .trim-handle--r {
    right: 0;
  }
  .trim-body {
    position: absolute;
    left: 6px;
    right: 6px;
    top: 0;
    bottom: 0;
    cursor: grab;
  }
  .trim-body:active {
    cursor: grabbing;
  }
</style>
