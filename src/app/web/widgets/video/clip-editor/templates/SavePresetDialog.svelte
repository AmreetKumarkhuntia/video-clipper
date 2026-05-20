<script lang="ts">
  import type { SavePresetDialogProps } from '@app/web/types/componentProps.js';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';
  import InputText from '@web/components/InputText.svelte';

  let {
    style,
    position,
    existingPresetId,
    existingPresetName,
    onSave,
    onCancel,
  }: SavePresetDialogProps = $props();

  let name = $state(existingPresetName ?? '');
  let saveAsNew = $state(!existingPresetId);

  const canOverwrite = $derived(!!existingPresetId);
  const isUpdate = $derived(canOverwrite && !saveAsNew);
  const trimmedName = $derived(name.trim());
  const valid = $derived(trimmedName.length > 0);

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    if (!valid) return;
    onSave(trimmedName, isUpdate ? existingPresetId : undefined);
  }
</script>

<div
  class="sp-backdrop"
  role="button"
  tabindex={-1}
  aria-label="Close dialog"
  onclick={onCancel}
  onkeydown={(e) => {
    if (e.key === 'Escape') onCancel();
  }}
></div>

<div class="sp-dialog" role="dialog" aria-modal="true" aria-label="Save caption preset">
  <div class="sp-header">
    <span class="sp-title">{canOverwrite ? 'Update preset' : 'Save caption preset'}</span>
    <Button variant="ghost" size="icon" onclick={onCancel} aria-label="Close">
      <Icon name="x" size={16} />
    </Button>
  </div>

  <form class="sp-body" onsubmit={handleSubmit}>
    <label class="sp-field">
      <span class="sp-label">Preset name</span>
      <InputText
        bind:value={name}
        placeholder="e.g. My Bold Style"
        maxlength={80}
        autocomplete="off"
      />
    </label>

    {#if canOverwrite}
      <div class="sp-mode">
        <label class="sp-mode-opt">
          <input
            type="radio"
            name="save-mode"
            checked={!saveAsNew}
            onchange={() => (saveAsNew = false)}
          />
          <span>Update "{existingPresetName}"</span>
        </label>
        <label class="sp-mode-opt">
          <input
            type="radio"
            name="save-mode"
            checked={saveAsNew}
            onchange={() => {
              saveAsNew = true;
              name = '';
            }}
          />
          <span>Save as new preset</span>
        </label>
      </div>
    {/if}

    <div class="sp-actions">
      <Button variant="secondary" size="sm" onclick={onCancel} type="button">Cancel</Button>
      <Button variant="primary" size="sm" type="submit" disabled={!valid}>
        {isUpdate ? 'Update' : 'Save'}
      </Button>
    </div>
  </form>
</div>

<style>
  .sp-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 300;
    cursor: default;
  }

  .sp-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 301;
    width: min(90vw, 360px);
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    box-shadow: var(--vc-shadow-3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 12px 16px;
    border-bottom: 1px solid var(--vc-border);
  }

  .sp-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--vc-text);
  }

  .sp-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .sp-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sp-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .sp-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sp-mode-opt {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--vc-text);
    cursor: pointer;
  }

  .sp-mode-opt input[type='radio'] {
    accent-color: var(--vc-clay-500);
    cursor: pointer;
  }

  .sp-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
