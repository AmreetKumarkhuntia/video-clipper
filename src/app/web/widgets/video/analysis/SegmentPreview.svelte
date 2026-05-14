<script lang="ts">
  import type { ClipCandidate } from '@app/web/types/analysis.js';
  import type { TranscriptLine } from '@lib/types/index.js';
  import { formatTime } from '@web/lib/format.js';
  import Icon from '@web/components/Icon.svelte';

  interface Props {
    candidate: ClipCandidate;
    transcriptLines: TranscriptLine[];
    onClose: () => void;
  }

  let { candidate, transcriptLines, onClose }: Props = $props();

  let durationSec = $derived(candidate.endSec - candidate.startSec);

  let excerptLines = $derived.by(() => {
    const pad = 8;
    const start = candidate.startSec - pad;
    const end = candidate.endSec + pad;
    return transcriptLines
      .filter((l) => l.start >= start && l.start <= end)
      .map((l) => ({
        ...l,
        inRange: l.start >= candidate.startSec && l.start <= candidate.endSec,
      }));
  });
</script>

<div class="preview">
  <div class="preview__head">
    <div class="preview__head-left">
      <span class="preview__rank">#{candidate.rank}</span>
      {#if candidate.score != null}
        <span class="vc-score">{candidate.score}<span class="vc-score__den">/10</span></span>
      {/if}
      <span class="preview__time"
        >{formatTime(candidate.startSec)} → {formatTime(candidate.endSec)}</span
      >
      <span class="preview__dur">{Math.round(durationSec)}s</span>
    </div>
    <button class="preview__close" onclick={onClose} type="button" aria-label="Close preview">
      <Icon name="x" size={14} />
    </button>
  </div>

  {#if candidate.reason}
    <div class="preview__reason">
      <span class="preview__reason-label">Why it scored {candidate.score}</span>
      <p>{candidate.reason}</p>
    </div>
  {/if}

  {#if candidate.source}
    <div class="preview__source">
      <span class="preview__source-label">Source</span>
      <span class="preview__source-val"
        >{candidate.source}{#if candidate.audioEvent}
          · {candidate.audioEvent}{/if}</span
      >
    </div>
  {/if}

  {#if excerptLines.length > 0}
    <div class="preview__transcript">
      <div class="preview__transcript-head">Transcript excerpt</div>
      {#each excerptLines as line (line.start)}
        <div
          class="preview__line"
          class:preview__line--in={line.inRange}
          class:preview__line--out={!line.inRange}
        >
          <span class="preview__line-t">{formatTime(line.start)}</span>
          <span>{line.text}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .preview {
    background: var(--vc-surface);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    padding: 20px;
  }

  .preview__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .preview__head-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .preview__rank {
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-13);
    color: var(--vc-text-subtle);
  }

  .preview__time {
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-13);
    color: var(--vc-text);
  }

  .preview__dur {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
  }

  .preview__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    background: var(--vc-surface-2);
    border-radius: var(--vc-radius-sm);
    color: var(--vc-text-muted);
    cursor: pointer;
    transition: all var(--vc-dur-fast) var(--vc-ease);
  }

  .preview__close:hover {
    background: var(--vc-surface-raised);
    color: var(--vc-text);
  }

  .preview__reason {
    background: var(--vc-bg);
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-sm);
    padding: 10px 14px;
    margin-bottom: 12px;
  }

  .preview__reason-label {
    display: block;
    font-family: var(--vc-font-mono);
    font-size: 10px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .preview__reason p {
    margin: 0;
    font-size: var(--vc-text-14);
    color: var(--vc-text);
    line-height: var(--vc-leading-body);
  }

  .preview__source {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: var(--vc-text-13);
  }

  .preview__source-label {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .preview__source-val {
    color: var(--vc-text-muted);
    font-size: var(--vc-text-13);
  }

  .preview__transcript {
    border-top: 1px solid var(--vc-divider);
    padding-top: 14px;
  }

  .preview__transcript-head {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }

  .preview__line {
    display: grid;
    grid-template-columns: 50px 1fr;
    gap: 12px;
    padding: 5px 8px;
    border-radius: var(--vc-radius-sm);
    font-size: var(--vc-text-13);
    line-height: var(--vc-leading-body);
  }

  .preview__line--in {
    color: var(--vc-text);
    background: var(--vc-clay-soft);
  }

  .preview__line--out {
    color: var(--vc-text-subtle);
  }

  .preview__line-t {
    font-family: var(--vc-font-mono);
    font-size: var(--vc-text-12);
    color: var(--vc-text-subtle);
    padding-top: 2px;
  }
</style>
