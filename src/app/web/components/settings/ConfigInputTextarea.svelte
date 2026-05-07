<script lang="ts">
  import Textarea from '@web/components/Textarea.svelte';
  import type { ConfigInputTextareaProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    onchange,
  }: ConfigInputTextareaProps = $props();
</script>

<!-- Settings textareas hold config/token values — use monospace -->
<Textarea {id} {placeholder} {disabled} monospace={true} bind:value {onchange} />
