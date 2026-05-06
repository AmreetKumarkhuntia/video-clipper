<script lang="ts">
  interface Props {
    value?: string;
    options?: string[];
    optionLabels?: string[];
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    options = [],
    optionLabels = [],
    disabled = false,
    onchange,
  }: Props = $props();

  function handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<select class="vc-select" {disabled} onchange={handleChange} bind:value>
  {#each options as option, i (option)}
    <option value={option}>{optionLabels[i] ?? option}</option>
  {/each}
</select>
