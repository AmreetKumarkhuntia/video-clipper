<script lang="ts">
  import type { ColorSwatchProps } from '@app/web/types/componentProps.js';

  let { kind, label, value, disabled = false, onchange, onclick }: ColorSwatchProps = $props();

  let inputEl = $state<HTMLInputElement | null>(null);

  function handleClick(): void {
    if (disabled) return;
    if (onchange && inputEl) inputEl.click();
    else onclick?.();
  }

  function handleColorInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    onchange?.(target.value);
  }

  const chipStyle = $derived(kind === 'custom' && value ? `background: ${value};` : '');
</script>

<button
  type="button"
  class="ce-swatch ce-swatch--{kind}"
  {disabled}
  aria-label={label}
  onclick={handleClick}
>
  <span class="ce-swatch__chip" style={chipStyle}></span>
  <span class="ce-swatch__label">{label}</span>
</button>

{#if onchange}
  <input
    bind:this={inputEl}
    type="color"
    class="vh-color-input"
    value={value ?? '#000000'}
    oninput={handleColorInput}
    tabindex="-1"
    aria-hidden="true"
  />
{/if}

<style>
  .vh-color-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
</style>
