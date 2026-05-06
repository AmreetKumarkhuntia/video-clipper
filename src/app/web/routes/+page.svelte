<script lang="ts">
  import type { ChannelSummary } from '@lib/types/index.js';
  import { apiFetch } from '@web/lib/api.js';
  import Icon from '@web/components/Icon.svelte';
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

<div class="start-page">
  <div class="main--empty">
    <div class="empty">
      <div class="empty__glyph">
        <Icon name="youtube" size={48} />
      </div>

      <p class="empty__lede">Find strong clip moments without leaving your transcript workflow.</p>

      <form class="empty__url" on:submit|preventDefault={resolveChannel}>
        <div class="vc-input-wrap" style="flex:1">
          <Icon name="search" />
          <input
            class="vc-input vc-input--with-icon vc-input--lg"
            bind:value={channelInput}
            placeholder="@handle, channel ID, or URL"
            aria-label="YouTube channel"
          />
        </div>
        <button class="vc-btn vc-btn--primary vc-btn--lg" type="submit" disabled={isLoading}>
          {isLoading ? 'Resolving…' : 'Open channel'}
        </button>
      </form>

      {#if errorMessage}
        <p class="error-chip">{errorMessage}</p>
      {/if}

      <div class="empty__hints">
        <span class="empty__hint"><Icon name="youtube" size={13} /> YouTube channels</span>
        <span class="empty__hint"><Icon name="video" size={13} /> Any public video</span>
        <span class="empty__hint"><Icon name="sparkles" size={13} /> AI clip analysis</span>
      </div>

      {#if resolvedChannel}
        <div class="result-wrap">
          <ChannelCard channel={resolvedChannel} />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .start-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(100vh - 57px);
    padding: 0 24px 48px;
  }

  .main--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
  }

  .error-chip {
    margin: -8px 0 16px;
    font-size: var(--vc-text-13);
    color: var(--vc-error);
  }

  .result-wrap {
    width: 100%;
    margin-top: 8px;
  }
</style>
