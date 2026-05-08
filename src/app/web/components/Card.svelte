<script lang="ts">
  import type { CardProps } from '@app/web/types/componentProps.js';

  let {
    as = 'article',
    interactive = false,
    class: extraClass = '',
    children,
  }: CardProps = $props();

  const classes = $derived(
    ['vc-card', interactive ? 'vc-card--interactive' : '', extraClass].filter(Boolean).join(' '),
  );
</script>

<svelte:element this={as} class={classes}>
  {@render children()}
</svelte:element>
