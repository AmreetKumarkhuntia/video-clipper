<script lang="ts">
  import type { ClipCandidate } from '@app/web/types/analysis.js';
  import type { ClipTimelineProps } from '@app/web/types/componentProps.js';
  import { formatTime } from '@web/lib/format.js';
  import Button from '@web/components/Button.svelte';

  let {
    durationSec,
    candidates,
    activeCandidateId,
    isStreaming = false,
    onSelect,
  }: ClipTimelineProps = $props();

  const ZOOM_MIN = 30;
  const PADDING_FACTOR = 1.5;

  let viewStart = $state(0);
  let viewEnd = $state(0);
  let detailTrackEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    viewEnd = durationSec;
  });

  let viewDuration = $derived(viewEnd - viewStart);

  function computeTickInterval(sec: number): number {
    if (sec <= 30) return 5;
    if (sec <= 120) return 15;
    if (sec <= 300) return 30;
    if (sec <= 600) return 60;
    if (sec <= 1800) return 300;
    return 600;
  }

  let minimapTicks = $derived.by(() => {
    if (durationSec <= 0) return [];
    const interval = computeTickInterval(durationSec);
    const result: number[] = [];
    for (let t = 0; t <= durationSec; t += interval) {
      result.push(t);
    }
    return result;
  });

  let detailTicks = $derived.by(() => {
    if (viewDuration <= 0) return [];
    const interval = computeTickInterval(viewDuration);
    const result: number[] = [];
    const start = Math.ceil(viewStart / interval) * interval;
    for (let t = start; t <= viewEnd; t += interval) {
      result.push(t);
    }
    return result;
  });

  let minimapViewportStyle = $derived(
    `left:${(viewStart / durationSec) * 100}%;width:${(viewDuration / durationSec) * 100}%`,
  );

  function minimapSegStyle(c: ClipCandidate): string {
    const left = (c.startSec / durationSec) * 100;
    const width = ((c.endSec - c.startSec) / durationSec) * 100;
    return `left:${left}%;width:${Math.max(width, 0.3)}%`;
  }

  function detailSegStyle(c: ClipCandidate): string {
    const left = ((c.startSec - viewStart) / viewDuration) * 100;
    const width = ((c.endSec - c.startSec) / viewDuration) * 100;
    const minWidth = (24 / (detailTrackEl?.offsetWidth ?? 600)) * 100;
    const finalWidth = Math.max(width, minWidth);
    const centeredLeft = width < minWidth ? left - (minWidth - width) / 2 : left;
    return `left:${centeredLeft}%;width:${finalWidth}%`;
  }

  function minimapTickStyle(t: number): string {
    return `left:${(t / durationSec) * 100}%`;
  }

  function detailTickStyle(t: number): string {
    return `left:${((t - viewStart) / viewDuration) * 100}%`;
  }

  function detailVisibleCandidates(): ClipCandidate[] {
    return candidates.filter((c) => c.startSec < viewEnd && c.endSec > viewStart);
  }

  function zoomToSegment(c: ClipCandidate): void {
    const segDur = c.endSec - c.startSec;
    const padding = segDur * PADDING_FACTOR;
    const newStart = Math.max(0, c.startSec - padding);
    const newEnd = Math.min(durationSec, c.endSec + padding);
    if (newEnd - newStart < ZOOM_MIN) {
      const center = (c.startSec + c.endSec) / 2;
      viewStart = Math.max(0, center - ZOOM_MIN / 2);
      viewEnd = Math.min(durationSec, viewStart + ZOOM_MIN);
    } else {
      viewStart = newStart;
      viewEnd = newEnd;
    }
  }

  function handleSelect(c: ClipCandidate): void {
    zoomToSegment(c);
    onSelect?.(c.id);
  }

  function handleMinimapClick(e: MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const center = ratio * durationSec;
    const halfView = viewDuration / 2;
    viewStart = Math.max(0, center - halfView);
    viewEnd = Math.min(durationSec, viewStart + viewDuration);
    if (viewEnd === durationSec) {
      viewStart = Math.max(0, durationSec - viewDuration);
    }
  }

  function handleWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorRatio = (e.clientX - rect.left) / rect.width;
    const cursorSec = viewStart + cursorRatio * viewDuration;

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    let newDuration = viewDuration * zoomFactor;
    newDuration = Math.max(ZOOM_MIN, Math.min(durationSec, newDuration));

    const newStart = Math.max(0, cursorSec - cursorRatio * newDuration);
    const newEnd = Math.min(durationSec, newStart + newDuration);

    viewStart = newEnd === durationSec ? Math.max(0, durationSec - newDuration) : newStart;
    viewEnd = viewStart + newDuration;
  }

  function handleZoomOut(): void {
    viewStart = 0;
    viewEnd = durationSec;
  }
</script>

