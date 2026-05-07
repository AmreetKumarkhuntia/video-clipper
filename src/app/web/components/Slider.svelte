<script lang="ts">
  interface Props {
    id?: string;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    /** Show the numeric value label to the right (default true) */
    showValue?: boolean;
    onchange?: (value: number | undefined) => void;
  }

  let {
    id,
    value = $bindable(undefined),
    min,
    max,
    step,
    disabled = false,
    showValue = true,
    onchange,
  }: Props = $props();

  const displayValue = $derived(value ?? min ?? 0);

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    value = parsed;
    onchange?.(parsed);
  }
</script>

<div class="slider-wrap">
  <input
    {id}
    type="range"
    class="vc-slider"
    {disabled}
    {min}
    {max}
    {step}
    value={displayValue}
    oninput={handleInput}
  />
  {#if showValue}
    <span class="slider-val" aria-live="polite">{displayValue}</span>
  {/if}
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
    flex-shrink: 0;
  }
</style>
