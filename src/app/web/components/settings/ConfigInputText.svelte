<script lang="ts">
  interface Props {
    value?: string;
    secret?: boolean;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    secret = false,
    placeholder = '',
    disabled = false,
    onchange,
  }: Props = $props();

  let revealed = $state(false);
  let type = $derived(secret && !revealed ? 'password' : 'text');

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<div class="text-input">
  <input {type} {placeholder} {disabled} class="input" oninput={handleInput} bind:value />
  {#if secret}
    <button
      type="button"
      class="toggle-reveal"
      onclick={() => (revealed = !revealed)}
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
    gap: var(--vc-space-2);
  }

  .input {
    flex: 1;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.16s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--vc-clay-500);
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
    color: var(--vc-text-muted);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .toggle-reveal:hover {
    color: var(--vc-text);
  }
</style>
