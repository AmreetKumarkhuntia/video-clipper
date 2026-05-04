<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = false;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: boolean }>();

  function toggle(): void {
    if (!disabled) {
      value = !value;
      dispatch('change', value);
    }
  }
</script>

<button
  type="button"
  class="toggle"
  class:toggle--on={value}
  {disabled}
  on:click={toggle}
  aria-label={value ? 'Enabled' : 'Disabled'}
>
  <span class="toggle-knob"></span>
</button>

<style>
  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
    border: none;
    border-radius: 12px;
    background: var(--c-border);
    cursor: pointer;
    padding: 0;
    transition: background-color 0.2s ease;
  }

  .toggle--on {
    background: var(--c-accent);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  }

  .toggle--on .toggle-knob {
    transform: translateX(20px);
  }

  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
