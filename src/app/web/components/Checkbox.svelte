<script lang="ts">
  import type { CheckboxProps } from '@app/web/types/componentProps.js';

  let {
    id,
    checked = $bindable(false),
    disabled = false,
    label,
    class: extraClass = '',
    onchange,
  }: CheckboxProps = $props();

  const wrapClass = $derived(
    ['checkbox-wrap', extraClass, disabled ? 'is-disabled' : ''].filter(Boolean).join(' '),
  );

  function handleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    checked = target.checked;
    onchange?.(target.checked);
  }
</script>

<label class={wrapClass}>
  <input {id} type="checkbox" {checked} {disabled} onchange={handleChange} />
  {#if label}
    <span class="checkbox-label">{label}</span>
  {/if}
</label>

<style>
  .checkbox-wrap {
    display: inline-flex;
    align-items: center;
    gap: var(--vc-space-2);
    cursor: pointer;
    font-size: var(--vc-text-14);
    color: var(--vc-text);
    user-select: none;
  }

  .checkbox-wrap.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkbox-wrap input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: var(--vc-accent);
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox-wrap.is-disabled input[type='checkbox'] {
    cursor: not-allowed;
  }

  .checkbox-label {
    line-height: 1.3;
  }
</style>
