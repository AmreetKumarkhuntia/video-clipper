<script lang="ts">
  import InputText from '@web/components/InputText.svelte';
  import type { ConfigInputTextProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(''),
    secret = false,
    placeholder = '',
    disabled = false,
    onchange,
  }: ConfigInputTextProps = $props();
</script>

<InputText {id} {secret} {placeholder} {disabled} bind:value {onchange} />
