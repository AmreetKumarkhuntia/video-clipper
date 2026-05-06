<script lang="ts">
  interface Props {
    value?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    onchange?: (value: number | undefined) => void;
  }

  let { value = $bindable(undefined), min, max, disabled = false, onchange }: Props = $props();

  let displayValue = $derived(value ?? min ?? 0);

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    value = parsed;
    onchange?.(parsed);
  }
</script>

<div class="slider-wrapper">
  <input
    type="range"
    class="slider"
    {disabled}
    {min}
    {max}
    value={displayValue}
    oninput={handleInput}
  />
  <span class="slider-value">{displayValue}</span>
</div>

<style>
  .slider-wrapper {
    display: flex;
    align-items: center;
    gap: var(--vc-space-3);
  }

  .slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--vc-border);
    appearance: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--vc-clay-500);
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--vc-clay-500);
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
    font-weight: 600;
    color: var(--vc-text);
  }
</style>
