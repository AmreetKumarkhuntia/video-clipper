<script lang="ts">
  import { page } from '$app/state';
  import type { ClipArtifact, ClipCandidate, ClipPlan } from '@app/web/types/analysis.js';
  import { apiFetch } from '@web/lib/api.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import NavLink from '@web/components/NavLink.svelte';
  import PageHead from '@web/components/PageHead.svelte';
  import CandidateCard from '@web/components/CandidateCard.svelte';

  let plan = $state<ClipPlan | null>(null);
  let clips = $state<ClipArtifact[]>([]);
  let isLoading = $state(false);
  let isClipping = $state(false);
  let errorMessage = $state('');

  let videoId = $derived(page.params.videoId);
  let analysisId = $derived(page.params.analysisId);

  $effect(() => {
    if (analysisId) {
      void loadArtifacts();
    }
  });

  async function loadArtifacts(): Promise<void> {
    isLoading = true;
    errorMessage = '';

    try {
      const [loadedPlan, loadedClips] = await Promise.all([
        apiFetch<ClipPlan>(`/api/library/analyses/${analysisId}`),
        apiFetch<{ clips: ClipArtifact[] }>(
          `/api/library/clips?analysisId=${encodeURIComponent(analysisId)}`,
        ),
      ]);

      plan = loadedPlan;
      clips = loadedClips.clips;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      plan = null;
      clips = [];
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
    if (!plan) return;
    plan = {
      ...plan,
      candidates: plan.candidates.map((c) =>
        c.id === candidate.id ? { ...c, selected: !c.selected } : c,
      ),
    };
  }
</script>

{#if isLoading}
  <MutedText>Loading analysis...</MutedText>
{:else if errorMessage}
  <ErrorText message={errorMessage} />
{/if}

{#if plan}
  <PageHead eyebrow="Clip plan" heading={plan.title}>
    <div class="actions" slot="action">
      {#if clips.length > 0}
        <NavLink href={`/videos/${videoId}/analysis/${analysisId}/connect`}>
          Continue to Connect
        </NavLink>
      {/if}
      <Button on:click={clipSelected} disabled={isClipping}>
        {isClipping ? 'Generating clips...' : 'Clip selected'}
      </Button>
    </div>
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
  .actions {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

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

  @media (max-width: 620px) {
    .actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
