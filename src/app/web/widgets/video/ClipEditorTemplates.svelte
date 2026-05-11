<script lang="ts">
  import type { ClipEditorTemplatesProps, CaptionTemplate } from '@app/web/types/componentProps.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';

  let { edits, onupdate }: ClipEditorTemplatesProps = $props();

  function applyTemplate(t: CaptionTemplate): void {
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) => ({
        ...s,
        style: { ...t.style },
        position: { ...t.position },
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
  <section class="templates-section">
    <h5 class="templates-heading">Captions</h5>
    <ul class="templates-list">
      {#each CAPTION_TEMPLATES as t}
        <li>
          <button type="button" class="template-btn" onclick={() => applyTemplate(t)}>
            {t.name}
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section class="templates-section">
    <h5 class="templates-heading">Reframe</h5>
    <div class="radio-group">
      {#each ['9:16', '1:1', '16:9'] as preset}
        <label class="radio-label">
          <input
            type="radio"
            name="reframe-preset"
            value={preset}
            checked={edits.viewport.preset === preset}
            onchange={() => setPreset(preset as '9:16' | '1:1' | '16:9')}
          />
          {preset}
        </label>
      {/each}
    </div>
  </section>

  <section class="templates-section">
    <h5 class="templates-heading">Fill</h5>
    <div class="radio-group">
      {#each [{ value: 'crop', label: 'Crop' }, { value: 'pad-blur', label: 'Blur' }, { value: 'pad-black', label: 'Black' }] as mode}
        <label class="radio-label">
          <input
            type="radio"
            name="fill-mode"
            value={mode.value}
            checked={edits.viewport.fillMode === mode.value}
            onchange={() => setFillMode(mode.value as 'crop' | 'pad-blur' | 'pad-black')}
          />
          {mode.label}
        </label>
      {/each}
    </div>
  </section>
</div>

<style>
  .templates-panel {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .templates-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .templates-heading {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vc-text-subtle);
  }

  .templates-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .template-btn {
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    background: var(--vc-surface-raised, #1a1a1a);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius);
    color: var(--vc-text);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .template-btn:hover {
    background: var(--vc-surface-hover, #252525);
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
    color: var(--vc-text);
  }
</style>
