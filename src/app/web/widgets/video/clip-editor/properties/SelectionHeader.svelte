<script lang="ts">
  import type { SelectionHeaderProps } from '@app/web/types/componentProps.js';
  import Badge from '@web/components/Badge.svelte';

  let { kindLabel, valueLabel, badgeText, badgeVariant = 'mono' }: SelectionHeaderProps = $props();
</script>

<div class="ce-right__sel">
  <span class="ce-right__sel__k">{kindLabel}</span>
  <span class="ce-right__sel__v">{valueLabel}</span>
  {#if badgeText}
    <span class="badge-slot">
      <Badge variant={badgeVariant}>{badgeText}</Badge>
    </span>
  {/if}
</div>

<style>
  .badge-slot {
    margin-left: auto;
  }
</style>
