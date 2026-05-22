<script lang="ts">
  import type { ConfirmDialogProps } from '@app/web/types/componentProps.js';
  import Button from '@web/components/Button.svelte';

  let {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onconfirm,
    oncancel,
  }: ConfirmDialogProps = $props();

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="cd-backdrop" role="presentation" onclick={oncancel}></div>

<div class="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">
  <div class="cd-header">
    <span id="cd-title" class="cd-title">{title}</span>
  </div>
  <div class="cd-body">
    <p class="cd-message">{message}</p>
  </div>
  <div class="cd-actions">
    <Button variant="secondary" size="sm" onclick={oncancel}>{cancelLabel}</Button>
    <Button variant="danger" size="sm" onclick={onconfirm}>{confirmLabel}</Button>
  </div>
</div>

<style>
  .cd-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 400;
    cursor: default;
  }

  .cd-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 401;
    width: min(90vw, 380px);
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    box-shadow: var(--vc-shadow-3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cd-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--vc-border);
  }

  .cd-title {
    font-size: var(--vc-text-13);
    font-weight: 600;
    color: var(--vc-text);
  }

  .cd-body {
    padding: 16px;
  }

  .cd-message {
    font-size: var(--vc-text-13);
    color: var(--vc-text-subtle);
    margin: 0;
    line-height: 1.5;
  }

  .cd-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--vc-border);
  }
</style>
