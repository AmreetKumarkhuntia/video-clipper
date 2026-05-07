<script lang="ts">
  import type { ClipPlan } from '@app/web/types/analysis.js';
  import Button from '@web/components/Button.svelte';

  interface Props {
    plan?: ClipPlan | null;
    videoId: string;
  }

  let { plan = null, videoId }: Props = $props();
</script>

<section class="vc-card plan-card">
  <div class="panel-head">
    <p class="panel-eyebrow">Clip plan</p>
    <h2 class="panel-title">Review the candidate moments generated from this run.</h2>
  </div>

  {#if plan}
    <div class="plan-summary">
      <p class="plan-count">
        {plan.candidates.length} candidate {plan.candidates.length === 1 ? 'moment' : 'moments'} ready.
      </p>
      <Button variant="primary" href={`/videos/${videoId}/analysis/${plan.id}`}>
        Review clip candidates
      </Button>
    </div>
  {:else}
    <p class="plan-muted">No clip plan generated yet.</p>
  {/if}
</section>

<style>
  .panel-head {
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

  .plan-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;
  }

  .plan-count {
    margin: 0;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
  }

  .plan-muted {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    margin: 0;
  }

  @media (max-width: 980px) {
    .plan-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
