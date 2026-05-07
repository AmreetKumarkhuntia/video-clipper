<script lang="ts">
  import InputText from '@web/components/InputText.svelte';

  interface Props {
    id?: string;
    value?: number;
    min?: number;
    max?: number;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: number | undefined) => void;
  }

  let {
    id,
    value = $bindable(undefined),
    min,
    max,
    placeholder = '',
    disabled = false,
    onchange,
  }: Props = $props();

  // InputText works with strings; convert on the way in and out
  const strValue = $derived(value !== undefined ? String(value) : '');

  function handleChange(raw: string): void {
    const parsed = raw === '' ? undefined : Number(raw);
    value = parsed;
    onchange?.(parsed);
  }
</script>

<InputText
  {id}
  type="number"
  {placeholder}
  {disabled}
  {min}
  {max}
  value={strValue}
  onchange={handleChange}
/>
