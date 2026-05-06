<script lang="ts">
  import { page } from '$app/state';
  import type { ClipArtifact, ClipCandidate, ClipPlan } from '@app/web/types/analysis.js';
  import { apiFetch } from '@web/lib/api.js';
  import Icon from '@web/components/Icon.svelte';

  let plan = $state<ClipPlan | null>(null);
  let clips = $state<ClipArtifact[]>([]);
  let isLoading = $state(false);
  let isClipping = $state(false);
  let errorMessage = $state('');
  let activeTab = $state<'candidates' | 'clips'>('candidates');

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
      if (clips.length > 0) activeTab = 'clips';
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
      activeTab = 'clips';
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

  let selectedCount = $derived(plan?.candidates.filter((c) => c.selected).length ?? 0);
</script>

{#if isLoading}
  <div class="clip-loading">
    <div class="clipgrid">
      {#each Array(6) as _}
        <div class="clipcard">
          <div class="clipcard__thumb"><div class="clipcard__thumb-bg"></div></div>
          <div class="clipcard__body">
            <div class="sk sk--line" style="width:90%;margin-bottom:8px"></div>
            <div class="sk sk--line sk--short"></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else if errorMessage && !plan}
  <p class="clip-error">{errorMessage}</p>
{/if}

{#if plan}
  <div class="clip-page">
    <div class="clip-page__head">
      <div>
        <p class="clip-eyebrow">Clip plan</p>
        <h2 class="clip-title">{plan.title}</h2>
      </div>
      <div class="clip-actions">
        {#if clips.length > 0}
          <a
            href={`/videos/${videoId}/analysis/${analysisId}/connect`}
            class="vc-btn vc-btn--secondary"
            >Continue to Connect <Icon name="arrow-right" size={14} /></a
          >
        {/if}
        <button
          class="vc-btn vc-btn--primary"
          onclick={clipSelected}
          disabled={isClipping || selectedCount === 0}
        >
          {#if isClipping}
            <Icon name="loader" size={14} /> Generating…
          {:else}
            <Icon name="scissors" size={14} /> Clip selected ({selectedCount})
          {/if}
        </button>
      </div>
    </div>

    {#if errorMessage}
      <p class="clip-error">{errorMessage}</p>
    {/if}

    <div class="vc-tabs" role="tablist">
      <button
        class="vc-tab"
        role="tab"
        aria-selected={activeTab === 'candidates'}
        class:is-active={activeTab === 'candidates'}
        onclick={() => (activeTab = 'candidates')}
        >Candidates<span class="tab-count">{plan.candidates.length}</span></button
      >
      <button
        class="vc-tab"
        role="tab"
        aria-selected={activeTab === 'clips'}
        class:is-active={activeTab === 'clips'}
        onclick={() => (activeTab = 'clips')}
        >Clips<span class="tab-count">{clips.length}</span></button
      >
    </div>

    {#if activeTab === 'candidates'}
      <div class="clipgrid" style="margin-top:20px">
        {#each plan.candidates as candidate, i}
          <button
            class="clipcard"
            class:clipcard--selected={candidate.selected}
            onclick={() => toggleCandidate(candidate)}
            type="button"
          >
            <div class="clipcard__thumb">
              <div class="clipcard__thumb-bg"></div>
              <div class="clipcard__thumb-time">
                {candidate.startSec != null
                  ? Math.floor(candidate.startSec / 60) +
                    ':' +
                    String(Math.floor(candidate.startSec % 60)).padStart(2, '0')
                  : '—'}
              </div>
              <div class="clipcard__thumb-aspect">16:9</div>
              <div class="clipcard__thumb-play">
                {#if candidate.selected}
                  <Icon name="check" size={18} />
                {:else}
                  <Icon name="play" size={18} />
                {/if}
              </div>
            </div>
            <div class="clipcard__body">
              <div class="clipcard__row">
                <span class="clipcard__rank">#{i + 1}</span>
                {#if candidate.score != null}
                  <span class="vc-score"
                    >{candidate.score}<span class="vc-score__den">/10</span></span
                  >
                {/if}
                <span class="clipcard__dur">
                  {#if candidate.endSec != null && candidate.startSec != null}
                    {Math.round(candidate.endSec - candidate.startSec)}s
                  {/if}
                </span>
              </div>
              <p class="clipcard__title">
                {candidate.title ?? candidate.reason ?? 'Clip candidate'}
              </p>
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="clipgrid" style="margin-top:20px">
        {#each clips as clip, i}
          <div class="clipcard">
            <div class="clipcard__thumb">
              <div class="clipcard__thumb-bg"></div>
              <div class="clipcard__thumb-play"><Icon name="video" size={18} /></div>
            </div>
            <div class="clipcard__body">
              <div class="clipcard__row">
                <span class="clipcard__rank">#{i + 1}</span>
              </div>
              <p class="clipcard__title">{clip.filename}</p>
              <div class="clipcard__actions">
                <span class="vc-badge vc-badge--success"><Icon name="check" size={10} /> Ready</span
                >
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .clip-loading,
  .clip-error {
    padding: 24px 0;
  }
  .clip-error {
    color: var(--vc-error);
    font-size: var(--vc-text-14);
  }

  .clip-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .clip-page__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .clip-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .clip-title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-26);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--vc-text);
  }

  .clip-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .clipcard--selected {
    border-color: var(--vc-clay-500);
    box-shadow: 0 0 0 1px var(--vc-clay-500);
    background: var(--vc-clay-50);
  }

  button.clipcard {
    text-align: left;
    font: inherit;
    background: var(--vc-surface);
  }
</style>
