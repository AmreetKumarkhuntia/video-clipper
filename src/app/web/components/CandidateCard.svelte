<script lang="ts">
  import type { ClipCandidate } from '@app/web/types/analysis.js';
  import { formatTime } from '@web/lib/format.js';

  interface Props {
    candidate: ClipCandidate;
    ontoggle?: () => void;
  }

  let { candidate, ontoggle }: Props = $props();
</script>

<article class:selected={candidate.selected}>
  <label>
    <input type="checkbox" checked={candidate.selected} onchange={() => ontoggle?.()} />
    <span>Rank {candidate.rank}</span>
  </label>
  <div>
    <h2>{formatTime(candidate.startSec)} - {formatTime(candidate.endSec)}</h2>
    <p>{candidate.reason}</p>
    {#if candidate.transcriptExcerpt}
      <blockquote>{candidate.transcriptExcerpt}</blockquote>
    {/if}
  </div>
  <span class="vc-score score-pill">{candidate.score}<span class="vc-score__den">/10</span></span>
</article>

<style>
  article {
    display: grid;
    grid-template-columns: 120px 1fr 64px;
    gap: 18px;
    align-items: start;
    padding: 16px 0;
    border-top: 1px solid var(--vc-divider);
    opacity: 0.7;
  }

  article.selected {
    opacity: 1;
  }

  label {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--vc-text-muted);
    font-weight: 700;
    cursor: pointer;
  }

  h2 {
    margin: 0 0 6px;
    font-size: var(--vc-text-18);
    color: var(--vc-text);
  }

  p {
    margin: 0;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
  }

  blockquote {
    margin: 10px 0 0;
    padding-left: 12px;
    border-left: 3px solid var(--vc-border);
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    line-height: 1.5;
  }

  .score-pill {
    justify-self: end;
  }

  @media (max-width: 760px) {
    article {
      grid-template-columns: 1fr;
    }
    .score-pill {
      justify-self: start;
    }
  }
</style>
