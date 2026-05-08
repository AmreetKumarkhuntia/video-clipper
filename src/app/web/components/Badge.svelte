<script lang="ts">
  import type { BadgeProps, BadgeVariant } from '@app/web/types/componentProps.js';

  let {
    variant = 'neutral',
    class: extraClass = '',
    title,
    'aria-label': ariaLabel,
    children,
  }: BadgeProps = $props();

  const variantClass: Record<BadgeVariant, string> = {
    neutral: '',
    clay: 'vc-badge--clay',
    success: 'vc-badge--success',
    warn: 'vc-badge--warn',
    error: 'vc-badge--error',
    info: 'vc-badge--info',
    mono: 'vc-badge--mono',
  };

  const classes = $derived(
    ['vc-badge', variantClass[variant], extraClass].filter(Boolean).join(' '),
  );
</script>

<span class={classes} {title} aria-label={ariaLabel}>
  {@render children()}
</span>
