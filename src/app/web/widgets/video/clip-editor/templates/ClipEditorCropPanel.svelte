<script lang="ts">
  import type { ClipEditorCropPanelProps } from '@app/web/types/componentProps.js';
  import { isDefaultCrop } from '@lib/types/clipEdit.js';
  import SliderField from '@web/components/SliderField.svelte';
  import Button from '@web/components/Button.svelte';

  let { crop, onchange }: ClipEditorCropPanelProps = $props();

  const MAX_PCT = 45;

  function pct(fraction: number): number {
    return Math.round(fraction * 100);
  }

  function setEdge(edge: 'top' | 'right' | 'bottom' | 'left', valuePct: number): void {
    const next = { ...crop, [edge]: Math.max(0, Math.min(MAX_PCT, valuePct)) / 100 };
    onchange(next);
  }

  function reset(): void {
    onchange({ top: 0, right: 0, bottom: 0, left: 0 });
  }

  let isDefault = $derived(isDefaultCrop(crop));
</script>

<div class="crop-panel">
  <SliderField
    label="Top"
    value={pct(crop.top)}
    min={0}
    max={MAX_PCT}
    suffix="%"
    onchange={(v) => setEdge('top', v)}
  />
  <SliderField
    label="Right"
    value={pct(crop.right)}
    min={0}
    max={MAX_PCT}
    suffix="%"
    onchange={(v) => setEdge('right', v)}
  />
  <SliderField
    label="Bottom"
    value={pct(crop.bottom)}
    min={0}
    max={MAX_PCT}
    suffix="%"
    onchange={(v) => setEdge('bottom', v)}
  />
  <SliderField
    label="Left"
    value={pct(crop.left)}
    min={0}
    max={MAX_PCT}
    suffix="%"
    onchange={(v) => setEdge('left', v)}
  />

  <Button size="sm" variant="ghost" onclick={reset} disabled={isDefault}>Reset</Button>
</div>

<style>
  .crop-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
