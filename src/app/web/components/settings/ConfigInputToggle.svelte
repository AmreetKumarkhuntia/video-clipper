<script lang="ts">
  interface Props {
    value?: boolean;
    disabled?: boolean;
    onchange?: (value: boolean) => void;
  }

  let { value = $bindable(false), disabled = false, onchange }: Props = $props();

  function toggle(): void {
    if (!disabled) {
      value = !value;
      onchange?.(value);
    }
  }
</script>

<button
  type="button"
  class="toggle"
  class:toggle--on={value}
  {disabled}
  onclick={toggle}
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
    background: var(--vc-border);
    cursor: pointer;
    padding: 0;
    transition: background-color 0.2s ease;
  }

  .toggle--on {
    background: var(--vc-clay-500);
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
