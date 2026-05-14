<script lang="ts">
  import type { TimelineSegmentProps } from '@app/web/types/componentProps.js';

  let {
    kind,
    leftPct,
    widthPct,
    label,
    selected = false,
    onclick,
    children,
  }: TimelineSegmentProps = $props();

  const classes = $derived(
    ['ce-tl-seg', kind === 'overlay' ? 'ce-tl-seg--ovly' : '', selected ? 'is-hl' : '']
      .filter(Boolean)
      .join(' '),
  );
</script>

{#if kind === 'trim'}
  <div class="ce-tl-trim" style="left: {leftPct}%; width: {widthPct}%; position: absolute; top: 0;">
    {#if children}{@render children()}{/if}
  </div>
{:else if onclick && !children}
  <button type="button" class={classes} style="left: {leftPct}%; width: {widthPct}%;" {onclick}>
    {label ?? ''}
  </button>
{:else}
  <div class={classes} style="left: {leftPct}%; width: {widthPct}%;">
    {#if children}
      {@render children()}
    {:else}
      {label ?? ''}
    {/if}
  </div>
{/if}

<style>
  button.ce-tl-seg {
    border: none;
    border-left: 2px solid var(--vc-clay-500);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }
</style>
