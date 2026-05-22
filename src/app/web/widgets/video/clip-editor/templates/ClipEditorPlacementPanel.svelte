<script lang="ts">
  import type { ClipEditorPlacementPanelProps } from '@app/web/types/componentProps.js';
  import { isPlacementIdentity } from '@lib/types/clipEdit.js';
  import SliderField from '@web/components/SliderField.svelte';
  import Button from '@web/components/Button.svelte';

  let { placement, onchange }: ClipEditorPlacementPanelProps = $props();

  const OFFSET_MIN_PCT = -50;
  const OFFSET_MAX_PCT = 50;
  const SCALE_MIN_PCT = 25;
  const SCALE_MAX_PCT = 400;

  function pct(fraction: number): number {
    return Math.round(fraction * 100);
  }

  function setOffset(axis: 'offsetX' | 'offsetY', valuePct: number): void {
    const clamped = Math.max(OFFSET_MIN_PCT, Math.min(OFFSET_MAX_PCT, valuePct)) / 100;
    onchange({ ...placement, [axis]: clamped });
  }

  function setScale(valuePct: number): void {
    const clamped = Math.max(SCALE_MIN_PCT, Math.min(SCALE_MAX_PCT, valuePct)) / 100;
    onchange({ ...placement, scale: clamped });
  }

  function reset(): void {
    onchange({ offsetX: 0, offsetY: 0, scale: 1 });
  }

  let isIdentity = $derived(isPlacementIdentity(placement));
</script>

<div class="placement-panel">
  <SliderField
    label="Offset X"
    value={pct(placement.offsetX)}
    min={OFFSET_MIN_PCT}
    max={OFFSET_MAX_PCT}
    suffix="%"
    onchange={(v) => setOffset('offsetX', v)}
  />
  <SliderField
    label="Offset Y"
    value={pct(placement.offsetY)}
    min={OFFSET_MIN_PCT}
    max={OFFSET_MAX_PCT}
    suffix="%"
    onchange={(v) => setOffset('offsetY', v)}
  />
  <SliderField
    label="Scale"
    value={pct(placement.scale)}
    min={SCALE_MIN_PCT}
    max={SCALE_MAX_PCT}
    step={5}
    suffix="%"
    onchange={setScale}
  />

  <Button size="sm" variant="ghost" onclick={reset} disabled={isIdentity}>Reset</Button>
</div>

<style>
  .placement-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
