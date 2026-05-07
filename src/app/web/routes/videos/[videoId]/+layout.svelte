<script lang="ts">
  import { page } from '$app/state';
  import VideoWorkflowStepper from '@web/components/video/VideoWorkflowStepper.svelte';
  import { buildVideoWorkflowSteps } from '@web/lib/videoWorkflow.js';
  import type { VideoLayoutProps } from '@app/web/types/componentProps.js';

  let { children }: VideoLayoutProps = $props();

  let steps = $derived(
    buildVideoWorkflowSteps(page.params.videoId, page.params.analysisId, page.url.pathname),
  );
</script>

<div class="shell">
  <aside class="rail">
    <p class="rail__h">Workflow</p>
    <VideoWorkflowStepper {steps} />
  </aside>
  <div class="workflow-main">
    {@render children()}
  </div>
</div>

<style>
  .workflow-main {
    min-height: 0;
    overflow-y: auto;
    padding: 28px 32px 48px;
  }
</style>
