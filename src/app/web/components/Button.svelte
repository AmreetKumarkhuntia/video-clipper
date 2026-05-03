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
  }

  .btn--primary {
    background: var(--c-primary);
    color: var(--c-primary-text);
  }

  .btn--outline {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
    color: var(--c-text);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }
</style>
