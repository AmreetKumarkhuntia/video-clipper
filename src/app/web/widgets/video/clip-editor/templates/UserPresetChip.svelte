<script lang="ts">
  import type { UserPresetChipProps } from '@app/web/types/componentProps.js';
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

  <button type="button" class="up-chip__menu-btn" aria-label="Preset options" onclick={toggleMenu}>
    <Icon name="ellipsis" size={14} />
  </button>

  {#if menuOpen}
    <div class="up-chip__menu" role="menu">
      <button type="button" class="up-chip__menu-item" role="menuitem" onclick={handleEdit}>
        <Icon name="pencil" size={13} />
        <span>Rename</span>
      </button>
      <button
        type="button"
        class="up-chip__menu-item up-chip__menu-item--danger"
        role="menuitem"
        onclick={handleDelete}
      >
        <Icon name="trash" size={13} />
        <span>Delete</span>
      </button>
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
    font-size: 13px;
    font-weight: 500;
  }

  .up-chip__menu-btn {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--vc-radius-sm);
    border: none;
    background: transparent;
    color: var(--vc-text-subtle);
    cursor: pointer;
    padding: 0;
    transition: background var(--vc-dur-fast) var(--vc-ease);
  }

  .up-chip__menu-btn:hover {
    background: var(--vc-surface-2);
    color: var(--vc-text);
  }

  .up-chip__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 140px;
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    box-shadow: var(--vc-shadow-2);
    z-index: 50;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .up-chip__menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--vc-text);
    background: transparent;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background var(--vc-dur-fast) var(--vc-ease);
  }

  .up-chip__menu-item:hover {
    background: var(--vc-surface-2);
  }

  .up-chip__menu-item--danger {
    color: var(--vc-error);
  }

  .up-chip__menu-item--danger:hover {
    background: var(--vc-error-soft, color-mix(in srgb, var(--vc-error) 12%, transparent));
  }
</style>
