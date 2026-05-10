<script lang="ts">
  import { formatTime } from '@web/lib/format.js';
  import Card from '@web/components/Card.svelte';
  import Checkbox from '@web/components/Checkbox.svelte';
  import type { CandidateCardProps } from '@app/web/types/componentProps.js';

  let { candidate, ontoggle }: CandidateCardProps = $props();
</script>

<Card
  interactive
  class={['candidate-card', candidate.selected ? 'candidate-card--selected' : '']
    .filter(Boolean)
    .join(' ')}
>
  <Checkbox
    class="cand-chk"
    checked={candidate.selected}
    label="Rank {candidate.rank}"
    onchange={() => ontoggle?.()}
  />
  <div>
    <h2>{formatTime(candidate.startSec)} - {formatTime(candidate.endSec)}</h2>
    <p>{candidate.reason}</p>
    {#if candidate.transcriptExcerpt}
      <blockquote>{candidate.transcriptExcerpt}</blockquote>
    {/if}
  </div>
  <span class="vc-score score-pill">{candidate.score}<span class="vc-score__den">/10</span></span>
</Card>

<style>
  :global(.candidate-card) {
    display: grid;
    grid-template-columns: 120px 1fr 64px;
    gap: 18px;
    align-items: start;
    opacity: 0.7;
  }

  :global(.candidate-card--selected) {
    opacity: 1;
    border-color: var(--vc-clay-500);
    box-shadow: 0 0 0 1px var(--vc-clay-500);
  }

  :global(.cand-chk) {
    color: var(--vc-text-muted);
    font-weight: 700;
    gap: 9px;
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
    :global(.candidate-card) {
      grid-template-columns: 1fr;
    }
    .score-pill {
      justify-self: start;
    }
  }
</style>
