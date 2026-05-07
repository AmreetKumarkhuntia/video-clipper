<script lang="ts">
  import type { ToggleProps } from '@app/web/types/componentProps.js';

  let {
    id,
    checked = $bindable(false),
    disabled = false,
    ariaLabel,
    onchange,
  }: ToggleProps = $props();

  function handleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    checked = target.checked;
    onchange?.(target.checked);
  }
</script>

<!--
  The wrapping <span> is the visual toggle widget.
  The hidden <input> carries keyboard focus; its :focus-visible state
  is surfaced on __track via the CSS rule in components.css.
-->
<span class="vc-toggle" class:is-disabled={disabled}>
  <input
    {id}
    type="checkbox"
    {checked}
    {disabled}
    aria-label={ariaLabel ?? (checked ? 'Enabled' : 'Disabled')}
    onchange={handleChange}
  />
  <span class="vc-toggle__track"></span>
  <span class="vc-toggle__thumb"></span>
</span>

<style>
  .is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
