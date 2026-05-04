<script lang="ts">
  import type { AnalysisActivityItem, ActivityPhase } from '@app/web/types/activity.js';
  import AnalysisProgress from '@web/components/AnalysisProgress.svelte';
  import Panel from '@web/components/Panel.svelte';

  export let analyzedChunks = 0;
  export let totalChunks = 0;
  export let phase: ActivityPhase = 'idle';
  export let items: AnalysisActivityItem[] = [];
  export let isAnalyzing = false;
</script>

<Panel tag="aside">
  <div class="panel-head">
    <div>
      <p class="eyebrow">Activity</p>
      <h2>Watch the analysis thread as each chunk resolves.</h2>
    </div>
    {#if isAnalyzing}
      <span class="live-pill">Live</span>
    {/if}
  </div>

  <AnalysisProgress {analyzedChunks} {totalChunks} {phase} {items} />
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

  :global(.panel) :global(.thread) {
    max-height: 720px;
    overflow-y: auto;
    padding-right: 6px;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--c-accent-soft);
    color: var(--c-accent);
    font-size: 12px;
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  @media (max-width: 700px) {
    .panel-head {
      grid-template-columns: 1fr;
    }

    :global(.panel) :global(.thread) {
      max-height: none;
    }
  }
</style>
