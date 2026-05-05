<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let placeholder = '';
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: string }>();

  function handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    dispatch('change', value);
  }
</script>

<textarea class="textarea" {placeholder} {disabled} on:input={handleInput} bind:value></textarea>

<style>
  .textarea {
    width: 100%;
    min-height: 120px;
    padding: 10px 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
    color: var(--c-text);
    font-size: 13px;
    font-family: var(--font-mono, monospace);
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
    transition: border-color 0.16s ease;
  }

  .textarea:focus {
    outline: none;
    border-color: var(--c-accent);
  }

  .textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
