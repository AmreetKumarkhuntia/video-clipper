<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: number | undefined = undefined;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: number | undefined }>();

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    value = parsed;
    dispatch('change', parsed);
  }

  $: displayValue = value ?? min ?? 0;
</script>

<div class="slider-wrapper">
  <input
    type="range"
    class="slider"
    {disabled}
    {min}
    {max}
    value={displayValue}
    on:input={handleInput}
  />
  <span class="slider-value">{displayValue}</span>
</div>

<style>
  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

  .slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--c-border);
    appearance: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--c-accent);
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--c-accent);
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .slider-value {
    min-width: 32px;
    text-align: right;
    font-size: 14px;
    font-weight: var(--fw-semibold);
    color: var(--c-text);
  }
</style>
