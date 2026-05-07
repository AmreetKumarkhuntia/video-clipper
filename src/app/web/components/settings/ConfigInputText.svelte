<script lang="ts">
  import InputText from '@web/components/InputText.svelte';

  interface Props {
    id?: string;
    value?: string;
    secret?: boolean;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    id,
    value = $bindable(''),
    secret = false,
    placeholder = '',
    disabled = false,
    onchange,
  }: Props = $props();
</script>

<InputText {id} {secret} {placeholder} {disabled} bind:value {onchange} />
