<script lang="ts">
  import { page } from '$app/stores';
  import type { ClipArtifact, ClipCandidate, ClipPlan } from '@app/web/types/analysis.js';
  import { apiFetch } from '../../../../../lib/api.js';
  import Button from '../../../../../components/Button.svelte';
  import ErrorText from '../../../../../components/ErrorText.svelte';
  import MutedText from '../../../../../components/MutedText.svelte';
  import PageHead from '../../../../../components/PageHead.svelte';
  import CandidateCard from '../../../../../components/CandidateCard.svelte';

  let plan: ClipPlan | null = null;
  let clips: ClipArtifact[] = [];
  let isLoading = false;
  let isClipping = false;
  let errorMessage = '';

  $: videoId = $page.params.videoId;
  $: analysisId = $page.params.analysisId;

  $: if (analysisId) {
    void loadPlan();
  }

  async function loadPlan(): Promise<void> {
    isLoading = true;
    errorMessage = '';

    try {
      const data = await apiFetch<{ analyses: ClipPlan[] }>('/api/library/analyses');
      plan = data.analyses.find((item: ClipPlan) => item.id === analysisId) ?? null;
      if (!plan) errorMessage = 'Analysis artifact was not found.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function clipSelected(): Promise<void> {
    if (!plan) return;
    const selected = plan.candidates.filter((c) => c.selected);
    if (selected.length === 0) {
      errorMessage = 'Select at least one clip candidate.';
      return;
    }

    isClipping = true;
    errorMessage = '';

    try {
      const data = await apiFetch<{ clips: ClipArtifact[] }>('/api/clips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoId, analysisId, segments: selected }),
      });
      clips = data.clips;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isClipping = false;
    }
  }

  function toggleCandidate(candidate: ClipCandidate): void {
    candidate.selected = !candidate.selected;
  }
</script>

{#if isLoading}
  <MutedText>Loading analysis...</MutedText>
{:else if errorMessage}
  <ErrorText message={errorMessage} />
{/if}

{#if plan}
  <PageHead eyebrow="Clip plan" heading={plan.title}>
    <Button slot="action" on:click={clipSelected} disabled={isClipping}>
      {isClipping ? 'Generating clips...' : 'Clip selected'}
    </Button>
  </PageHead>

  <section class="candidate-list" aria-label="Clip candidates">
    {#each plan.candidates as candidate}
      <CandidateCard {candidate} on:toggle={() => toggleCandidate(candidate)} />
    {/each}
  </section>

  {#if clips.length > 0}
    <section class="clips">
      <h2>Generated clips</h2>
      {#each clips as clip}
        <p>{clip.filename} saved to {clip.path}</p>
      {/each}
    </section>
  {/if}
{/if}

<style>
  .candidate-list {
    display: grid;
    gap: 12px;
  }

  .clips {
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid var(--c-border);
  }

  h2 {
    margin: 0 0 var(--s-sm);
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--c-text-muted);
  }
</style>
