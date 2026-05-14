<script lang="ts">
  import type {
    ClipEditorTemplatesProps,
    CaptionTemplate,
    SegmentedControlOption,
  } from '@app/web/types/componentProps.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';
  import PanelHeader from '@web/components/PanelHeader.svelte';
  import SegmentedControl from '@web/components/SegmentedControl.svelte';
  import CaptionPreset from './CaptionPreset.svelte';

  let { edits, onupdate }: ClipEditorTemplatesProps = $props();

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

<style>
  .templates-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }
</style>
