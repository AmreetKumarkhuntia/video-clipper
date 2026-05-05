<script lang="ts">
  import type { VideoWorkflowStep } from '@web/lib/videoWorkflow.js';

  interface Props {
    steps?: VideoWorkflowStep[];
  }

  let { steps = [] }: Props = $props();
</script>

<nav class="workflow-stepper" aria-label="Video workflow">
  <ol>
    {#each steps as step}
      <li class={`step step--${step.status}`}>
        {#if step.href && step.status === 'complete'}
          <a class="step-link" href={step.href}>
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </a>
        {:else}
          <span class="step-link" aria-current={step.status === 'current' ? 'step' : undefined}>
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .workflow-stepper {
    overflow-x: auto;
    margin-bottom: var(--s-lg);
    padding-bottom: 2px;
  }

  ol {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(160px, 1fr);
    gap: var(--s-sm);
    min-width: max-content;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    min-width: 0;
  }

  .step-link {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 16px;
    border: 1px solid var(--c-border);
    border-radius: 16px;
    background: var(--c-surface);
    color: inherit;
  }

  a.step-link {
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      background-color 0.16s ease,
      box-shadow 0.16s ease;
  }

  a.step-link:hover {
    transform: translateY(-1px);
    border-color: var(--c-border-strong);
    background: color-mix(in srgb, var(--c-surface) 85%, white 15%);
    box-shadow: var(--shadow-soft);
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    background: var(--c-surface-muted);
    color: var(--c-text-muted);
    font-size: 13px;
    font-weight: var(--fw-bold);
    flex: 0 0 auto;
  }

  .step-label {
    font-size: 14px;
    font-weight: var(--fw-semibold);
    white-space: nowrap;
  }

  .step--current .step-link {
    border-color: color-mix(in srgb, var(--c-primary) 35%, var(--c-border) 65%);
    background:
      linear-gradient(180deg, rgba(89, 102, 242, 0.12), rgba(89, 102, 242, 0.03)), var(--c-surface);
    box-shadow: var(--shadow-soft);
  }

  .step--current .step-number,
  .step--complete .step-number {
    background: var(--c-primary);
    color: var(--c-primary-text);
  }

  .step--complete .step-link {
    border-color: color-mix(in srgb, var(--c-primary) 20%, var(--c-border) 80%);
  }

  .step--locked .step-link {
    opacity: 0.58;
  }

  @media (max-width: 720px) {
    ol {
      grid-auto-columns: minmax(140px, 1fr);
    }

    .step-link {
      min-height: 52px;
      padding: 0 14px;
    }
  }
</style>
