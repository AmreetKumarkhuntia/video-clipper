<script lang="ts">
  import { page } from '$app/stores';
  import type { ClipArtifact, ClipCandidate, ClipPlan } from '@app/web/types/analysis.js';

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
      const response = await fetch('/api/library/analyses');
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      const analyses = readAnalyses(body);
      plan = analyses.find((item) => item.id === analysisId) ?? null;
      if (!plan) errorMessage = 'Analysis artifact was not found.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function clipSelected(): Promise<void> {
    if (!plan) return;
    const selected = plan.candidates.filter((candidate) => candidate.selected);
    if (selected.length === 0) {
      errorMessage = 'Select at least one clip candidate.';
      return;
    }

    isClipping = true;
    errorMessage = '';

    try {
      const response = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoId,
          analysisId,
          segments: selected,
        }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      clips = readClips(body);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isClipping = false;
    }
  }

  function toggleCandidate(candidate: ClipCandidate): void {
    candidate.selected = !candidate.selected;
  }

  function formatTime(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function readAnalyses(body: unknown): ClipPlan[] {
    if (
      typeof body === 'object' &&
      body !== null &&
      'analyses' in body &&
      Array.isArray(body.analyses)
    ) {
      return body.analyses as ClipPlan[];
    }

    return [];
  }

  function readClips(body: unknown): ClipArtifact[] {
    if (typeof body === 'object' && body !== null && 'clips' in body && Array.isArray(body.clips)) {
      return body.clips as ClipArtifact[];
    }

    return [];
  }

  function readApiError(body: unknown): string {
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }

    return 'Something went wrong.';
  }
</script>

{#if isLoading}
  <p class="muted">Loading analysis...</p>
{:else if errorMessage}
  <p class="error">{errorMessage}</p>
{/if}

{#if plan}
  <section class="analysis-head">
    <div>
      <p>Clip plan</p>
      <h1>{plan.title}</h1>
    </div>
    <button type="button" on:click={clipSelected} disabled={isClipping}>
      {isClipping ? 'Generating clips...' : 'Clip selected'}
    </button>
  </section>

  <section class="candidate-list" aria-label="Clip candidates">
    {#each plan.candidates as candidate}
      <article class:selected={candidate.selected}>
        <label>
          <input
            type="checkbox"
            checked={candidate.selected}
            on:change={() => toggleCandidate(candidate)}
          />
          <span>Rank {candidate.rank}</span>
        </label>
        <div>
          <h2>{formatTime(candidate.startSec)} - {formatTime(candidate.endSec)}</h2>
          <p>{candidate.reason}</p>
          {#if candidate.transcriptExcerpt}
            <blockquote>{candidate.transcriptExcerpt}</blockquote>
          {/if}
        </div>
        <strong>{candidate.score}/10</strong>
      </article>
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
  .analysis-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 24px;
  }

  .analysis-head p {
    margin: 0 0 6px;
    color: #6c716a;
    font-size: 13px;
    font-weight: 680;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 32px;
  }

  button {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 8px;
    background: #20251f;
    color: #fff;
    font-weight: 720;
  }

  button:disabled {
    opacity: 0.58;
  }

  .candidate-list {
    display: grid;
    gap: 12px;
  }

  article {
    display: grid;
    grid-template-columns: 120px 1fr 64px;
    gap: 18px;
    align-items: start;
    padding: 16px 0;
    border-top: 1px solid #ddded9;
    opacity: 0.7;
  }

  article.selected {
    opacity: 1;
  }

  label {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #4f564e;
    font-weight: 720;
  }

  h2 {
    margin: 0 0 6px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: #596058;
  }

  blockquote {
    margin: 10px 0 0;
    padding-left: 12px;
    border-left: 3px solid #c8cbc4;
    color: #6b7069;
  }

  strong {
    justify-self: end;
  }

  .clips {
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid #ddded9;
  }

  .muted {
    color: #666c65;
  }

  .error {
    color: #ad3131;
  }

  @media (max-width: 760px) {
    .analysis-head,
    article {
      grid-template-columns: 1fr;
    }

    .analysis-head {
      align-items: start;
    }

    strong {
      justify-self: start;
    }
  }
</style>
