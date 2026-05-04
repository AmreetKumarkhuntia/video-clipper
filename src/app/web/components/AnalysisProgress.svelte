<script lang="ts">
  import type { AnalysisActivityItem, ActivityPhase } from '@app/web/types/activity.js';

  export let analyzedChunks = 0;
  export let totalChunks = 0;
  export let phase: ActivityPhase = 'idle';
  export let items: AnalysisActivityItem[] = [];

  $: pct = totalChunks > 0 ? Math.round((analyzedChunks / totalChunks) * 100) : 0;
  $: phaseLabel =
    phase === 'idle'
      ? 'Analysis not started'
      : phase === 'analyzing'
        ? 'Analyzing transcript'
        : phase === 'refining'
          ? 'Refining clip windows'
          : 'Analysis complete';

  $: statusTone = phase === 'complete' ? 'done' : phase === 'idle' ? 'idle' : 'running';
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
    gap: var(--s-lg);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s-md);
    align-items: start;
  }

  .hero-copy {
    display: grid;
    gap: var(--s-xs);
  }

  .status-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .label {
    font-weight: var(--fw-semibold);
    font-size: 18px;
  }

  .subhead {
    max-width: 46ch;
    margin: 0;
    color: var(--c-text-muted);
    line-height: 1.5;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: var(--r-full);
    background: var(--c-accent);
    box-shadow: 0 0 0 8px var(--c-accent-soft);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .status-dot--done {
    background: var(--c-success);
    box-shadow: 0 0 0 8px var(--c-success-soft);
    animation: none;
  }

  .status-dot--idle {
    background: var(--c-border-strong);
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-surface-strong) 80%, white 20%);
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
    font-weight: var(--fw-bold);
  }

  .counter-label {
    font-size: 12px;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .bar-track {
    height: 8px;
    border-radius: 999px;
    background: var(--c-surface-strong);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--c-accent),
      color-mix(in srgb, var(--c-accent) 65%, white 35%)
    );
    transition: width 0.2s ease;
  }

  .thread {
    display: grid;
    gap: var(--s-sm);
  }

  .empty {
    margin: 0;
    color: var(--c-text-muted);
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
    border-radius: var(--r-full);
    background: var(--c-accent);
    box-shadow: 0 0 0 5px var(--c-accent-soft);
  }

  .bullet--done {
    background: var(--c-success);
    box-shadow: 0 0 0 5px var(--c-success-soft);
  }

  .bullet--error {
    background: var(--c-error);
    box-shadow: 0 0 0 5px rgba(173, 49, 49, 0.12);
  }

  .line {
    width: 1px;
    height: 100%;
    background: var(--c-border);
  }

  .entry:last-child .line {
    opacity: 0;
  }

  .content {
    display: grid;
    gap: var(--s-xs);
    padding-bottom: var(--s-sm);
  }

  .entry-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s-sm);
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
    background: var(--c-surface-muted);
    color: var(--c-text-muted);
    font-size: 11px;
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .badge[data-status='done'] {
    background: var(--c-success-soft);
    color: var(--c-success);
  }

  .badge[data-status='error'] {
    background: rgba(173, 49, 49, 0.12);
    color: var(--c-error);
  }

  .detail {
    margin: 0;
    color: var(--c-text-secondary);
    line-height: 1.45;
  }

  details {
    margin-top: 2px;
  }

  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--c-text-muted);
    user-select: none;
  }

  .reasoning {
    margin: var(--s-xs) 0 0;
    padding: var(--s-sm);
    max-height: 180px;
    overflow-y: auto;
    background: var(--c-surface-muted);
    border-radius: var(--r-sm);
    font-size: 11px;
    line-height: 1.4;
    color: var(--c-text-secondary);
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
