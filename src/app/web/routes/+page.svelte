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
  <div class="heading">
    <p class="eyebrow">Local YouTube clipping workbench</p>
    <h1>Choose a channel to start finding clip-worthy videos.</h1>
  </div>

  <form class="channel-form" on:submit|preventDefault={resolveChannel}>
    <input
      bind:value={channelInput}
      aria-label="YouTube channel"
      placeholder="@GoogleDevelopers, UC..., or channel URL"
    />
    <Button type="submit" disabled={isLoading}>
      {isLoading ? 'Resolving...' : 'Resolve'}
    </Button>
  </form>

  {#if errorMessage}
    <ErrorText message={errorMessage} />
  {/if}

  {#if resolvedChannel}
    <ChannelCard channel={resolvedChannel} />
  {/if}
</section>

<style>
  .workspace {
    display: grid;
    gap: var(--s-lg);
    max-width: 820px;
    padding-top: 44px;
  }

  .heading {
    display: grid;
    gap: var(--s-sm);
  }

  h1 {
    max-width: 760px;
    margin: 0;
    font-size: clamp(34px, 6vw, 64px);
    line-height: 0.96;
  }

  .channel-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--s-sm);
    width: min(100%, 760px);
  }

  input {
    min-width: 0;
    height: 48px;
    padding: 0 var(--s-md);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: var(--c-surface);
    color: var(--c-text);
  }

  @media (max-width: 620px) {
    .channel-form {
      grid-template-columns: 1fr;
    }
  }
</style>
