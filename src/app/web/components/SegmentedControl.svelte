<script lang="ts" generics="T extends string">
  import type { SegmentedControlProps } from '@app/web/types/componentProps.js';

  let {
    options,
    value,
    orientation = 'row',
    disabled = false,
    ariaLabel,
    onchange,
  }: SegmentedControlProps<T> = $props();

  const classes = $derived(
    ['seg-control', orientation === 'col' ? 'seg-control--col' : ''].filter(Boolean).join(' '),
  );
</script>

<div class={classes} role="group" aria-label={ariaLabel}>
  {#each options as opt (opt.value)}
    <button
      type="button"
      class="seg-control__btn"
      class:is-active={opt.value === value}
      {disabled}
      aria-pressed={opt.value === value}
      onclick={() => {
        if (opt.value !== value) onchange(opt.value);
      }}
    >
      {opt.label}
    </button>
  {/each}
</div>
