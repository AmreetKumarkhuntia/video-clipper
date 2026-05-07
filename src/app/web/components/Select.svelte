<script lang="ts">
  import type { SelectProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(''),
    options = [],
    disabled = false,
    error = false,
    class: extraClass = '',
    onchange,
  }: SelectProps = $props();

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
