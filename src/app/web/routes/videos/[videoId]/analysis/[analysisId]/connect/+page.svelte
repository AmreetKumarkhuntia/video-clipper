<script lang="ts">
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Button from '@web/components/Button.svelte';
  import ErrorText from '@web/components/ErrorText.svelte';
  import FormField from '@web/components/FormField.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import NavLink from '@web/components/NavLink.svelte';
  import PageHead from '@web/components/PageHead.svelte';
  import Panel from '@web/components/Panel.svelte';
  import type { SaveYouTubeManualAuthRequest, YouTubeAuthStatus } from '@app/web/types/publish.js';

  let authStatus = $state<YouTubeAuthStatus | null>(null);
  let isLoading = $state(false);
  let isSavingAuth = $state(false);
  let errorMessage = $state('');
  let showAdvancedAuth = $state(false);

  let accessToken = $state('');
  let refreshToken = $state('');
  let clientId = $state('');
  let clientSecret = $state('');
  let expiryDate = $state('');

  let videoId = $derived(page.params.videoId);
  let analysisId = $derived(page.params.analysisId);
  let authError = $derived(page.url.searchParams.get('authError'));

  $effect(() => {
    if (analysisId) {
      void loadAuthStatus();
    }
  });

  $effect(() => {
    if (authError) {
      errorMessage = authError;
    }
  });

  async function loadAuthStatus(): Promise<void> {
    isLoading = true;
    errorMessage = '';

    try {
      authStatus = await apiFetch<YouTubeAuthStatus>('/api/youtube/auth/status');
    } catch (error) {
      authStatus = null;
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function connectManualToken(): Promise<void> {
    isSavingAuth = true;
    errorMessage = '';

    try {
      authStatus = await apiFetch<YouTubeAuthStatus>('/api/youtube/auth/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          refreshToken: refreshToken || undefined,
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined,
          expiryDate: expiryDate ? Number(expiryDate) : undefined,
        } satisfies SaveYouTubeManualAuthRequest),
      });
      showToast('success', 'YouTube account connected.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', 'Failed to connect YouTube account.');
    } finally {
      isSavingAuth = false;
    }
  }

  async function disconnectAccount(): Promise<void> {
    try {
      await apiFetch<{ success: boolean }>('/api/youtube/auth/disconnect', {
        method: 'POST',
      });
      authStatus = { connected: false, oauthConfigured: authStatus?.oauthConfigured ?? false };
      accessToken = '';
      refreshToken = '';
      clientId = '';
      clientSecret = '';
      expiryDate = '';
      showToast('success', 'YouTube account disconnected.');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      showToast('error', 'Failed to disconnect YouTube account.');
    }
  }

  function startOAuth(): void {
    const returnTo = `/videos/${videoId}/analysis/${analysisId}/connect`;
    window.location.href = `/api/youtube/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
  }
</script>

{#if isLoading}
  <MutedText>Loading YouTube connection...</MutedText>
{:else if errorMessage && !authStatus}
  <ErrorText message={errorMessage} />
{/if}

<PageHead eyebrow="Connect" heading="Connect the YouTube channel you want to publish to">
  <div class="actions" slot="action">
    <NavLink href={`/videos/${videoId}/analysis/${analysisId}`}>Back to Clip</NavLink>
    {#if authStatus?.connected}
      <NavLink href={`/videos/${videoId}/analysis/${analysisId}/prepare`}>
        Continue to Prepare
      </NavLink>
    {/if}
  </div>
</PageHead>

{#if errorMessage}
  <ErrorText message={errorMessage} />
{/if}

<Panel tag="section">
  <div class="panel-head">
    <div>
      <p class="eyebrow">YouTube account</p>
      <h2>{authStatus?.connected ? authStatus.channel?.title : 'Connect a channel'}</h2>
    </div>

    {#if authStatus?.connected}
      <Button variant="outline" on:click={disconnectAccount}>Disconnect</Button>
    {/if}
  </div>

  {#if authStatus?.connected}
    <p class="helper">
      Connected as {authStatus.channel?.title}. You can continue to Prepare once the channel looks
      correct.
    </p>
  {:else}
    <div class="panel-actions">
      {#if authStatus?.oauthConfigured}
        <Button on:click={startOAuth}>Connect to YouTube</Button>
      {:else}
        <div class="oauth-warning">
          <p class="helper">
            Configure `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, and
            `YOUTUBE_OAUTH_REDIRECT_URI` in `.env` or Settings before connecting YouTube.
          </p>
        </div>
      {/if}
    </div>

    <button
      class="advanced-toggle"
      type="button"
      onclick={() => (showAdvancedAuth = !showAdvancedAuth)}
    >
      {showAdvancedAuth ? 'Hide advanced manual token entry' : 'Advanced: use manual token'}
    </button>

    {#if showAdvancedAuth}
      <div class="field-grid">
        <FormField label="Access token" full>
          <textarea rows="4" bind:value={accessToken}></textarea>
        </FormField>

        <FormField label="Refresh token (optional)" full>
          <textarea rows="3" bind:value={refreshToken}></textarea>
        </FormField>

        <FormField label="Client ID override (optional)">
          <input bind:value={clientId} />
        </FormField>

        <FormField label="Client secret override (optional)">
          <input bind:value={clientSecret} />
        </FormField>

        <FormField label="Expiry timestamp in ms (optional)" full>
          <input bind:value={expiryDate} inputmode="numeric" />
        </FormField>
      </div>

      <div class="panel-actions panel-actions--manual">
        <Button
          variant="outline"
          on:click={connectManualToken}
          disabled={isSavingAuth || accessToken.trim() === ''}
        >
          {isSavingAuth ? 'Connecting...' : 'Connect token'}
        </Button>
      </div>
    {/if}
  {/if}
</Panel>

<style>
  .actions {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

  .panel-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--s-md);
    margin-bottom: var(--s-md);
  }

  h2 {
    margin: 4px 0 0;
    font-size: clamp(22px, 2.6vw, 28px);
    line-height: 1.12;
    overflow-wrap: anywhere;
  }

  .helper {
    margin: 0;
    color: var(--c-text-secondary);
    line-height: 1.6;
  }

  .panel-actions {
    display: flex;
    justify-content: flex-start;
    margin-top: var(--s-md);
  }

  .panel-actions--manual {
    margin-top: var(--s-lg);
  }

  .advanced-toggle {
    margin-top: var(--s-md);
    padding: 0;
    border: none;
    background: none;
    color: var(--c-accent);
    font: inherit;
    font-weight: var(--fw-semibold);
    text-align: left;
    cursor: pointer;
  }

  .oauth-warning {
    max-width: 56ch;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-md);
    margin-top: var(--s-md);
  }

  @media (max-width: 760px) {
    .actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
