<script lang="ts">
  import type { ClipEditorPropertiesPanelProps } from '@app/web/types/componentProps.js';
  import type { ClipEdits, SubtitleLine } from '@lib/types/clipEdit.js';
  import InputText from '@web/components/InputText.svelte';
  import Field from '@web/components/Field.svelte';
  import Select from '@web/components/Select.svelte';
  import Slider from '@web/components/Slider.svelte';
  import Checkbox from '@web/components/Checkbox.svelte';

  let { edits, selectedItemId, onupdate }: ClipEditorPropertiesPanelProps = $props();

  let selectedItem = $derived(
    selectedItemId
      ? (edits.subtitles.find((s) => s.id === selectedItemId) ??
          edits.overlays.find((o) => o.id === selectedItemId) ??
          null)
      : null,
  );

  let itemKind = $derived(
    selectedItem
      ? edits.subtitles.some((s) => s.id === selectedItemId)
        ? ('subtitle' as const)
        : ('overlay' as const)
      : null,
  );

  function updateSubtitleField(field: string, value: unknown): void {
    if (!selectedItemId || itemKind !== 'subtitle') return;
    const updated: ClipEdits = {
      ...edits,
      subtitles: edits.subtitles.map((s) =>
        s.id === selectedItemId ? { ...s, [field]: value } : s,
      ),
    };
    onupdate(updated);
  }

  function updateOverlayField(field: string, value: unknown): void {
    if (!selectedItemId || itemKind !== 'overlay') return;
    const updated: ClipEdits = {
      ...edits,
      overlays: edits.overlays.map((o) => (o.id === selectedItemId ? { ...o, [field]: value } : o)),
    };
    onupdate(updated);
  }

  function updateStyle(field: string, value: unknown): void {
    if (!selectedItemId) return;
    if (itemKind === 'subtitle') {
      onupdate({
        ...edits,
        subtitles: edits.subtitles.map((s) =>
          s.id === selectedItemId ? { ...s, style: { ...s.style, [field]: value } } : s,
        ),
      });
    } else {
      onupdate({
        ...edits,
        overlays: edits.overlays.map((o) =>
          o.id === selectedItemId ? { ...o, style: { ...o.style, [field]: value } } : o,
        ),
      });
    }
  }

  function updatePosition(field: 'yCenter', value: number): void {
    if (!selectedItemId || itemKind !== 'subtitle') return;
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) =>
        s.id === selectedItemId ? { ...s, position: { ...s.position, [field]: value } } : s,
      ),
    });
  }

  function toggleWordHighlight(wordIdx: number): void {
    if (!selectedItemId || itemKind !== 'subtitle') return;
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) =>
        s.id === selectedItemId
          ? {
              ...s,
              words: s.words.map((w, i) => (i === wordIdx ? { ...w, highlight: !w.highlight } : w)),
            }
          : s,
      ),
    });
  }
</script>

