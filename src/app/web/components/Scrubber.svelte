<script lang="ts">
  import type { ScrubberProps } from '@app/web/types/componentProps.js';

  let { value, max, step = 0.05, disabled = false, ariaLabel, onchange }: ScrubberProps = $props();

  let trackEl = $state<HTMLDivElement | null>(null);
  let isDragging = $state(false);

  const fillPct = $derived(max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0);

  function valueFromClientX(clientX: number): number {
    if (!trackEl || max <= 0) return 0;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = ratio * max;
    return step > 0 ? Math.round(raw / step) * step : raw;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (disabled) return;
    isDragging = true;
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    onchange(valueFromClientX(event.clientX));
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging) return;
    onchange(valueFromClientX(event.clientX));
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
  }
</script>

<div
  bind:this={trackEl}
  class="ce-pb-track"
  class:is-disabled={disabled}
  role="slider"
  tabindex={disabled ? -1 : 0}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-label={ariaLabel}
  aria-disabled={disabled || undefined}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  <div class="ce-pb-fill" style="width: {fillPct}%">
    <span class="ce-pb-thumb"></span>
  </div>
</div>

<style>
  .is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
