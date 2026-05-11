<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import type { ClipEditorProps } from '@app/web/types/componentProps.js';
  import type { ClipEdits } from '@lib/types/clipEdit.js';
  import type { TranscriptBundle } from '@app/web/types/analysis.js';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/stores/toast.js';
  import { formatTime } from '@web/lib/format.js';
  import { CAPTION_TEMPLATES } from '@web/lib/captionTemplates.js';
  import Icon from '@web/components/Icon.svelte';
  import Button from '@web/components/Button.svelte';
  import ClipEditorCanvas from './ClipEditorCanvas.svelte';
  import ClipEditorTemplates from './ClipEditorTemplates.svelte';
  import ClipEditorPropertiesPanel from './ClipEditorPropertiesPanel.svelte';

  let { clip, candidate, videoId, onclose }: ClipEditorProps = $props();

  let edits = $state<ClipEdits | null>(null);
  let transcript = $state<TranscriptBundle | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isRendering = $state(false);
  let errorMessage = $state('');
  let selectedItemId = $state<string | null>(null);
  let currentTime = $state(0);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let originalEditsJson = '';

  let isDirty = $derived(edits !== null && JSON.stringify(edits) !== originalEditsJson);

  $effect(() => {
    void load();
  });

  async function load(): Promise<void> {
    isLoading = true;
    errorMessage = '';
    try {
      const [editsRes, transcriptRes] = await Promise.all([
        apiFetch<{ edits: ClipEdits }>(`/api/clips/${clip.id}/edits`),
        apiFetch<TranscriptBundle>(`/api/youtube/videos/${videoId}/transcript`).catch(() => null),
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
      onclose();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose();
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
          {formatTime(clip.startSec)} → {formatTime(clip.endSec)} · {edits?.viewport.preset ?? '…'}
        </span>
      </div>
      <div class="editor-header__actions">
        <Button size="sm" disabled={!isDirty || isSaving || isRendering} onclick={save}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={isSaving || isRendering}
          onclick={renderAndSave}
        >
          {isRendering ? 'Rendering…' : 'Render & Save'}
        </Button>
        <button class="editor-close" type="button" aria-label="Close" onclick={onclose}>
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
          <ClipEditorCanvas {clip} {edits} bind:currentTime bind:videoEl />
          <div class="editor-track-toolbar">
            <Button size="sm" onclick={addSubtitle}>+ Subtitle</Button>
            <Button size="sm" onclick={addBanner}>+ Banner</Button>
            <Button size="sm" onclick={importTranscript} disabled={!transcript}>
              Auto-import Transcript
            </Button>
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
    grid-template-columns: 220px 1fr 280px;
    overflow: hidden;
  }

  .editor-left {
    border-right: 1px solid var(--vc-divider);
    overflow-y: auto;
  }

  .editor-center {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    padding: 16px;
  }

  .editor-right {
    border-left: 1px solid var(--vc-divider);
    overflow-y: auto;
  }

  .editor-track-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 12px;
    flex-shrink: 0;
  }
</style>
