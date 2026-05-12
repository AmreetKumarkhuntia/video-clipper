<script lang="ts">
  import type { ClipEditorTimelineProps } from '@app/web/types/componentProps.js';
  import { formatTime } from '@web/lib/format.js';

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

  function tickLeft(t: number): number {
    if (viewDuration <= 0) return 0;
    return ((t - viewStart) / viewDuration) * 100;
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

<div class="tl" onwheel={handleWheel}>
  <div class="tl-head">
    <button class="tl-fit-btn" type="button" onclick={handleZoomOut}>Fit all</button>
    <span class="tl-range">{formatTime(viewStart)} – {formatTime(viewEnd)}</span>
  </div>

  <div class="tl-lanes">
    <!-- Subtitles lane -->
    <div class="tl-lane">
      <span class="tl-lane-label">Subs</span>
      <div class="tl-track" bind:this={subtitleTrackEl}>
        {#if playheadPct >= 0}
          <div class="tl-playhead" style="left:{playheadPct}%"></div>
        {/if}
        {#each edits.subtitles as sub (sub.id)}
          {#if sub.startSec < viewEnd && sub.endSec > viewStart}
            <div
              class="tl-item"
              class:tl-item--selected={sub.id === selectedItemId}
              style="left:{itemLeft(sub.startSec)}%;width:{itemWidth(
                sub.startSec,
                sub.endSec,
                subtitleTrackEl,
              )}%"
            >
              <div
                class="tl-handle tl-handle--l"
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
                class="tl-item-body"
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
                <span class="tl-item-label">{sub.text}</span>
              </div>
              <div
                class="tl-handle tl-handle--r"
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
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Overlays lane -->
    <div class="tl-lane">
      <span class="tl-lane-label">Ovlys</span>
      <div class="tl-track" bind:this={overlayTrackEl}>
        {#if playheadPct >= 0}
          <div class="tl-playhead" style="left:{playheadPct}%"></div>
        {/if}
        {#each edits.overlays as ov (ov.id)}
          {#if ov.startSec < viewEnd && ov.endSec > viewStart}
            <div
              class="tl-item tl-item--overlay"
              class:tl-item--selected={ov.id === selectedItemId}
              style="left:{itemLeft(ov.startSec)}%;width:{itemWidth(
                ov.startSec,
                ov.endSec,
                overlayTrackEl,
              )}%"
            >
              <div
                class="tl-handle tl-handle--l"
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
                class="tl-item-body"
                role="button"
                tabindex="0"
                onpointerdown={(e) =>
                  startDrag(e, 'overlay', ov.id, ov.startSec, ov.endSec, 'shift', overlayTrackEl)}
              >
                <span class="tl-item-label">{ov.text}</span>
              </div>
              <div
                class="tl-handle tl-handle--r"
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
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Trim lane -->
    <div class="tl-lane">
      <span class="tl-lane-label">Trim</span>
      <div class="tl-track" bind:this={trimTrackEl}>
        {#if playheadPct >= 0}
          <div class="tl-playhead" style="left:{playheadPct}%"></div>
        {/if}
        <div
          class="tl-item tl-item--trim"
          style="left:{itemLeft(edits.trim.startSec)}%;width:{itemWidth(
            edits.trim.startSec,
            edits.trim.endSec,
            trimTrackEl,
          )}%"
        >
          <div
            class="tl-handle tl-handle--l"
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
            class="tl-item-body"
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
            class="tl-handle tl-handle--r"
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
        </div>
      </div>
    </div>

    <!-- Tick ruler aligned to tracks via same grid -->
    <div class="tl-lane tl-lane--ticks">
      <span></span>
      <div class="tl-ticks">
        {#each ticks as t}
          <span class="tl-tick" style="left:{tickLeft(t)}%">{formatTime(t)}</span>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .tl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    user-select: none;
  }

  .tl-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
  }

  .tl-fit-btn {
    font-family: var(--vc-font-mono);
    font-size: 10px;
    color: var(--vc-text-muted);
    background: var(--vc-surface-raised, #1a1a1a);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-sm, 4px);
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .tl-fit-btn:hover {
    background: var(--vc-surface-hover, #252525);
    color: var(--vc-text);
  }

  .tl-range {
    color: var(--vc-text-muted);
  }

  .tl-lanes {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tl-lane {
    display: grid;
    grid-template-columns: 40px 1fr;
    align-items: center;
    gap: 6px;
  }

  .tl-lane--ticks {
    margin-top: 2px;
  }

  .tl-lane-label {
    font-family: var(--vc-font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vc-text-subtle);
    text-align: right;
    padding-right: 2px;
  }

  .tl-track {
    position: relative;
    height: 28px;
    background: var(--vc-surface-2, rgba(255, 255, 255, 0.04));
    border-radius: var(--vc-radius-sm, 4px);
    overflow: hidden;
  }

  .tl-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--vc-clay-500, #c8553d);
    pointer-events: none;
    z-index: 10;
    transform: translateX(-50%);
  }

  .tl-item {
    position: absolute;
    top: 3px;
    bottom: 3px;
    display: flex;
    border-radius: 3px;
    background: var(--vc-clay-soft, rgba(200, 85, 61, 0.18));
    border: 1px solid var(--vc-clay-500, #c8553d);
  }

  .tl-item--overlay {
    background: rgba(100, 120, 200, 0.18);
    border-color: #6478c8;
  }

  .tl-item--trim {
    background: rgba(60, 160, 100, 0.18);
    border-color: #3ca064;
    top: 5px;
    bottom: 5px;
  }

  .tl-item--selected {
    box-shadow: 0 0 0 1px var(--vc-clay-500, #c8553d);
    z-index: 5;
  }

  .tl-item--overlay.tl-item--selected {
    box-shadow: 0 0 0 1px #6478c8;
  }

  .tl-handle {
    width: 6px;
    flex-shrink: 0;
    cursor: col-resize;
    background: rgba(255, 255, 255, 0.12);
    z-index: 2;
  }

  .tl-handle:hover {
    background: rgba(255, 255, 255, 0.28);
  }

  .tl-item-body {
    flex: 1;
    min-width: 0;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    overflow: hidden;
  }

  .tl-item-body:active {
    cursor: grabbing;
  }

  .tl-item-label {
    font-family: var(--vc-font-mono);
    font-size: 9px;
    color: var(--vc-text-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  .tl-ticks {
    position: relative;
    height: 14px;
  }

  .tl-tick {
    position: absolute;
    top: 0;
    font-family: var(--vc-font-mono);
    font-size: 9px;
    color: var(--vc-text-subtle);
    transform: translateX(-50%);
    white-space: nowrap;
  }
</style>
