<script lang="ts">
  import type {
    ClipEditorPropertiesPanelProps,
    SegmentedControlOption,
  } from '@app/web/types/componentProps.js';
  import type { ClipEdits, SubtitleLine, TextOverlay } from '@lib/types/clipEdit.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';
  import { rescaleWords, wordsFromText } from '@web/lib/subtitleTiming.js';
  import Textarea from '@web/components/Textarea.svelte';
  import Toggle from '@web/components/Toggle.svelte';
  import PanelHeader from '@web/components/PanelHeader.svelte';
  import SegmentedControl from '@web/components/SegmentedControl.svelte';
  import SliderField from '@web/components/SliderField.svelte';
  import ColorSwatch from '@web/components/ColorSwatch.svelte';
  import TimecodeInput from '@web/components/TimecodeInput.svelte';
  import Button from '@web/components/Button.svelte';
  import SelectionHeader from './SelectionHeader.svelte';

  let { edits, selectedItemId, onupdate }: ClipEditorPropertiesPanelProps = $props();

  let selectedSubtitle = $derived(
    selectedItemId ? (edits.subtitles.find((s) => s.id === selectedItemId) ?? null) : null,
  );
  let selectedOverlay = $derived(
    selectedItemId ? (edits.overlays.find((o) => o.id === selectedItemId) ?? null) : null,
  );
  let itemKind = $derived(
    selectedSubtitle ? ('subtitle' as const) : selectedOverlay ? ('overlay' as const) : null,
  );

  let selectionIndex = $derived.by(() => {
    if (!selectedItemId) return 0;
    if (selectedSubtitle) {
      return edits.subtitles.findIndex((s) => s.id === selectedItemId) + 1;
    }
    return edits.overlays.findIndex((o) => o.id === selectedItemId) + 1;
  });

  let selectionLabel = $derived.by(() => {
    if (itemKind === 'subtitle') return `Subtitle · ${String(selectionIndex).padStart(2, '0')}`;
    if (itemKind === 'overlay') return `Banner · ${String(selectionIndex).padStart(2, '0')}`;
    return '';
  });

  let selectionBadge = $derived.by(() => {
    if (itemKind !== 'subtitle' || !selectedSubtitle?.templateId) return undefined;
    return CAPTION_TEMPLATES.find((t) => t.id === selectedSubtitle?.templateId)?.id;
  });

  const alignOptions: SegmentedControlOption<'left' | 'center' | 'right'>[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];

  function updateSubtitleField(field: keyof SubtitleLine, value: unknown): void {
    if (!selectedSubtitle) return;
    const id = selectedSubtitle.id;
    const updated: ClipEdits = {
      ...edits,
      subtitles: edits.subtitles.map((s) => {
        if (s.id !== id) return s;
        if (field === 'startSec' || field === 'endSec') {
          const newStart = field === 'startSec' ? (value as number) : s.startSec;
          const newEnd = field === 'endSec' ? (value as number) : s.endSec;
          return {
            ...s,
            startSec: newStart,
            endSec: newEnd,
            words: rescaleWords(s.words, s.startSec, s.endSec, newStart, newEnd),
          };
        }
        if (field === 'text') {
          const newText = value as string;
          return {
            ...s,
            text: newText,
            words: wordsFromText(newText, s.startSec, s.endSec, s.words),
          };
        }
        return { ...s, [field]: value };
      }),
    };
    onupdate(updated);
  }

  function updateOverlayField(field: keyof TextOverlay, value: unknown): void {
    if (!selectedOverlay) return;
    const id = selectedOverlay.id;
    onupdate({
      ...edits,
      overlays: edits.overlays.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    });
  }

  function deleteSelected(): void {
    if (selectedSubtitle) {
      const id = selectedSubtitle.id;
      onupdate({ ...edits, subtitles: edits.subtitles.filter((s) => s.id !== id) });
    } else if (selectedOverlay) {
      const id = selectedOverlay.id;
      onupdate({ ...edits, overlays: edits.overlays.filter((o) => o.id !== id) });
    }
  }

  function updateStyle(field: string, value: unknown): void {
    if (selectedSubtitle) {
      const id = selectedSubtitle.id;
      onupdate({
        ...edits,
        subtitles: edits.subtitles.map((s) =>
          s.id === id ? { ...s, style: { ...s.style, [field]: value } } : s,
        ),
      });
    } else if (selectedOverlay) {
      const id = selectedOverlay.id;
      onupdate({
        ...edits,
        overlays: edits.overlays.map((o) =>
          o.id === id ? { ...o, style: { ...o.style, [field]: value } } : o,
        ),
      });
    }
  }

  function updateSubtitleYCenter(value: number): void {
    if (!selectedSubtitle) return;
    const id = selectedSubtitle.id;
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) =>
        s.id === id ? { ...s, position: { ...s.position, yCenter: value } } : s,
      ),
    });
  }

  function toggleWordHighlight(wordIdx: number): void {
    if (!selectedSubtitle) return;
    const id = selectedSubtitle.id;
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) =>
        s.id === id
          ? {
              ...s,
              words: s.words.map((w, i) => (i === wordIdx ? { ...w, highlight: !w.highlight } : w)),
            }
          : s,
      ),
    });
  }

  function setOutline(on: boolean): void {
    updateStyle('outlineColor', on ? '#000000' : null);
  }

  function setBackground(on: boolean): void {
    updateStyle('bgColor', on ? '#000000CC' : null);
  }

  function applyStyleToAll(): void {
    if (!selectedSubtitle) return;
    const { style, position } = selectedSubtitle;
    onupdate({
      ...edits,
      subtitles: edits.subtitles.map((s) => ({
        ...s,
        style: { ...style },
        position: { ...position },
        templateId: undefined,
      })),
    });
  }

  function bgHexValue(value: string | null): string {
    if (!value) return '#000000';
    return value.slice(0, 7);
  }

  function updateBgColor(newHex: string): void {
    const current = selectedSubtitle?.style.bgColor ?? selectedOverlay?.style.bgColor ?? null;
    const alpha = current && current.length > 7 ? current.slice(7) : '';
    updateStyle('bgColor', newHex + alpha);
  }
