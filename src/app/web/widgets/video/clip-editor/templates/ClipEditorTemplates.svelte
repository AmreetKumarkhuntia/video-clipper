<script lang="ts">
  import type {
    ClipEditorTemplatesProps,
    CaptionTemplate,
    SegmentedControlOption,
  } from '@app/web/types/componentProps.js';
  import type { UserCaptionPreset } from '@app/web/types/captionPreset.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';
  import {
    captionPresets,
    captionPresetsLoaded,
    loadCaptionPresets,
    saveCaptionPreset,
    updateCaptionPreset,
    deleteCaptionPreset,
  } from '@web/lib/stores/captionPresets.js';
  import PanelHeader from '@web/components/PanelHeader.svelte';
  import SegmentedControl from '@web/components/SegmentedControl.svelte';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';
  import CaptionPreset from './CaptionPreset.svelte';
  import UserPresetChip from './UserPresetChip.svelte';
  import SavePresetDialog from './SavePresetDialog.svelte';

  let { edits, onupdate }: ClipEditorTemplatesProps = $props();

  // Load presets once on mount
  $effect(() => {
    if (!$captionPresetsLoaded) {
      void loadCaptionPresets();
    }
  });

  const aspectOptions: SegmentedControlOption<'9:16' | '1:1' | '16:9'>[] = [
    { value: '9:16', label: '9:16' },
    { value: '1:1', label: '1:1' },
    { value: '16:9', label: '16:9' },
  ];

  const fillOptions: SegmentedControlOption<'crop' | 'pad-blur' | 'pad-black'>[] = [
    { value: 'crop', label: 'Crop' },
    { value: 'pad-blur', label: 'Blur' },
    { value: 'pad-black', label: 'Black' },
  ];

  let activeTemplateId = $derived.by(() => {
    if (edits.subtitles.length === 0) return null;
    const first = edits.subtitles[0].templateId ?? null;
    return edits.subtitles.every((s) => (s.templateId ?? null) === first) ? first : null;
  });

  // Dialog state
  let dialogOpen = $state(false);
  let dialogExistingId = $state<string | undefined>(undefined);
  let dialogExistingName = $state<string | undefined>(undefined);

  function openSaveDialog(): void {
    // If the current activeTemplateId is a user preset, pre-fill for overwrite
    const userPreset = $captionPresets.find((p) => p.id === activeTemplateId);
    dialogExistingId = userPreset?.id;
    dialogExistingName = userPreset?.name;
    dialogOpen = true;
  }

  function openEditDialog(preset: UserCaptionPreset): void {
    dialogExistingId = preset.id;
    dialogExistingName = preset.name;
    dialogOpen = true;
  }

  function closeDialog(): void {
    dialogOpen = false;
    dialogExistingId = undefined;
    dialogExistingName = undefined;
  }

  async function handleDialogSave(name: string, id?: string): Promise<void> {
    closeDialog();
    const refSub = edits.subtitles[0];
    if (!refSub) return;
    const style = { ...refSub.style };
    const position = { ...refSub.position };

    if (id) {
      // Overwrite / rename existing preset
      await updateCaptionPreset(id, { name, style, position });
    } else {
      // Create new preset
      await saveCaptionPreset(name, style, position);
    }
  }

  function applyTemplate(t: CaptionTemplate): void {
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) => ({
        ...s,
        style: { ...t.style },
        position: { ...t.position },
        templateId: t.id,
      })),
    });
  }

  function applyUserPreset(p: UserCaptionPreset): void {
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) => ({
        ...s,
        style: { ...p.style },
        position: { ...p.position },
        templateId: p.id,
      })),
    });
  }

  async function handleDeletePreset(id: string): Promise<void> {
    await deleteCaptionPreset(id);
  }

  function setPreset(preset: '9:16' | '1:1' | '16:9'): void {
    onupdate({ ...edits, viewport: { ...edits.viewport, preset } });
  }

  function setFillMode(fillMode: 'crop' | 'pad-blur' | 'pad-black'): void {
    onupdate({ ...edits, viewport: { ...edits.viewport, fillMode } });
  }
</script>

<div class="templates-panel">
  <section class="ce-rg">
    <PanelHeader text="Captions" />

    <div class="ce-presets-group">
      <span class="ce-presets-group__label">Built-in</span>
      <div class="ce-presets">
        {#each CAPTION_TEMPLATES as t (t.id)}
          <CaptionPreset
            id={t.id}
            label={t.name}
            active={activeTemplateId === t.id}
            onclick={() => applyTemplate(t)}
          />
        {/each}
      </div>
    </div>

    <div class="ce-presets-group">
      <span class="ce-presets-group__label">Saved</span>
      {#if $captionPresets.length > 0}
        <div class="ce-presets">
          {#each $captionPresets as p (p.id)}
            <UserPresetChip
              preset={p}
              active={activeTemplateId === p.id}
              onApply={() => applyUserPreset(p)}
              onEdit={openEditDialog}
              onDelete={handleDeletePreset}
            />
          {/each}
        </div>
      {:else}
        <p class="ce-presets-empty">No saved presets yet.</p>
      {/if}

      {#if edits.subtitles.length > 0}
        <Button size="sm" variant="secondary" onclick={openSaveDialog}>
          <Icon name="plus" size={13} />
          Save current style
        </Button>
      {/if}
    </div>
  </section>

  <section class="ce-rg">
    <PanelHeader text="Reframe" />
    <SegmentedControl
      options={aspectOptions}
      value={edits.viewport.preset}
      orientation="col"
      ariaLabel="Aspect ratio"
      onchange={setPreset}
    />
  </section>

  <section class="ce-rg">
    <PanelHeader text="Fill" />
    <SegmentedControl
      options={fillOptions}
      value={edits.viewport.fillMode}
      orientation="col"
      ariaLabel="Fill mode"
      onchange={setFillMode}
    />
  </section>
</div>

{#if dialogOpen}
  <SavePresetDialog
    style={edits.subtitles[0]?.style ?? CAPTION_TEMPLATES[0].style}
    position={edits.subtitles[0]?.position ?? CAPTION_TEMPLATES[0].position}
    existingPresetId={dialogExistingId}
    existingPresetName={dialogExistingName}
    onSave={handleDialogSave}
    onCancel={closeDialog}
  />
{/if}

<style>
  .templates-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }

  .ce-presets-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ce-presets-group__label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vc-text-subtle);
  }

  .ce-presets-empty {
    font-size: 12px;
    color: var(--vc-text-subtle);
    margin: 0;
  }
</style>