<div class="timeline">
  <div class="timeline__head">
    <div>
      {#if activeCandidateId}
        {@const active = candidates.find((c) => c.id === activeCandidateId)}
        {#if active}
          <span class="timeline__active-time"
            >{formatTime(active.startSec)} → {formatTime(active.endSec)}</span
          >
        {:else}
          <span class="timeline__count">
            {candidates.length} segments{isStreaming ? ' · streaming' : ''}
          </span>
        {/if}
      {:else}
        <span class="timeline__count">
          {candidates.length} segments{isStreaming ? ' · streaming' : ''}
        </span>
      {/if}
    </div>
    <div class="timeline__head-right">
      <Button variant="ghost" size="sm" onclick={handleZoomOut} title="Zoom out to full video">
        Fit all
      </Button>
      <span class="timeline__duration">/ {formatTime(durationSec)}</span>
    </div>
  </div>

  <!-- Minimap -->
  <div class="timeline__minimap">
    <div class="timeline__minimap-label">Overview</div>
    <div class="timeline__minimap-track" onclick={handleMinimapClick} role="presentation">
      {#each candidates as candidate (candidate.id)}
        <div
          class="timeline__mm-seg"
          class:timeline__mm-seg--active={candidate.id === activeCandidateId}
          style={minimapSegStyle(candidate)}
          title="{formatTime(candidate.startSec)} → {formatTime(candidate.endSec)}"
        ></div>
      {/each}
      <div class="timeline__viewport" style={minimapViewportStyle}></div>
    </div>
    <div class="timeline__minimap-ticks">
      {#each minimapTicks as t}
        <span style={minimapTickStyle(t)}>{formatTime(t)}</span>
      {/each}
    </div>
  </div>

  <!-- Detail track -->
  <div class="timeline__detail">
    <div class="timeline__detail-label">
      {formatTime(viewStart)} — {formatTime(viewEnd)}
    </div>
    <div
      class="timeline__detail-track"
      bind:this={detailTrackEl}
      onwheel={handleWheel}
      role="group"
      aria-label="Zoomed timeline"
    >
      {#if isStreaming}
        <div class="timeline__skeleton" style="left:0;right:0"></div>
      {/if}
      {#each detailVisibleCandidates() as candidate (candidate.id)}
        <button
          class="timeline__seg"
          class:timeline__seg--active={candidate.id === activeCandidateId}
          style={detailSegStyle(candidate)}
          onclick={() => handleSelect(candidate)}
          type="button"
          title="{formatTime(candidate.startSec)} → {formatTime(
            candidate.endSec,
          )} · score {candidate.score}/10"
        >
          <span class="timeline__seg__label">{String(candidate.rank).padStart(2, '0')}</span>
        </button>
      {/each}
    </div>
    <div class="timeline__detail-ticks">
      {#each detailTicks as t}
        <span style={detailTickStyle(t)}>{formatTime(t)}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .timeline {
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    padding: 14px 16px;
  }

  .timeline__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-12);
    color: var(--vc-text-subtle);
    margin-bottom: 12px;
  }

  .timeline__head-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .timeline__active-time {
    color: var(--vc-clay-600);
    font-weight: 600;
  }

  :global([data-theme='dark']) .timeline__active-time {
    color: var(--vc-clay-400);
  }

  .timeline__count {
    color: var(--vc-text-muted);
  }

  .timeline__duration {
    color: var(--vc-text-subtle);
  }

  /* Minimap */
  .timeline__minimap {
    margin-bottom: 12px;
  }

  .timeline__minimap-label,
  .timeline__detail-label {
    font-family: var(--vc-font-mono);
    font-size: 10px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .timeline__minimap-track {
    position: relative;
    height: 24px;
    background: var(--vc-surface-2);
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
  }

  .timeline__mm-seg {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--vc-clay-soft);
    border-left: 1px solid var(--vc-clay-500);
    border-right: 1px solid var(--vc-clay-500);
    pointer-events: none;
  }

  .timeline__mm-seg--active {
    background: var(--vc-clay-200);
    border-color: var(--vc-clay-600);
    z-index: 2;
  }

  .timeline__viewport {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--vc-clay-100);
    border: 1px solid var(--vc-clay-500);
    border-radius: 2px;
    pointer-events: none;
    opacity: 0.5;
  }

  :global([data-theme='dark']) .timeline__viewport {
    background: var(--vc-clay-500);
    opacity: 0.25;
  }

  .timeline__minimap-ticks {
    position: relative;
    height: 12px;
    margin-top: 3px;
    font-family: var(--vc-font-mono);
    font-size: 9px;
    color: var(--vc-text-subtle);
  }

  .timeline__minimap-ticks span {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  /* Detail track */
  .timeline__detail {
    border-top: 1px solid var(--vc-divider);
    padding-top: 10px;
  }

  .timeline__detail-label {
    margin-bottom: 6px;
  }

  .timeline__detail-track {
    position: relative;
    height: 40px;
    background: var(--vc-surface-2);
    border-radius: var(--vc-radius-sm);
    overflow: hidden;
  }

  .timeline__seg {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--vc-clay-soft);
    border-left: 2px solid var(--vc-clay-500);
    border-right: 2px solid var(--vc-clay-500);
    cursor: pointer;
    transition:
      background var(--vc-dur-fast) var(--vc-ease),
      border-color var(--vc-dur-fast) var(--vc-ease);
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    min-width: 24px;
  }

  .timeline__seg:hover {
    background: var(--vc-clay-100);
  }

  .timeline__seg--active {
    background: var(--vc-clay-100);
    border-color: var(--vc-clay-600);
    z-index: 2;
    box-shadow: 0 0 0 1px var(--vc-clay-500);
  }

  .timeline__seg__label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-clay-700);
    pointer-events: none;
    white-space: nowrap;
  }

  :global([data-theme='dark']) .timeline__seg__label {
    color: var(--vc-clay-400);
  }

  .timeline__detail-ticks {
    position: relative;
    height: 14px;
    margin-top: 4px;
    font-family: var(--vc-font-mono);
    font-size: 10px;
    color: var(--vc-text-subtle);
  }

  .timeline__detail-ticks span {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    white-space: nowrap;
  }
</style>
