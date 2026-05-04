<script lang="ts">
  import type { ChannelSummary } from '@lib/types/index.js';
  import { apiFetch } from '@web/lib/api.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import ChannelCard from '@web/components/ChannelCard.svelte';

  let channelInput = '';
  let isLoading = false;
  let errorMessage = '';
  let resolvedChannel: ChannelSummary | null = null;

  async function resolveChannel(): Promise<void> {
    errorMessage = '';
    resolvedChannel = null;

    if (channelInput.trim() === '') {
      errorMessage = 'Enter a channel handle, ID, or URL.';
      return;
    }

    isLoading = true;
    try {
      resolvedChannel = await apiFetch<ChannelSummary>(
        `/api/youtube/channels/resolve?input=${encodeURIComponent(channelInput.trim())}`,
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }
</script>

<section class="workspace">
  <div class="hero-card">
    <div class="heading">
      <p class="eyebrow">Local YouTube clipping workbench</p>
      <h1>Find strong clip moments without leaving your transcript workflow.</h1>
      <p class="lede">
        Resolve a channel, browse recent uploads, inspect transcripts line by line, and watch
        analysis progress unfold as the model works through each chunk.
      </p>
    </div>

    <form class="channel-form" on:submit|preventDefault={resolveChannel}>
      <label class="field">
        <span>Channel handle, ID, or URL</span>
        <input
          bind:value={channelInput}
          aria-label="YouTube channel"
          placeholder="@GoogleDevelopers, UC..., or channel URL"
        />
      </label>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Resolving channel...' : 'Open channel workspace'}
      </Button>
    </form>

    {#if errorMessage}
      <ErrorText message={errorMessage} />
    {/if}
  </div>

  {#if resolvedChannel}
    <div class="result-card">
      <ChannelCard channel={resolvedChannel} />
    </div>
  {/if}
</section>

<style>
  .workspace {
    display: grid;
    gap: var(--s-lg);
    max-width: 920px;
    margin: 0 auto;
    padding-top: 52px;
  }

  .hero-card {
    display: grid;
    gap: var(--s-xl);
    padding: clamp(24px, 4vw, 40px);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl);
    background:
      radial-gradient(circle at top right, rgba(89, 102, 242, 0.08), transparent 34%),
      linear-gradient(180deg, color-mix(in srgb, var(--c-surface) 78%, white 22%), var(--c-surface));
    box-shadow: var(--shadow-panel);
  }

  .heading {
    display: grid;
    gap: var(--s-sm);
  }

  h1 {
    margin: 0;
    font-size: clamp(36px, 6vw, 68px);
    line-height: 0.94;
    letter-spacing: -0.04em;
  }

  .lede {
    max-width: 58ch;
    margin: 0;
    color: var(--c-text-secondary);
    font-size: 17px;
    line-height: 1.6;
  }

  .channel-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s-md);
    align-items: end;
  }

  .field {
    display: grid;
    gap: var(--s-xs);
  }

  .field span {
    font-size: 13px;
    font-weight: var(--fw-semibold);
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  input {
    min-width: 0;
    height: 54px;
    padding: 0 var(--s-md);
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--c-surface) 84%, white 16%);
    color: var(--c-text);
  }

  input:focus {
    outline: 2px solid transparent;
    border-color: var(--c-accent);
    box-shadow: 0 0 0 4px rgba(89, 102, 242, 0.12);
  }

  .result-card {
    padding: 0 clamp(20px, 3vw, 32px);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl);
    background: var(--c-surface);
    box-shadow: var(--shadow-soft);
  }

  @media (max-width: 620px) {
    .channel-form {
      grid-template-columns: 1fr;
    }

    .workspace {
      padding-top: 28px;
    }
  }
</style>
