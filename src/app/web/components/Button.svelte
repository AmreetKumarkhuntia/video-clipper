<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'outline' = 'primary';
  export let disabled = false;
  export let type: 'button' | 'submit' = 'button';

  const dispatch = createEventDispatcher<{ click: void }>();

  function handleClick() {
    if (!disabled) dispatch('click');
  }
</script>

<button
  {type}
  {disabled}
  class="btn"
  class:btn--primary={variant === 'primary'}
  class:btn--outline={variant === 'outline'}
  on:click={handleClick}
>
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--r-md);
    font-weight: var(--fw-bold);
    transition:
      transform 0.16s ease,
      box-shadow 0.16s ease,
      background-color 0.16s ease,
      color 0.16s ease,
      border-color 0.16s ease;
  }

  .btn--primary {
    background: var(--c-primary);
    color: var(--c-primary-text);
    box-shadow: var(--shadow-soft);
  }

  .btn--outline {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-surface) 75%, white 25%);
    color: var(--c-text);
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .btn--primary:hover:not(:disabled) {
    box-shadow: var(--shadow-panel);
  }

  .btn--outline:hover:not(:disabled) {
    border-color: var(--c-border-strong);
    background: var(--c-surface);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.58;
    transform: none;
    box-shadow: none;
  }
</style>
