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
  class="vc-input"
  oninput={handleInput}
  value={value ?? ''}
/>
