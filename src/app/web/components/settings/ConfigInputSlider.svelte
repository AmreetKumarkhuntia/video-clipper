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

<div class="slider-wrap">
  <input
    type="range"
    class="vc-slider"
    {disabled}
    {min}
    {max}
    value={displayValue}
    oninput={handleInput}
  />
  <span class="slider-val">{displayValue}</span>
</div>

<style>
  .slider-wrap {
    display: flex;
    align-items: center;
    gap: var(--vc-space-3);
  }

  .vc-slider {
    flex: 1;
  }

  .slider-val {
    min-width: 32px;
    text-align: right;
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-13);
    font-weight: 600;
    color: var(--vc-text);
  }
</style>
