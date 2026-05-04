<script lang="ts">
  import type { ClipCandidate } from '@app/web/types/analysis.js';
  import { formatTime } from '@web/lib/format.js';

  export let candidate: ClipCandidate;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ toggle: void }>();
</script>

<article class:selected={candidate.selected}>
  <label>
    <input type="checkbox" checked={candidate.selected} on:change={() => dispatch('toggle')} />
    <span>Rank {candidate.rank}</span>
  </label>
  <div>
    <h2>{formatTime(candidate.startSec)} - {formatTime(candidate.endSec)}</h2>
    <p>{candidate.reason}</p>
    {#if candidate.transcriptExcerpt}
      <blockquote>{candidate.transcriptExcerpt}</blockquote>
    {/if}
  </div>
  <strong>{candidate.score}/10</strong>
</article>

<style>
  article {
    display: grid;
    grid-template-columns: 120px 1fr 64px;
    gap: 18px;
    align-items: start;
    padding: var(--s-md) 0;
    border-top: 1px solid var(--c-border);
    opacity: 0.7;
  }

  article.selected {
    opacity: 1;
  }

  label {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--c-text-muted);
    font-weight: var(--fw-bold);
  }

  h2 {
    margin: 0 0 6px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--c-text-muted);
  }

  blockquote {
    margin: var(--s-sm) 0 0;
    padding-left: 12px;
    border-left: 3px solid var(--c-border);
    color: var(--c-text-muted);
  }

  strong {
    justify-self: end;
  }

  @media (max-width: 760px) {
    article {
      grid-template-columns: 1fr;
    }

    strong {
      justify-self: start;
    }
  }
</style>
