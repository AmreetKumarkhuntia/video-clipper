<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let secret = false;
  export let placeholder = '';
  export let disabled = false;

  let revealed = false;

  const dispatch = createEventDispatcher<{ change: string }>();

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('change', value);
  }

  $: type = secret && !revealed ? 'password' : 'text';
</script>

<div class="text-input">
  <input {type} {placeholder} {disabled} class="input" on:input={handleInput} bind:value />
  {#if secret}
    <button
      type="button"
      class="toggle-reveal"
      on:click={() => (revealed = !revealed)}
      title={revealed ? 'Hide' : 'Reveal'}
    >
      {revealed ? 'Hide' : 'Show'}
    </button>
  {/if}
</div>

<style>
  .text-input {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--s-xs);
  }

  .input {
    flex: 1;
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

  .toggle-reveal {
    position: absolute;
    right: 8px;
    padding: 4px 8px;
    border: none;
    background: none;
    color: var(--c-text-muted);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .toggle-reveal:hover {
    color: var(--c-text);
  }
</style>
