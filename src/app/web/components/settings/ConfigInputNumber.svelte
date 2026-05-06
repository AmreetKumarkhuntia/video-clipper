<script lang="ts">
  interface Props {
    value?: number;
    min?: number;
    max?: number;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: number | undefined) => void;
  }

  let {
    value = $bindable(undefined),
    min,
    max,
    placeholder = '',
    disabled = false,
    onchange,
  }: Props = $props();

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    value = parsed;
    onchange?.(parsed);
  }
</script>

<input
  type="number"
  {placeholder}
  {disabled}
  {min}
  {max}
  class="input"
  oninput={handleInput}
  value={value ?? ''}
/>

<style>
  .input {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.16s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--vc-clay-500);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
