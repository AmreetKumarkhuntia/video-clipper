<script lang="ts">
  import Toggle from '@web/components/Toggle.svelte';

  interface Props {
    value?: boolean;
    disabled?: boolean;
    onchange?: (value: boolean) => void;
  }

  let { value = $bindable(false), disabled = false, onchange }: Props = $props();
</script>

<Toggle bind:checked={value} {disabled} {onchange} />
