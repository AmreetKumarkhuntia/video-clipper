<script lang="ts">
  export let analyzedChunks = 0;
  export let totalChunks = 0;
  export let phase: 'analyzing' | 'refining' | 'complete' = 'analyzing';
  export let text = '';

  $: pct = totalChunks > 0 ? Math.round((analyzedChunks / totalChunks) * 100) : 0;
  $: phaseLabel =
    phase === 'analyzing'
      ? 'Analyzing chunks...'
      : phase === 'refining'
        ? 'Refining boundaries...'
        : 'Complete';

  $: displayText = text.length > 600 ? text.slice(-600) : text;
</script>

<div class="progress">
  <div class="header">
    <span class="label">{phaseLabel}</span>
    {#if totalChunks > 0}
      <span class="counter">{analyzedChunks}/{totalChunks} chunks</span>
    {/if}
  </div>

  {#if totalChunks > 0}
    <div class="bar-track">
      <div class="bar-fill" style="width: {pct}%"></div>
    </div>
  {/if}

  {#if displayText}
    <details>
      <summary>LLM reasoning</summary>
      <pre class="reasoning">{displayText}</pre>
    </details>
  {/if}
</div>

<style>
  .progress {
    display: grid;
    gap: var(--s-sm);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .label {
    font-weight: var(--fw-semibold);
  }

  .counter {
    font-size: 13px;
    color: var(--c-text-muted);
  }

  .bar-track {
    height: 6px;
    border-radius: 3px;
    background: var(--c-border);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--c-primary);
    transition: width 0.2s ease;
  }

  details {
    margin-top: var(--s-xs);
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
    max-height: 160px;
    overflow-y: auto;
    background: var(--c-bg);
    border-radius: var(--r-sm);
    font-size: 11px;
    line-height: 1.4;
    color: var(--c-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
