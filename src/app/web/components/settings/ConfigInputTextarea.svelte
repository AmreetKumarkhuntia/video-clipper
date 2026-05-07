<script lang="ts">
  import Textarea from '@web/components/Textarea.svelte';

  interface Props {
    id?: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let { id, value = $bindable(''), placeholder = '', disabled = false, onchange }: Props = $props();
</script>

<!-- Settings textareas hold config/token values — use monospace -->
<Textarea {id} {placeholder} {disabled} monospace={true} bind:value {onchange} />
