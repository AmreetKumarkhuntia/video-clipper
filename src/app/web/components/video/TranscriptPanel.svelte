<script lang="ts">
  import type { TranscriptLine } from '@lib/types/index.js';
  import type { HighlightRange } from '@app/web/types/activity.js';
  import { formatTime } from '@web/lib/format.js';
  import MutedText from '@web/components/MutedText.svelte';
  import Panel from '@web/components/Panel.svelte';

  export let lines: TranscriptLine[] = [];
  export let chunkCount = 0;
  export let highlightRanges: HighlightRange[] = [];

  function isTranscriptLineHighlighted(start: number): boolean {
    return highlightRanges.some((range) => start >= range.start && start <= range.end);
  }
</script>

<Panel tag="article">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Transcript</p>
      <h2>Read the source material line by line.</h2>
    </div>

    {#if lines.length > 0}
      <p class="panel-meta">{lines.length} lines · {chunkCount} chunks</p>
    {/if}
  </div>

  {#if lines.length > 0}
    <div class="transcript-list" aria-label="Transcript lines">
      {#each lines as line, index (line.start + '-' + index)}
        <div
          class="transcript-row"
          class:transcript-row--highlight={isTranscriptLineHighlighted(line.start)}
        >
          <span class="timestamp">{formatTime(line.start)}</span>
          <p>{line.text}</p>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-panel">
      <MutedText>Fetch transcript to inspect time-stamped lines.</MutedText>
    </div>
  {/if}
</Panel>

<style>
  .panel-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s-md);
    align-items: start;
    margin-bottom: var(--s-lg);
  }

  h2 {
    margin: 0;
    font-size: clamp(22px, 2.8vw, 28px);
    line-height: 1.1;
  }

  .panel-meta {
    margin: 0;
    color: var(--c-text-muted);
    white-space: nowrap;
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
    gap: var(--s-md);
    align-items: start;
    padding: 12px 10px;
    border-radius: 12px;
    transition: background-color 0.16s ease;
  }

  .transcript-row:hover {
    background: color-mix(in srgb, var(--c-surface-muted) 80%, white 20%);
  }

  .transcript-row--highlight {
    background: var(--c-accent-soft);
  }

  .timestamp {
    color: var(--c-text-muted);
    font-size: 12px;
    font-weight: var(--fw-semibold);
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
    border: 1px dashed var(--c-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--c-surface-muted) 72%, white 28%);
  }

  @media (max-width: 980px) {
    .panel-meta {
      white-space: normal;
    }

    .panel-head {
      grid-template-columns: 1fr;
    }
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
