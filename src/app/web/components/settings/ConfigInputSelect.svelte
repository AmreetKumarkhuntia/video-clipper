<script lang="ts">
  import Select from '@web/components/Select.svelte';
  import type { ConfigInputSelectProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(''),
    options = [],
    optionLabels = [],
    disabled = false,
    onchange,
  }: ConfigInputSelectProps = $props();

  // Map parallel string arrays to the canonical {value, label}[] format
  const mappedOptions = $derived(
    options.map((opt, i) => ({ value: opt, label: optionLabels[i] ?? opt })),
  );
</script>

<Select {id} {disabled} options={mappedOptions} bind:value {onchange} />