</script>

<div class="props-panel">
  {#if !selectedSubtitle && !selectedOverlay}
    <p class="props-empty">Select a subtitle or overlay to edit.</p>
  {:else}
    {@const item = (selectedSubtitle ?? selectedOverlay)!}
    {@const style = item.style}

    <SelectionHeader
      kindLabel="Editing"
      valueLabel={selectionLabel}
      badgeText={selectionBadge}
      badgeVariant="clay"
      ondelete={deleteSelected}
      deleteLabel={itemKind === 'subtitle' ? 'Delete subtitle' : 'Delete banner'}
    />

    <section class="ce-rg">
      <PanelHeader text="Text" />
      <Textarea
        value={item.text}
        rows={3}
        onchange={(v) =>
          itemKind === 'subtitle' ? updateSubtitleField('text', v) : updateOverlayField('text', v)}
      />
      <div class="ce-time-row">
        <div class="ce-field">
          <label class="ce-field__label" for="prop-start">Start</label>
          <TimecodeInput
            id="prop-start"
            valueSec={item.startSec}
            onchange={(sec) =>
              itemKind === 'subtitle'
                ? updateSubtitleField('startSec', sec)
                : updateOverlayField('startSec', sec)}
          />
        </div>
        <div class="ce-field">
          <label class="ce-field__label" for="prop-end">End</label>
          <TimecodeInput
            id="prop-end"
            valueSec={item.endSec}
            onchange={(sec) =>
              itemKind === 'subtitle'
                ? updateSubtitleField('endSec', sec)
                : updateOverlayField('endSec', sec)}
          />
        </div>
      </div>
    </section>

    {#if itemKind === 'subtitle' && selectedSubtitle && selectedSubtitle.words.length > 0}
      <section class="ce-rg">
        <PanelHeader text="Words" hint="tap a word to highlight" />
        <div class="ce-words">
          {#each selectedSubtitle.words as word, wi}
            <button
              type="button"
              class="ce-word"
              class:is-hl={word.highlight}
              onclick={() => toggleWordHighlight(wi)}
            >
              {word.text}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <section class="ce-rg">
      <PanelHeader text="Style" />
      <div class="ce-grid-2">
        <SliderField
          label="Font size"
          value={style.fontSize}
          min={12}
          max={120}
          suffix="px"
          onchange={(v) => updateStyle('fontSize', v)}
        />
        <SliderField
          label="Weight"
          value={style.weight}
          min={100}
          max={900}
          step={100}
          onchange={(v) => updateStyle('weight', v)}
        />
      </div>
      <div class="ce-field" role="group" aria-label="Text alignment">
        <span class="ce-field__label">Align</span>
        <SegmentedControl
          options={alignOptions}
          value={style.align}
          ariaLabel="Text alignment"
          onchange={(v) => updateStyle('align', v)}
        />
      </div>
    </section>

    <section class="ce-rg">
      <PanelHeader text="Color" />
      <div class="ce-grid-2">
        <ColorSwatch
          kind="custom"
          label="Color"
          value={style.color}
          onchange={(v) => updateStyle('color', v)}
        />
        <ColorSwatch
          kind="custom"
          label="Highlight"
          value={style.highlightColor}
          onchange={(v) => updateStyle('highlightColor', v)}
        />
      </div>

      <label class="ce-toggle-row">
        <span>Outline</span>
        <Toggle checked={style.outlineColor !== null} ariaLabel="Outline" onchange={setOutline} />
      </label>

      {#if style.outlineColor !== null}
        <div class="ce-grid-2">
          <ColorSwatch
            kind="custom"
            label="Outline"
            value={style.outlineColor}
            onchange={(v) => updateStyle('outlineColor', v)}
          />
          <SliderField
            label="Width"
            value={style.outlineWidth}
            min={0}
            max={10}
            step={0.5}
            suffix="px"
            onchange={(v) => updateStyle('outlineWidth', v)}
          />
        </div>
      {/if}

      <label class="ce-toggle-row">
        <span>Background</span>
        <Toggle checked={style.bgColor !== null} ariaLabel="Background" onchange={setBackground} />
      </label>

      {#if style.bgColor !== null}
        <ColorSwatch
          kind="custom"
          label="Background"
          value={bgHexValue(style.bgColor)}
          onchange={(v) => updateBgColor(v)}
        />
        <div class="ce-grid-2">
          <SliderField
            label="Width"
            value={style.bgPaddingX}
            min={0}
            max={32}
            suffix="px"
            onchange={(v) => updateStyle('bgPaddingX', v)}
          />
          <SliderField
            label="Height"
            value={style.bgPaddingY}
            min={0}
            max={32}
            suffix="px"
            onchange={(v) => updateStyle('bgPaddingY', v)}
          />
        </div>
        <SliderField
          label="Radius"
          value={style.bgRadius}
          min={0}
          max={32}
          suffix="px"
          onchange={(v) => updateStyle('bgRadius', v)}
        />
      {/if}
    </section>

    {#if itemKind === 'subtitle' && selectedSubtitle}
      <section class="ce-rg">
        <PanelHeader text="Position" />
        <div class="ce-pos-head">
          <span>Vertical</span>
          <span class="ce-pos-head__v">{selectedSubtitle.position.yCenter.toFixed(2)}</span>
        </div>
        <input
          type="range"
          class="vc-slider"
          min="0"
          max="1"
          step="0.01"
          value={selectedSubtitle.position.yCenter}
          oninput={(e) =>
            updateSubtitleYCenter(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <div class="ce-pos-sub">
          <span>top</span>
          <span>bottom</span>
        </div>
      </section>
    {/if}

    {#if itemKind === 'subtitle' && edits.subtitles.length > 1}
      <div class="ce-rg">
        <Button size="sm" variant="secondary" onclick={applyStyleToAll}>
          Apply style to all subtitles
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .props-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    background: var(--vc-surface-2);
  }

  .props-empty {
    font-size: 13px;
    color: var(--vc-text-subtle);
    margin: 0;
    padding: 24px 16px;
    text-align: center;
  }
</style>
