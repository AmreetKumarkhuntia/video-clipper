<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let { value = $bindable(''), placeholder = '', disabled = false, onchange }: Props = $props();

  function handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<textarea class="vc-textarea" {placeholder} {disabled} oninput={handleInput} bind:value></textarea>
