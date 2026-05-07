<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg' | 'icon';
  type ButtonType = 'button' | 'submit' | 'reset';

  interface Props {
    variant?: Variant;
    size?: Size;
    type?: ButtonType;
    disabled?: boolean;
    href?: string;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    'aria-label'?: string;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    disabled = false,
    href,
    class: extraClass = '',
    onclick,
    children,
    'aria-label': ariaLabel,
  }: Props = $props();

  const sizeClass: Record<Size, string> = {
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
  >
    {@render children()}
  </a>
{:else}
  <button class={classes} {type} {disabled} {onclick} aria-label={ariaLabel}>
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
