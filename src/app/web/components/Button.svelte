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
  <a {href} class={classes} class:disabled aria-disabled={disabled || undefined}>
    {@render children()}
  </a>
{:else}
  <button class={classes} {type} {disabled} {onclick}>
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
