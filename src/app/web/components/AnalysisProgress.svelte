<script lang="ts">
  import type { AnalysisActivityItem, ActivityPhase } from '@app/web/types/activity.js';

  interface Props {
    analyzedChunks?: number;
    totalChunks?: number;
    phase?: ActivityPhase;
    items?: AnalysisActivityItem[];
  }

  let { analyzedChunks = 0, totalChunks = 0, phase = 'idle', items = [] }: Props = $props();

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

<div class="progress">
  <div class="hero">
    <div class="hero-copy">
      <div class="status-row">
        <span
          class="status-dot"
          class:status-dot--done={statusTone === 'done'}
          class:status-dot--idle={statusTone === 'idle'}
        ></span>
        <span class="label">{phaseLabel}</span>
      </div>
      <p class="subhead">
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
      <div class="counter-block">
        <span class="counter">{analyzedChunks}/{totalChunks}</span>
        <span class="counter-label">chunks resolved</span>
      </div>
    {/if}
  </div>

  {#if totalChunks > 0}
    <div class="bar-track" aria-hidden="true">
      <div class="bar-fill" style={`width: ${pct}%`}></div>
    </div>
  {/if}

  <div class="thread" aria-label="Analysis activity thread">
    {#if items.length === 0}
      <p class="empty">
        {phase === 'idle'
          ? 'No analysis events yet.'
          : 'Analysis events will appear here once the stream starts.'}
      </p>
    {:else}
      {#each items as item (item.id)}
        <article class="entry" data-status={item.status}>
          <div class="rail">
            <span
              class="bullet"
              class:bullet--done={item.status === 'done'}
              class:bullet--error={item.status === 'error'}
            ></span>
            <span class="line"></span>
          </div>

          <div class="content">
            <div class="entry-head">
              <h3>{item.title}</h3>
              <span class="badge" data-status={item.status}>{item.status}</span>
            </div>

            {#if item.detail}
              <p class="detail">{item.detail}</p>
            {/if}

            {#if item.rawText}
              <details>
                <summary>Show live model text</summary>
                <pre class="reasoning">{item.rawText}</pre>
              </details>
            {/if}
          </div>
        </article>
      {/each}
    {/if}
  </div>
</div>

<style>
  .progress {
    display: grid;
    gap: var(--vc-space-5);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--vc-space-4);
    align-items: start;
  }

  .hero-copy {
    display: grid;
    gap: var(--vc-space-2);
  }

  .status-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .label {
    font-weight: 600;
    font-size: 18px;
  }

  .subhead {
    max-width: 46ch;
    margin: 0;
    color: var(--vc-text-muted);
    line-height: 1.5;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vc-clay-500);
    box-shadow: 0 0 0 8px var(--vc-clay-soft);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .status-dot--done {
    background: var(--vc-success);
    box-shadow: 0 0 0 8px var(--vc-success-soft);
    animation: none;
  }

  .status-dot--idle {
    background: var(--vc-border-strong);
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--vc-surface-2) 80%, white 20%);
    animation: none;
  }

  .counter-block {
    display: grid;
    justify-items: end;
    gap: 2px;
    text-align: right;
  }

  .counter {
    font-size: 26px;
    font-weight: 700;
  }

  .counter-label {
    font-size: 12px;
    color: var(--vc-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .bar-track {
    height: 8px;
    border-radius: 999px;
    background: var(--vc-surface-2);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--vc-clay-500),
      color-mix(in srgb, var(--vc-clay-500) 65%, white 35%)
    );
    transition: width 0.2s ease;
  }

  .thread {
    display: grid;
    gap: var(--vc-space-3);
  }

  .empty {
    margin: 0;
    color: var(--vc-text-muted);
  }

  .entry {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 12px;
  }

  .rail {
    display: grid;
    justify-items: center;
    grid-template-rows: auto 1fr;
    gap: 4px;
  }

  .bullet {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vc-clay-500);
    box-shadow: 0 0 0 5px var(--vc-clay-soft);
  }

  .bullet--done {
    background: var(--vc-success);
    box-shadow: 0 0 0 5px var(--vc-success-soft);
  }

  .bullet--error {
    background: var(--vc-error);
    box-shadow: 0 0 0 5px rgba(173, 49, 49, 0.12);
  }

  .line {
    width: 1px;
    height: 100%;
    background: var(--vc-border);
  }

  .entry:last-child .line {
    opacity: 0;
  }

  .content {
    display: grid;
    gap: var(--vc-space-2);
    padding-bottom: var(--vc-space-3);
  }

  .entry-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--vc-space-3);
    align-items: center;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }

  .badge {
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--vc-surface-2);
    color: var(--vc-text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .badge[data-status='done'] {
    background: var(--vc-success-soft);
    color: var(--vc-success);
  }

  .badge[data-status='error'] {
    background: rgba(173, 49, 49, 0.12);
    color: var(--vc-error);
  }

  .detail {
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

  .reasoning {
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
    .hero,
    .entry-head {
      grid-template-columns: 1fr;
    }
    .counter-block {
      justify-items: start;
      text-align: left;
    }
  }
</style>
