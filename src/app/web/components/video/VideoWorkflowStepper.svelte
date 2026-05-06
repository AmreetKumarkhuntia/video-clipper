<script lang="ts">
  import type { VideoWorkflowStep } from '@web/lib/videoWorkflow.js';
  import Icon from '@web/components/Icon.svelte';

  interface Props {
    steps?: VideoWorkflowStep[];
  }

  let { steps = [] }: Props = $props();

  function stepClass(status: VideoWorkflowStep['status']): string {
    if (status === 'complete') return 'pipeline__step is-done';
    if (status === 'current') return 'pipeline__step is-running';
    return 'pipeline__step is-pending';
  }
</script>

<nav class="pipeline" aria-label="Video workflow">
  {#each steps as step}
    {@const cls = stepClass(step.status)}
    <div class={cls}>
      <div class="pipeline__icon">
        {#if step.status === 'complete'}
          <Icon name="check" size={12} />
        {:else if step.status === 'current'}
          <Icon name="loader" size={12} />
        {:else if step.status === 'locked'}
          <Icon name="lock" size={10} />
        {:else}
          {step.number}
        {/if}
      </div>

      <div>
        {#if step.href && step.status !== 'locked'}
          <a class="pipeline__name" href={step.href}>{step.label}</a>
        {:else}
          <span class="pipeline__name">{step.label}</span>
        {/if}
      </div>
    </div>
  {/each}
</nav>
