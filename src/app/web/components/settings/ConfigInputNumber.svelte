<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: number | undefined = undefined;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let placeholder = '';
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: number | undefined }>();

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const parsed = target.value === '' ? undefined : Number(target.value);
    value = parsed;
    dispatch('change', parsed);
  }
</script>

<input
  type="number"
  {placeholder}
  {disabled}
  {min}
  {max}
  class="input"
  on:input={handleInput}
  value={value ?? ''}
/>

<style>
  .input {
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
    color: var(--c-text);
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.16s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--c-accent);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
