<script lang="ts">
  import Badge from '@web/components/Badge.svelte';
  import type { AnalysisProgressProps } from '@app/web/types/componentProps.js';
  import type { BadgeVariant } from '@app/web/types/componentProps.js';

  let {
    analyzedChunks = 0,
    totalChunks = 0,
    phase = 'idle',
    items = [],
  }: AnalysisProgressProps = $props();

  function statusVariant(status: string): BadgeVariant {
    if (status === 'done') return 'success';
    if (status === 'error') return 'error';
    return 'neutral';
  }

  let pct = $derived(totalChunks > 0 ? Math.round((analyzedChunks / totalChunks) * 100) : 0);

  let phaseLabel = $derived(
    phase === 'idle'
      ? 'Analysis not started'
      : phase === 'analyzing'
        ? 'Analyzing transcript'
        : phase === 'refining'
          ? 'Refining clip windows'
          : 'Analysis complete',
  );

  let statusTone = $derived(phase === 'complete' ? 'done' : phase === 'idle' ? 'idle' : 'running');
</script>

<div class="ap-progress">
  <div class="ap-hero">
    <div class="ap-hero-copy">
      <div class="ap-status-row">
        <span
          class="ap-status-dot"
          class:ap-status-dot--done={statusTone === 'done'}
          class:ap-status-dot--idle={statusTone === 'idle'}
        ></span>
        <span class="ap-label">{phaseLabel}</span>
      </div>
      <p class="ap-subhead">
        {#if phase === 'idle'}
          Run clip planning to start a live thread of chunk analysis and refinement events.
        {:else if phase === 'analyzing'}
          Building clip candidates chunk by chunk from the transcript stream.
        {:else if phase === 'refining'}
          Tightening start and end boundaries for the strongest candidate moments.
        {:else}
          Candidate analysis finished. Review the final plan and transcript together.
        {/if}
      </p>
    </div>

    {#if totalChunks > 0}
      <div class="ap-counter-block">
        <span class="ap-counter">{analyzedChunks}/{totalChunks}</span>
        <span class="ap-counter-label">chunks resolved</span>
      </div>
    {/if}
  </div>

  {#if totalChunks > 0}
    <div class="ap-bar-track" aria-hidden="true">
      <div class="ap-bar-fill" style={`width: ${pct}%`}></div>
    </div>
  {/if}

  <div class="ap-thread" aria-label="Analysis activity thread">
    {#if items.length === 0}
      <p class="ap-empty">
        {phase === 'idle'
          ? 'No analysis events yet.'
          : 'Analysis events will appear here once the stream starts.'}
      </p>
    {:else}
      {#each items as item, i (item.id)}
        <article
          class="ap-entry"
          data-status={item.status}
          class:ap-entry--first={i === 0}
          class:ap-entry--last={i === items.length - 1}
        >
          <div class="ap-segment">
            <span
              class="ap-bullet"
              class:ap-bullet--done={item.status === 'done'}
              class:ap-bullet--error={item.status === 'error'}
            ></span>
          </div>

          <div class="ap-content">
            <div class="ap-entry-head">
              <h3>{item.title}</h3>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>

            {#if item.detail}
              <p class="ap-detail">{item.detail}</p>
            {/if}

            {#if item.rawText}
              <details>
                <summary>Show live model text</summary>
                <pre class="ap-reasoning">{item.rawText}</pre>
              </details>
            {/if}
          </div>
        </article>
      {/each}
    {/if}
  </div>
</div>

<style>
  .ap-progress {
    display: grid;
    gap: var(--vc-space-5);
  }

  .ap-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--vc-space-4);
    align-items: start;
  }

  .ap-hero-copy {
    display: grid;
    gap: var(--vc-space-2);
  }

  .ap-status-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .ap-label {
    font-weight: 600;
    font-size: 18px;
  }

  .ap-subhead {
    max-width: 46ch;
    margin: 0;
    color: var(--vc-text-muted);
    line-height: 1.5;
  }

  .ap-status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vc-clay-500);
    box-shadow: 0 0 0 8px var(--vc-clay-soft);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .ap-status-dot--done {
    background: var(--vc-success);
    box-shadow: 0 0 0 8px var(--vc-success-soft);
    animation: none;
  }

  .ap-status-dot--idle {
    background: var(--vc-border-strong);
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--vc-surface-2) 80%, white 20%);
    animation: none;
  }

  .ap-counter-block {
    display: grid;
    justify-items: end;
    gap: 2px;
    text-align: right;
  }

  .ap-counter {
    font-size: 26px;
    font-weight: 700;
  }

  .ap-counter-label {
    font-size: 12px;
    color: var(--vc-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ap-bar-track {
    height: 8px;
    border-radius: 999px;
    background: var(--vc-surface-2);
    overflow: hidden;
  }

  .ap-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--vc-clay-500),
      color-mix(in srgb, var(--vc-clay-500) 65%, white 35%)
    );
    transition: width 0.2s ease;
  }

  .ap-thread {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    column-gap: 12px;
    row-gap: 0;
  }

  .ap-empty {
    margin: 0;
    color: var(--vc-text-muted);
    grid-column: 1 / -1;
  }

  .ap-entry {
    display: contents;
  }

  .ap-segment {
    position: relative;
    width: 1px;
    justify-self: center;
    background: var(--vc-border);
  }

  .ap-bullet {
    position: absolute;
    top: calc((15px * 1.35) / 2);
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vc-clay-500);
    box-shadow: 0 0 0 4px var(--vc-clay-soft);
  }

  .ap-bullet--done {
    background: var(--vc-success);
    box-shadow: 0 0 0 4px var(--vc-success-soft);
  }

  .ap-bullet--error {
    background: var(--vc-error);
    box-shadow: 0 0 0 4px rgba(173, 49, 49, 0.12);
  }

  .ap-content {
    display: grid;
    gap: var(--vc-space-2);
    padding-bottom: var(--vc-space-4);
  }

  .ap-entry--last .ap-content {
    padding-bottom: 0;
  }

  .ap-entry-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--vc-space-3);
    align-items: center;
  }

  .ap-entry-head h3 {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }

  .ap-detail {
    margin: 0;
    color: var(--vc-text-muted);
    line-height: 1.45;
  }

  details {
    margin-top: 2px;
  }

  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--vc-text-muted);
    user-select: none;
  }

  .ap-reasoning {
    margin: var(--vc-space-2) 0 0;
    padding: var(--vc-space-3);
    max-height: 180px;
    overflow-y: auto;
    background: var(--vc-surface-2);
    border-radius: var(--vc-radius-sm);
    font-size: 11px;
    line-height: 1.4;
    color: var(--vc-text-muted);
    white-space: pre-wrap;
    word-break: break-word;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(0.88);
      opacity: 0.82;
    }
  }

  @media (max-width: 700px) {
    .ap-hero,
    .ap-entry-head {
      grid-template-columns: 1fr;
    }
    .ap-counter-block {
      justify-items: start;
      text-align: left;
    }
  }
</style>
