<script lang="ts">
  interface SelectOption {
    value: string;
    label: string;
  }

  interface Props {
    id?: string;
    value?: string;
    options?: SelectOption[];
    disabled?: boolean;
    error?: boolean;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    id,
    value = $bindable(''),
    options = [],
    disabled = false,
    error = false,
    class: extraClass = '',
    onchange,
  }: Props = $props();

  const classes = $derived(
    ['vc-select', error ? 'vc-select--error' : '', extraClass].filter(Boolean).join(' '),
  );

  function handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    value = target.value;
    onchange?.(target.value);
  }
</script>

<select {id} class={classes} {disabled} onchange={handleChange} bind:value>
  {#each options as opt (opt.value)}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
