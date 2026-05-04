<script lang="ts">
  import type { ClipPlan } from '@app/web/types/analysis.js';
  import MutedText from '@web/components/MutedText.svelte';
  import Panel from '@web/components/Panel.svelte';

  export let plan: ClipPlan | null = null;
  export let videoId: string;
</script>

<Panel tag="section">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Clip plan</p>
      <h2>Review the candidate moments generated from this run.</h2>
    </div>
  </div>

  {#if plan}
    <div class="plan-summary">
      <p>
        {plan.candidates.length} candidate {plan.candidates.length === 1 ? 'moment' : 'moments'} ready.
      </p>
      <a class="btn-link" href={`/videos/${videoId}/analysis/${plan.id}`}>Review clip candidates</a>
    </div>
  {:else}
    <MutedText>No clip plan generated yet.</MutedText>
  {/if}
</Panel>

<style>
  .panel-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-md);
    align-items: start;
    margin-bottom: var(--s-lg);
  }

  h2 {
    margin: 0;
    font-size: clamp(22px, 2.8vw, 28px);
    line-height: 1.1;
  }

  .plan-summary {
    display: grid;
    grid-template-columns: minmax(0, var(--video-page-main)) minmax(220px, var(--video-page-rail));
    gap: var(--s-md);
    align-items: center;
  }

  .plan-summary p {
    margin: 0;
    color: var(--c-text-secondary);
  }

  .btn-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 14px;
    background: var(--c-primary);
    color: var(--c-primary-text);
    font-weight: var(--fw-bold);
    box-shadow: var(--shadow-soft);
  }

  @media (max-width: 980px) {
    .plan-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
