<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '@web/components/Button.svelte';

  type InputType = 'text' | 'password' | 'number' | 'email' | 'url' | 'search' | 'tel';
  type InputSize = 'sm' | 'md' | 'lg';

  type InputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'search' | 'tel' | 'url';

  interface Props {
    id?: string;
    type?: InputType;
    size?: InputSize;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    secret?: boolean;
    error?: boolean;
    maxlength?: number;
    autocomplete?: string;
    inputmode?: InputMode;
    /** Snippet rendered as the leading icon inside the input */
    icon?: Snippet;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    class?: string;
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
  }

  let {
    id,
    type: typeProp = 'text',
    size = 'md',
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    readonly = false,
    secret = false,
    error = false,
    maxlength,
    autocomplete,
    inputmode,
    icon,
    min,
    max,
    step,
    class: extraClass = '',
    oninput,
    onchange,
  }: Props = $props();

  let revealed = $state(false);
  const resolvedType = $derived(secret && !revealed ? 'password' : typeProp);

  const sizeClass: Record<InputSize, string> = {
    sm: 'vc-input--sm',
    md: '',
    lg: 'vc-input--lg',
  };

  const inputClass = $derived(
    [
      'vc-input',
      sizeClass[size],
      icon ? 'vc-input--with-icon' : '',
      secret ? 'vc-input--has-action' : '',
      error ? 'vc-input--error' : '',
      extraClass,
    ]
      .filter(Boolean)
      .join(' '),
  );

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.value;
    oninput?.(target.value);
  }

  function handleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onchange?.(target.value);
  }
</script>

<div class="wrap" class:has-icon={icon} class:has-action={secret}>
  {#if icon}
    <span class="icon-slot" aria-hidden="true">{@render icon()}</span>
  {/if}
  <input
    {id}
    type={resolvedType}
    {placeholder}
    {disabled}
    {readonly}
    {maxlength}
    {autocomplete}
    {inputmode}
    {min}
    {max}
    {step}
    class={inputClass}
    oninput={handleInput}
    onchange={handleChange}
    bind:value
  />
  {#if secret}
    <Button variant="ghost" size="sm" class="reveal-btn" onclick={() => (revealed = !revealed)}>
      {revealed ? 'Hide' : 'Show'}
    </Button>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .wrap input {
    flex: 1;
    min-width: 0;
  }

  .icon-slot {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    color: var(--vc-text-subtle);
    pointer-events: none;
    line-height: 0;
  }

  /* make room for the absolutely-positioned reveal button */
  .wrap.has-action :global(.vc-input) {
    padding-right: 68px;
  }

  .wrap :global(.reveal-btn) {
    position: absolute;
    right: 6px;
    flex-shrink: 0;
  }
</style>
