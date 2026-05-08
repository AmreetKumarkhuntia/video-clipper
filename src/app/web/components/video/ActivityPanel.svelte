<script lang="ts">
  import AnalysisProgress from '@web/components/AnalysisProgress.svelte';
  import type { ActivityPanelProps } from '@app/web/types/componentProps.js';

  let {
    analyzedChunks = 0,
    totalChunks = 0,
    phase = 'idle',
    items = [],
    isAnalyzing = false,
  }: ActivityPanelProps = $props();
</script>

<aside class="vc-card activity-card">
  <div class="panel-head">
    <div>
      <p class="panel-eyebrow">Activity</p>
      <h2 class="panel-title">Watch the analysis thread as each chunk resolves.</h2>
    </div>
    {#if isAnalyzing}
      <span class="live-pill">Live</span>
    {/if}
  </div>

  <AnalysisProgress {analyzedChunks} {totalChunks} {phase} {items} />
</aside>

<style>
  .activity-card {
    display: flex;
    flex-direction: column;
  }

  .panel-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: start;
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

  .activity-card :global(.ap-thread) {
    max-height: 720px;
    overflow-y: auto;
    padding-right: 6px;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--vc-clay-soft);
    color: var(--vc-clay-500);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  [data-theme='dark'] .live-pill {
    color: var(--vc-clay-400);
  }

  @media (max-width: 700px) {
    .panel-head {
      grid-template-columns: 1fr;
    }
    .activity-card :global(.ap-thread) {
      max-height: none;
    }
  }
</style>
