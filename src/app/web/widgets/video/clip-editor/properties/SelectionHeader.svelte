<script lang="ts">
  import type { SelectionHeaderProps } from '@app/web/types/componentProps.js';
  import Badge from '@web/components/Badge.svelte';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';

  let {
    kindLabel,
    valueLabel,
    badgeText,
    badgeVariant = 'mono',
    ondelete,
    deleteLabel = 'Delete',
  }: SelectionHeaderProps = $props();
</script>

<div class="ce-right__sel">
  <span class="ce-right__sel__k">{kindLabel}</span>
  <span class="ce-right__sel__v">{valueLabel}</span>
  {#if badgeText}
    <span class="badge-slot">
      <Badge variant={badgeVariant}>{badgeText}</Badge>
    </span>
  {/if}
  {#if ondelete}
    <span class="delete-slot" class:no-badge={!badgeText}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={deleteLabel}
        title={deleteLabel}
        onclick={() => ondelete?.()}
      >
        <Icon name="trash" size={16} />
      </Button>
    </span>
  {/if}
</div>

<style>
  .badge-slot {
    margin-left: auto;
  }
  .delete-slot.no-badge {
    margin-left: auto;
  }
</style>
