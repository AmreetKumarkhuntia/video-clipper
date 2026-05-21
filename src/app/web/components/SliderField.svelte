<script lang="ts">
  import type { SliderFieldProps } from '@app/web/types/componentProps.js';
  import Field from '@web/components/Field.svelte';

  let {
    label,
    value,
    min,
    max,
    step = 1,
    suffix,
    disabled = false,
    onchange,
  }: SliderFieldProps = $props();

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = Number(target.value);
    if (!Number.isNaN(parsed)) onchange(parsed);
  }
</script>

<Field {label}>
  <div class="slider-row">
    <input
      type="range"
      class="vc-slider"
      {min}
      {max}
      {step}
      {value}
      {disabled}
      oninput={handleInput}
    />
    <span class="slider-val">{value}{suffix ?? ''}</span>
  </div>
</Field>

<style>
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slider-row :global(.vc-slider) {
    flex: 1;
  }

  .slider-val {
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-12);
    color: var(--vc-text);
    min-width: 36px;
    text-align: right;
  }
</style>
