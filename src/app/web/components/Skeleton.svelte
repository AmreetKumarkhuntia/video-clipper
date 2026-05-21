<script lang="ts">
  import type { SkeletonProps } from '@app/web/types/componentProps.js';

  let {
    width,
    height,
    short = false,
    style: extraStyle,
    class: extraClass,
  }: SkeletonProps = $props();

  const classes = $derived(
    ['sk', 'sk--line', short ? 'sk--short' : '', extraClass].filter(Boolean).join(' '),
  );

  const style = $derived(
    [width && `width:${width}`, height && `height:${height}`, extraStyle].filter(Boolean).join(';'),
  );
</script>

<div class={classes} {style}></div>