{#snippet styleSection()}
  <div class="props-section">
    <p class="props-section-label">Style</p>

    <div class="props-row">
      <Field label="Font size" for="prop-fontsize">
        <Slider
          id="prop-fontsize"
          value={selectedItem!.style.fontSize}
          min={12}
          max={120}
          step={1}
          onchange={(v) => updateStyle('fontSize', v ?? 48)}
        />
      </Field>
      <Field label="Weight" for="prop-weight">
        <Slider
          id="prop-weight"
          value={selectedItem!.style.weight}
          min={100}
          max={900}
          step={100}
          onchange={(v) => updateStyle('weight', v ?? 400)}
        />
      </Field>
    </div>

    <Field label="Align" for="prop-align">
      <Select
        id="prop-align"
        value={selectedItem!.style.align}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onchange={(v) => updateStyle('align', v)}
      />
    </Field>

    <div class="props-row">
      <Field label="Color" for="prop-color">
        <input
          id="prop-color"
          type="color"
          class="color-swatch"
          value={selectedItem!.style.color}
          oninput={(e) => updateStyle('color', (e.currentTarget as HTMLInputElement).value)}
        />
      </Field>
      <Field label="Highlight" for="prop-highlight">
        <input
          id="prop-highlight"
          type="color"
          class="color-swatch"
          value={selectedItem!.style.highlightColor}
          oninput={(e) =>
            updateStyle('highlightColor', (e.currentTarget as HTMLInputElement).value)}
        />
      </Field>
    </div>

    <div class="props-row">
      <Field label="Outline color" for="prop-outline-color">
        <div class="nullable-color">
          <Checkbox
            checked={selectedItem!.style.outlineColor !== null}
            onchange={(on) => updateStyle('outlineColor', on ? '#000000' : null)}
          />
          {#if selectedItem!.style.outlineColor !== null}
            <input
              type="color"
              class="color-swatch"
              value={selectedItem!.style.outlineColor}
              oninput={(e) =>
                updateStyle('outlineColor', (e.currentTarget as HTMLInputElement).value)}
            />
          {/if}
        </div>
      </Field>
      <Field label="Outline width" for="prop-outline-w">
        <Slider
          id="prop-outline-w"
          value={selectedItem!.style.outlineWidth}
          min={0}
          max={10}
          step={0.5}
          onchange={(v) => updateStyle('outlineWidth', v ?? 0)}
        />
      </Field>
    </div>

    <Field label="Background" for="prop-bg">
      <div class="nullable-color">
        <Checkbox
          checked={selectedItem!.style.bgColor !== null}
          onchange={(on) => updateStyle('bgColor', on ? '#000000CC' : null)}
        />
        {#if selectedItem!.style.bgColor !== null}
          <input
            type="color"
            class="color-swatch"
            value={selectedItem!.style.bgColor.slice(0, 7)}
            oninput={(e) => updateStyle('bgColor', (e.currentTarget as HTMLInputElement).value)}
          />
        {/if}
      </div>
    </Field>
  </div>
{/snippet}

<div class="props-panel">
  {#if !selectedItem}
    <p class="props-empty">Select a subtitle or overlay to edit.</p>
  {:else if itemKind === 'subtitle'}
    <div class="props-form">
      <Field label="Text" for="prop-text">
        <InputText
          id="prop-text"
          value={selectedItem.text}
          onchange={(v) => updateSubtitleField('text', v)}
        />
      </Field>

      <div class="props-row">
        <Field label="Start (s)" for="prop-start">
          <InputText
            id="prop-start"
            type="number"
            value={String(selectedItem.startSec)}
            onchange={(v) => updateSubtitleField('startSec', parseFloat(v))}
          />
        </Field>
        <Field label="End (s)" for="prop-end">
          <InputText
            id="prop-end"
            type="number"
            value={String(selectedItem.endSec)}
            onchange={(v) => updateSubtitleField('endSec', parseFloat(v))}
          />
        </Field>
      </div>

      {#if (selectedItem as SubtitleLine).words.length > 0}
        <div class="props-words">
          <p class="props-words-label">Words — tap to highlight</p>
          <div class="props-word-chips">
            {#each (selectedItem as SubtitleLine).words as word, wi}
              <button
                type="button"
                class="word-chip"
                class:word-chip--active={word.highlight}
                onclick={() => toggleWordHighlight(wi)}
              >
                {word.text}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {@render styleSection()}

      <div class="props-section">
        <p class="props-section-label">Position</p>
        <Field label="Vertical (0 = top, 1 = bottom)" for="prop-ycenter">
          <Slider
            id="prop-ycenter"
            value={selectedItem.position.yCenter}
            min={0}
            max={1}
            step={0.01}
            onchange={(v) => updatePosition('yCenter', v ?? 0.85)}
          />
        </Field>
      </div>
    </div>
  {:else if itemKind === 'overlay'}
    <div class="props-form">
      <Field label="Text" for="prop-ov-text">
        <InputText
          id="prop-ov-text"
          value={selectedItem.text}
          onchange={(v) => updateOverlayField('text', v)}
        />
      </Field>

      <div class="props-row">
        <Field label="Start (s)" for="prop-ov-start">
          <InputText
            id="prop-ov-start"
            type="number"
            value={String(selectedItem.startSec)}
            onchange={(v) => updateOverlayField('startSec', parseFloat(v))}
          />
        </Field>
        <Field label="End (s)" for="prop-ov-end">
          <InputText
            id="prop-ov-end"
            type="number"
            value={String(selectedItem.endSec)}
            onchange={(v) => updateOverlayField('endSec', parseFloat(v))}
          />
        </Field>
      </div>

      {@render styleSection()}
    </div>
  {/if}
</div>

<style>
  .props-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .props-empty {
    font-size: 13px;
    color: var(--vc-text-subtle);
    margin: 0;
    padding-top: 24px;
    text-align: center;
  }

  .props-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .props-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .props-words {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .props-words-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vc-text-subtle);
  }

  .props-word-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .word-chip {
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--vc-border);
    background: var(--vc-surface-raised, #1a1a1a);
    color: var(--vc-text);
    font-size: 12px;
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s;
  }

  .word-chip--active {
    background: var(--vc-clay-500, #c8553d);
    border-color: var(--vc-clay-500, #c8553d);
    color: #fff;
  }

  .props-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--vc-divider);
  }

  .props-section-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vc-text-subtle);
  }

  .color-swatch {
    width: 100%;
    height: 32px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-sm, 4px);
    padding: 2px;
    background: none;
    cursor: pointer;
  }

  .nullable-color {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
