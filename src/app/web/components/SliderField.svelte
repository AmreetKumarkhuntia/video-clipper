<script lang="ts">
  import type { SliderFieldProps } from '@app/web/types/componentProps.js';

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

<label class="ce-field">
  <span class="ce-field__label">{label}</span>
  <span class="ce-slider-row">
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
    <span class="ce-slider-row__v">{value}{suffix ?? ''}</span>
  </span>
</label>
