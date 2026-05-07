<script lang="ts">
  import Select from '@web/components/Select.svelte';

  interface Props {
    id?: string;
    value?: string;
    options?: string[];
    optionLabels?: string[];
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    id,
    value = $bindable(''),
    options = [],
    optionLabels = [],
    disabled = false,
    onchange,
  }: Props = $props();

  // Map parallel string arrays to the canonical {value, label}[] format
  const mappedOptions = $derived(
    options.map((opt, i) => ({ value: opt, label: optionLabels[i] ?? opt })),
  );
</script>

<Select {id} {disabled} options={mappedOptions} bind:value {onchange} />
