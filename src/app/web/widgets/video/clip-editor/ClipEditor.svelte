<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { ClipEditorProps } from '@app/web/types/componentProps.js';
  import type { ClipEdits } from '@lib/types/clipEdit.js';
  import type { TranscriptBundle } from '@app/web/types/analysis.js';
  import type { PlannedSubtitleLine } from '@app/web/types/subtitlePlan.js';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/stores/toast.js';
  import { formatTime } from '@web/lib/format.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';
  import Icon from '@web/components/Icon.svelte';
  import Button from '@web/components/Button.svelte';
  import Badge from '@web/components/Badge.svelte';
  import ClipEditorCanvas from './canvas/ClipEditorCanvas.svelte';
  import ClipEditorTemplates from './templates/ClipEditorTemplates.svelte';
  import ClipEditorPropertiesPanel from './properties/ClipEditorPropertiesPanel.svelte';
  import ClipEditorTimeline from './timeline/ClipEditorTimeline.svelte';

  let { clip, candidate, videoId, onclose }: ClipEditorProps = $props();

  let edits = $state<ClipEdits | null>(null);
  let transcript = $state<TranscriptBundle | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isRendering = $state(false);
  let isPlanning = $state(false);
  let errorMessage = $state('');
  let selectedItemId = $state<string | null>(null);
  let currentTime = $state(0);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let originalEditsJson = '';

  let isDirty = $derived(edits !== null && JSON.stringify(edits) !== originalEditsJson);
  let showDirtyWarning = $state(false);

  function requestClose(): void {
    if (isDirty) {
      showDirtyWarning = true;
    } else {
      onclose();
    }
  }

  $effect(() => {
    void load();
  });

  async function load(): Promise<void> {
    isLoading = true;
    errorMessage = '';
    try {
      const [editsRes, transcriptRes] = await Promise.all([
        apiFetch<{ edits: ClipEdits }>(`/api/clips/${clip.id}/edits`),
        apiFetch<TranscriptBundle>(`/api/videos/${videoId}/transcript`).catch((err: unknown) => {
          showToast(
            'error',
            `Could not load transcript: ${err instanceof Error ? err.message : String(err)}`,
          );
          return null;
        }),
      ]);
      edits = editsRes.edits;
      originalEditsJson = JSON.stringify(edits);
      transcript = transcriptRes;
      if (edits.subtitles.length === 0 && transcript) importTranscript();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  function importTranscript(): void {
    if (!transcript || !edits) return;
    const windowStart = candidate?.startSec ?? clip.startSec;
    const windowEnd = candidate?.endSec ?? clip.endSec;
    const template = CAPTION_TEMPLATES[0];

    const lines = transcript.lines
      .filter((l) => l.start >= windowStart && l.start < windowEnd)
      .map((l) => {
        const lineStart = l.start - windowStart;
        const lineEnd = lineStart + l.duration;
        const words = l.text.trim().split(/\s+/).filter(Boolean);
        const N = words.length;
        return {
          id: crypto.randomUUID(),
          startSec: lineStart,
          endSec: Math.min(lineEnd, clip.durationSec),
          text: l.text,
          words: words.map((text, i) => ({
            text,
            startSec: lineStart + (i / N) * (lineEnd - lineStart),
            endSec: lineStart + ((i + 1) / N) * (lineEnd - lineStart),
            highlight: false,
          })),
          position: { ...template.position },
          style: { ...template.style },
        };
      });
    edits = { ...edits, subtitles: lines };
  }

  async function planSubtitles(): Promise<void> {
    if (!edits || edits.subtitles.length === 0) return;
    isPlanning = true;
    errorMessage = '';
    try {
      const res = await apiFetch<{ lines: PlannedSubtitleLine[] }>(
        `/api/clips/${clip.id}/subtitles/plan`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            durationSec: clip.durationSec,
            subtitles: edits.subtitles.map((s) => ({
              startSec: s.startSec,
              endSec: s.endSec,
              text: s.text,
              words: s.words.map((w) => ({ text: w.text, startSec: w.startSec, endSec: w.endSec })),
            })),
          }),
        },
      );
      const ref = edits.subtitles[0];
      edits = {
        ...edits,
        subtitles: res.lines.map((l) => ({
          id: crypto.randomUUID(),
          startSec: l.startSec,
          endSec: l.endSec,
          text: l.text,
          words: l.words.map((w) => ({ ...w, highlight: false })),
          position: { ...ref.position },
          style: { ...ref.style },
          ...(ref.templateId ? { templateId: ref.templateId } : {}),
        })),
      };
      showToast(
        'success',
        `Planned ${res.lines.length} subtitle line${res.lines.length === 1 ? '' : 's'}.`,
      );
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isPlanning = false;
    }
  }

  function addSubtitle(): void {
    if (!edits) return;
    const template = CAPTION_TEMPLATES[0];
    edits = {
      ...edits,
      subtitles: [
        ...edits.subtitles,
        {
          id: crypto.randomUUID(),
          startSec: 0,
          endSec: clip.durationSec,
          text: 'New subtitle',
          words: [],
          position: { ...template.position },
          style: { ...template.style },
        },
      ],
    };
  }

  function addBanner(): void {
    if (!edits) return;
    edits = {
      ...edits,
      overlays: [
        ...edits.overlays,
        {
          id: crypto.randomUUID(),
          kind: 'banner' as const,
          startSec: 0,
          endSec: clip.durationSec,
          text: 'Banner text',
          position: { xCenter: 0.5, yCenter: 0.1 },
          style: {
            fontFamily: 'Inter',
            fontSize: 48,
            weight: 700,
            color: '#FFFFFF',
            highlightColor: '#FFD60A',
            bgColor: null,
            bgPaddingX: 12,
            bgPaddingY: 6,
            bgRadius: 4,
            outlineColor: '#000000',
            outlineWidth: 2,
            align: 'center',
          },
        },
      ],
    };
  }

  async function save(): Promise<void> {
    if (!edits) return;
    isSaving = true;
    errorMessage = '';
    try {
      const res = await apiFetch<{ edits: ClipEdits }>(`/api/clips/${clip.id}/edits`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(edits),
      });
      edits = res.edits;
      originalEditsJson = JSON.stringify(res.edits);
      showToast('success', 'Edits saved.');
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isSaving = false;
    }
  }

  async function renderAndSave(): Promise<void> {
    await save();
    if (errorMessage) return;
    isRendering = true;
    try {
      await apiFetch(`/api/clips/${clip.id}/render`, { method: 'POST' });
      if (videoEl) {
        videoEl.src = `/api/clips/${clip.id}/file?v=${Date.now()}`;
        videoEl.load();
      }
      showToast('success', 'Render complete.');
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      isRendering = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) requestClose();
  }

  onMount(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelEl?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="editor-overlay"
  role="presentation"
  onclick={handleBackdropClick}
  transition:fade={{ duration: 160 }}
>
  <div
    bind:this={panelEl}
    class="editor-panel"
    role="dialog"
    aria-modal="true"
    aria-label="Clip Editor"
    tabindex="-1"
    transition:fly={{ y: 12, duration: 200 }}
  >
    <header class="editor-header">
      <div class="editor-header__info">
        <span class="editor-header__name">{clip.filename}</span>
        <span class="editor-header__meta">
          {formatTime(clip.startSec)} → {formatTime(clip.endSec)} · {formatTime(clip.durationSec)}
        </span>
      </div>
      {#if edits}
        <Badge variant="mono">{edits.viewport.preset}</Badge>
      {/if}
      <div class="editor-header__spacer"></div>
      <div class="editor-header__actions">
        <Button size="sm" disabled={!isDirty || isSaving || isRendering} onclick={save}>
          {isSaving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={isSaving || isRendering}
          onclick={renderAndSave}
        >
          <Icon name="scissors" size={14} />
          {isRendering ? 'Rendering…' : 'Render & Save'}
        </Button>
        <button class="editor-close" type="button" aria-label="Close" onclick={requestClose}>
          <Icon name="x" size={16} />
        </button>
      </div>
    </header>

    {#if errorMessage}
      <div class="editor-error">{errorMessage}</div>
    {/if}

    {#if isLoading}
      <div class="editor-loading">Loading…</div>
    {:else if edits}
      <div class="editor-body">
        <div class="editor-left">
          <ClipEditorTemplates
            {edits}
            onupdate={(e) => {
              edits = e;
            }}
          />
        </div>
        <div class="editor-center">
          <ClipEditorCanvas
            {clip}
            {edits}
            bind:currentTime
            bind:videoEl
            {selectedItemId}
            onSelectItem={(id) => {
              selectedItemId = id;
            }}
            onupdate={(e) => {
              edits = e;
            }}
          />
          <div class="ce-sub-actions">
            <Button size="sm" onclick={addSubtitle}>
              <Icon name="plus" size={13} />
              Subtitle
            </Button>
            <Button size="sm" onclick={addBanner}>
              <Icon name="plus" size={13} />
              Banner
            </Button>
            <Button size="sm" variant="ghost" onclick={importTranscript} disabled={!transcript}>
              <Icon name="file-text" size={13} />
              Auto-import transcript
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onclick={planSubtitles}
              disabled={isPlanning || edits.subtitles.length === 0}
            >
              <Icon name="sparkles" size={13} />
              {isPlanning ? 'Planning…' : 'Plan subtitles'}
            </Button>
            {#if transcript && edits.subtitles.length === 0}
              <span class="ce-sub-actions__hint">
                <Icon name="sparkles" size={12} />
                {transcript.lines.length} captions available from transcript
              </span>
            {/if}
          </div>
        </div>
        <div class="editor-right">
          <ClipEditorPropertiesPanel
            {edits}
            {selectedItemId}
            onupdate={(e) => {
              edits = e;
            }}
          />
        </div>
        <div class="editor-timeline">
          <ClipEditorTimeline
            {edits}
            durationSec={clip.durationSec}
            {currentTime}
            {selectedItemId}
            onSelectItem={(id) => {
              selectedItemId = id;
            }}
            onSeek={(sec) => {
              if (videoEl) videoEl.currentTime = sec;
              else currentTime = sec;
            }}
            onupdate={(e) => {
              edits = e;
            }}
          />
        </div>
      </div>
    {/if}

    {#if showDirtyWarning}
      <div class="editor-confirm-overlay" transition:fade={{ duration: 100 }}>
        <div class="editor-confirm-dialog">
          <p class="editor-confirm-title">Unsaved changes</p>
          <p class="editor-confirm-body">You have unsaved edits. Discard them and close?</p>
          <div class="editor-confirm-actions">
            <Button
              onclick={() => {
                showDirtyWarning = false;
              }}>Keep editing</Button
            >
            <Button variant="danger" onclick={onclose}>Discard &amp; close</Button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .editor-panel {
    position: relative;
    width: min(1280px, 100%);
    height: calc(100vh - 48px);
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    box-shadow: var(--vc-shadow-2, 0 24px 60px rgba(0, 0, 0, 0.4));
    display: flex;
    flex-direction: column;
    outline: none;
    overflow: hidden;
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--vc-divider);
    flex-shrink: 0;
  }

  .editor-header__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .editor-header__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--vc-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .editor-header__meta {
    font-size: 12px;
    font-family: var(--vc-font-mono);
    color: var(--vc-text-subtle);
  }

  .editor-header__spacer {
    flex: 1;
  }

  .editor-header__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .editor-close {
    width: 32px;
    height: 32px;
    border: 1px solid var(--vc-divider);
    border-radius: var(--vc-radius-sm, 6px);
    background: transparent;
    color: var(--vc-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background var(--vc-dur-fast) var(--vc-ease),
      color var(--vc-dur-fast) var(--vc-ease);
  }

  .editor-close:hover {
    background: var(--vc-surface-hover, var(--vc-surface));
    color: var(--vc-text);
  }

  .editor-error {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--vc-error);
    background: color-mix(in srgb, var(--vc-error) 8%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--vc-error) 20%, transparent);
    flex-shrink: 0;
  }

  .editor-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--vc-text-subtle);
  }

  .editor-body {
    flex: 1;
    display: grid;
    grid-template-columns: 232px 1fr 320px;
    grid-template-rows: 1fr auto;
    overflow: hidden;
  }

  .editor-timeline {
    grid-column: 1 / -1;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
  }

  .editor-left {
    background: var(--vc-surface);
    border-right: 1px solid var(--vc-border);
    overflow-y: auto;
  }

  .editor-center {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    background: var(--vc-bg);
    min-height: 0;
  }

  .editor-right {
    background: var(--vc-surface-2);
    border-left: 1px solid var(--vc-border);
    overflow-y: auto;
  }

  .editor-confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    border-radius: var(--vc-radius-lg);
  }

  .editor-confirm-dialog {
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius);
    padding: 24px;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--vc-shadow-2, 0 24px 60px rgba(0, 0, 0, 0.4));
  }

  .editor-confirm-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--vc-text);
  }

  .editor-confirm-body {
    margin: 0;
    font-size: 13px;
    color: var(--vc-text-subtle);
  }

  .editor-confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
