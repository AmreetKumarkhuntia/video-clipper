<script lang="ts">
  import type { ButtonProps, ButtonSize } from '@app/web/types/componentProps.js';

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    disabled = false,
    href,
    class: extraClass = '',
    role,
    onclick,
    children,
    'aria-label': ariaLabel,
    title,
  }: ButtonProps = $props();

  const sizeClass: Record<ButtonSize, string> = {
    sm: 'vc-btn--sm',
    md: '',
    lg: 'vc-btn--lg',
    icon: 'vc-btn--icon',
  };

  const classes = $derived(
    ['vc-btn', `vc-btn--${variant}`, sizeClass[size], extraClass].filter(Boolean).join(' '),
  );
</script>

{#if href}
  <a
    {href}
    class={classes}
    class:disabled
    aria-disabled={disabled || undefined}
    aria-label={ariaLabel}
    {title}
  >
    {@render children()}
  </a>
{:else}
  <button class={classes} {type} {disabled} {role} {onclick} aria-label={ariaLabel} {title}>
    {@render children()}
  </button>
{/if}

<style>
  /* When rendered as <a>, mirror the disabled visual state */
  a.disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
  }
</style>
