<script lang="ts">
  import type { UserPresetChipProps } from '@app/web/types/componentProps.js';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';

  let { preset, active, onApply, onEdit, onDelete }: UserPresetChipProps = $props();

  let menuOpen = $state(false);

  function toggleMenu(e: MouseEvent): void {
    e.stopPropagation();
    menuOpen = !menuOpen;
  }

  function handleEdit(e: MouseEvent): void {
    e.stopPropagation();
    menuOpen = false;
    onEdit(preset);
  }

  function handleDelete(e: MouseEvent): void {
    e.stopPropagation();
    menuOpen = false;
    onDelete(preset.id);
  }

  function handleDocumentClick(): void {
    if (menuOpen) menuOpen = false;
  }
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="up-chip-wrap">
  <button
    type="button"
    class="ce-preset up-chip"
    class:is-active={active}
    onclick={onApply}
    title={preset.name}
  >
    <span class="ce-preset__text up-chip__name">{preset.name}</span>
    {#if active}
      <span class="ce-preset__dot" aria-hidden="true"></span>
    {/if}
  </button>

  <span class="up-chip__menu-wrap">
    <Button
      variant="ghost"
      size="icon"
      class="vc-btn--sm"
      onclick={toggleMenu}
      aria-label="Preset options"
    >
      <Icon name="ellipsis" size={14} />
    </Button>
  </span>

  {#if menuOpen}
    <div class="vc-menu up-chip__menu" role="menu">
      <Button variant="ghost" class="vc-menu__item" role="menuitem" onclick={handleEdit}>
        <Icon name="pencil" size={13} />
        <span>Rename</span>
      </Button>
      <Button
        variant="ghost"
        class="vc-menu__item vc-menu__item--danger"
        role="menuitem"
        onclick={handleDelete}
      >
        <Icon name="trash" size={13} />
        <span>Delete</span>
      </Button>
    </div>
  {/if}
</div>

<style>
  .up-chip-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .up-chip {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    padding-left: 12px;
    padding-right: 32px;
  }

  .up-chip__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--vc-text-13);
    font-weight: 500;
  }

  .up-chip__menu-wrap {
    position: absolute;
    right: 3px;
    top: 50%;
    transform: translateY(-50%);
  }

  .up-chip__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 140px;
    z-index: 50;
  }
</style>
