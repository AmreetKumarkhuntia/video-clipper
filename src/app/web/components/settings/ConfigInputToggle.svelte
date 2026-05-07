<script lang="ts">
  import Toggle from '@web/components/Toggle.svelte';
  import type { ConfigInputToggleProps } from '@app/web/types/componentProps.js';

  let { value = $bindable(false), disabled = false, onchange }: ConfigInputToggleProps = $props();
</script>

<Toggle bind:checked={value} {disabled} {onchange} />
