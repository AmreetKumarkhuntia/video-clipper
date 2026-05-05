<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import VideoWorkflowStepper from '@web/components/video/VideoWorkflowStepper.svelte';
  import { buildVideoWorkflowSteps } from '@web/lib/videoWorkflow.js';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let steps = $derived(
    buildVideoWorkflowSteps(page.params.videoId, page.params.analysisId, page.url.pathname),
  );
</script>

<div class="workflow-shell">
  <VideoWorkflowStepper {steps} />
  {@render children()}
</div>

<style>
  .workflow-shell {
    display: grid;
    gap: var(--s-lg);
  }
</style>
