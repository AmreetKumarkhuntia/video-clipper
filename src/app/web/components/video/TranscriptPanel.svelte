<script lang="ts">
  import { formatTime } from '@web/lib/format.js';
  import type { TranscriptPanelProps } from '@app/web/types/componentProps.js';

  let { lines = [], chunkCount = 0, highlightRanges = [] }: TranscriptPanelProps = $props();

  function isHighlighted(start: number): boolean {
    return highlightRanges.some((r) => start >= r.start && start <= r.end);
  }
</script>

<article class="vc-card transcript-card">
  <div class="panel-head">
    <div>
      <p class="panel-eyebrow">Transcript</p>
      <h2 class="panel-title">Read the source material line by line.</h2>
    </div>
    {#if lines.length > 0}
      <p class="panel-meta">{lines.length} lines · {chunkCount} chunks</p>
    {/if}
  </div>

  {#if lines.length > 0}
    <div class="transcript-list" aria-label="Transcript lines">
      {#each lines as line, index (line.start + '-' + index)}
        <div class="transcript-row" class:transcript-row--highlight={isHighlighted(line.start)}>
          <span class="timestamp">{formatTime(line.start)}</span>
          <p>{line.text}</p>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-panel">
      <p class="transcript-muted">Fetch transcript to inspect time-stamped lines.</p>
    </div>
  {/if}
</article>

<style>
  .transcript-card {
    display: flex;
    flex-direction: column;
  }

  .panel-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 20px;
  }

  .panel-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .panel-title {
    margin: 0;
    font-family: var(--vc-font-display);
    font-size: clamp(20px, 2.8vw, 26px);
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--vc-text);
  }

  .panel-meta {
    margin: 0;
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
  }

  .transcript-list {
    display: grid;
    gap: 4px;
    max-height: 820px;
    overflow-y: auto;
    padding-right: 6px;
  }

  .transcript-row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    padding: 12px 10px;
    border-radius: 12px;
    transition: background-color 0.16s ease;
  }

  .transcript-row:hover {
    background: var(--vc-surface-raised);
  }

  .transcript-row--highlight {
    background: var(--vc-clay-soft);
  }

  .timestamp {
    color: var(--vc-text-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .transcript-row p {
    margin: 0;
    line-height: 1.6;
  }

  .empty-panel {
    min-height: 220px;
    display: grid;
    place-items: center;
    border: 1px dashed var(--vc-border);
    border-radius: var(--vc-radius-lg);
    background: var(--vc-surface-raised);
  }

  .transcript-muted {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    margin: 0;
  }

  @media (max-width: 700px) {
    .transcript-row {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .transcript-list {
      max-height: none;
    }
  }
</style>
