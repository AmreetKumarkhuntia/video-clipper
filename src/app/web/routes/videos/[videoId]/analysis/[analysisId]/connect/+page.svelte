<script lang="ts">
  import { page } from '$app/state';
  import { apiFetch } from '@web/lib/api.js';
  import { showToast } from '@web/lib/toastStore.js';
  import Icon from '@web/components/Icon.svelte';
  import Button from '@web/components/Button.svelte';
  import Card from '@web/components/Card.svelte';
  import Field from '@web/components/Field.svelte';
  import InputText from '@web/components/InputText.svelte';
  import Textarea from '@web/components/Textarea.svelte';
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
    if (analysisId) void loadAuthStatus();
  });

  $effect(() => {
    if (authError) errorMessage = authError;
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
      await apiFetch<{ success: boolean }>('/api/youtube/auth/disconnect', { method: 'POST' });
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

<div class="connect-page">
  <div class="connect-head">
    <div>
      <p class="connect-eyebrow">Step 3 · Connect</p>
      <h2 class="connect-title">Connect YouTube channel</h2>
      <p class="connect-sub">Connect the channel you want to publish clips to.</p>
    </div>
    <div class="connect-nav">
      <Button variant="secondary" href={`/videos/${videoId}/analysis/${analysisId}`}>
        ← Back to Clip
      </Button>
      {#if authStatus?.connected}
        <Button variant="primary" href={`/videos/${videoId}/analysis/${analysisId}/prepare`}>
          Continue to Prepare <Icon name="arrow-right" size={14} />
        </Button>
      {/if}
    </div>
  </div>

  {#if errorMessage}
    <p class="connect-error">{errorMessage}</p>
  {/if}

  {#if isLoading}
    <div class="provider-grid">
      {#each Array(2) as _}
        <div class="provider">
          <div class="sk sk--line" style="width:120px;height:14px;margin-bottom:8px"></div>
          <div class="sk sk--line sk--short"></div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="provider-grid" style="max-width:640px">
      <div class="provider" class:is-active={authStatus?.connected}>
        <div class="provider__head">
          <Icon name="youtube" size={20} />
          <span class="provider__name">YouTube</span>
        </div>
        <p class="provider__model">
          {#if authStatus?.connected}
            {authStatus.channel?.title ?? 'Connected'}
          {:else}
            Not connected
          {/if}
        </p>
        {#if authStatus?.connected}
          <div class="provider__check"><Icon name="check" size={12} /></div>
        {/if}
      </div>
    </div>

    <div class="connect-actions" style="margin-top:20px">
      {#if authStatus?.connected}
        <Button variant="danger" onclick={disconnectAccount}>Disconnect</Button>
      {:else if authStatus?.oauthConfigured}
        <Button variant="primary" onclick={startOAuth}>
          <Icon name="external-link" size={14} /> Connect to YouTube
        </Button>
      {:else}
        <Card as="div" class="connect-config-hint">
          <p style="font-size:var(--vc-text-13);color:var(--vc-text-muted);margin:0">
            Configure <code>YOUTUBE_OAUTH_CLIENT_ID</code>,
            <code>YOUTUBE_OAUTH_CLIENT_SECRET</code>, and <code>YOUTUBE_OAUTH_REDIRECT_URI</code> in
            <code>.env</code> or Settings before connecting.
          </p>
        </Card>
      {/if}
    </div>

    <div class="advanced-section">
      <button
        class="advanced-toggle"
        type="button"
        onclick={() => (showAdvancedAuth = !showAdvancedAuth)}
      >
        {showAdvancedAuth ? 'Hide' : 'Advanced:'} manual token entry
        <Icon name={showAdvancedAuth ? 'chevron-down' : 'chevron-right'} size={13} />
      </button>

      {#if showAdvancedAuth}
        <div class="settings-form" style="max-width:560px;margin-top:16px">
          <Field label="Access token" for="access-token">
            <Textarea id="access-token" rows={4} bind:value={accessToken} monospace />
          </Field>
          <Field label="Refresh token (optional)" for="refresh-token">
            <Textarea id="refresh-token" rows={3} bind:value={refreshToken} monospace />
          </Field>
          <div class="settings-form--two">
            <Field label="Client ID override" for="client-id">
              <InputText id="client-id" bind:value={clientId} />
            </Field>
            <Field label="Client secret override" for="client-secret">
              <InputText id="client-secret" bind:value={clientSecret} secret />
            </Field>
          </div>
          <Field label="Expiry timestamp in ms (optional)" for="expiry">
            <InputText id="expiry" inputmode="numeric" bind:value={expiryDate} />
          </Field>
          <div>
            <Button
              variant="secondary"
              onclick={connectManualToken}
              disabled={isSavingAuth || accessToken.trim() === ''}
            >
              {isSavingAuth ? 'Connecting…' : 'Connect token'}
            </Button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(.connect-config-hint) {
    max-width: 480px;
  }

  .connect-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .connect-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .connect-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .connect-title {
    font-family: var(--vc-font-display);
    font-size: var(--vc-text-26);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
    color: var(--vc-text);
  }

  .connect-sub {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    margin: 0;
  }

  .connect-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .connect-error {
    color: var(--vc-error);
    font-size: var(--vc-text-14);
    margin-bottom: 16px;
  }
  .connect-actions {
    display: flex;
    gap: 8px;
  }

  .advanced-section {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--vc-divider);
  }

  .advanced-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    background: none;
    color: var(--vc-clay-600);
    font: inherit;
    font-size: var(--vc-text-13);
    font-weight: 500;
    cursor: pointer;
  }

  :global([data-theme='dark']) .advanced-toggle {
    color: var(--vc-clay-400);
  }
</style>
