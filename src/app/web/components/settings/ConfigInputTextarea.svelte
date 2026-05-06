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

<textarea class="textarea" {placeholder} {disabled} oninput={handleInput} bind:value></textarea>

<style>
  .textarea {
    width: 100%;
    min-height: 120px;
    padding: 10px 12px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    font-size: 13px;
    font-family: var(--vc-font-mono, monospace);
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
    transition: border-color 0.16s ease;
  }

  .textarea:focus {
    outline: none;
    border-color: var(--vc-clay-500);
  }

  .textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
