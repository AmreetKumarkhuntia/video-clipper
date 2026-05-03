<script lang="ts">
  import type { ChannelSummary } from '../../types/index.js';

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
      const response = await fetch(
        `/api/youtube/channels/resolve?input=${encodeURIComponent(channelInput.trim())}`,
      );
      const body: unknown = await response.json();

      if (!response.ok) {
        errorMessage = readApiError(body);
        return;
      }

      resolvedChannel = body as ChannelSummary;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
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

<section class="workspace">
  <div class="heading">
    <p>Local YouTube clipping workbench</p>
    <h1>Choose a channel to start finding clip-worthy videos.</h1>
  </div>

  <form class="channel-form" on:submit|preventDefault={resolveChannel}>
    <input
      bind:value={channelInput}
      aria-label="YouTube channel"
      placeholder="@GoogleDevelopers, UC..., or channel URL"
    />
    <button type="submit" disabled={isLoading}>{isLoading ? 'Resolving...' : 'Resolve'}</button>
  </form>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if resolvedChannel}
    <article class="channel-result">
      {#if resolvedChannel.thumbnail}
        <img src={resolvedChannel.thumbnail.url} alt="" />
      {/if}
      <div>
        <p class="eyebrow">Channel found</p>
        <h2>{resolvedChannel.title}</h2>
        <p>{resolvedChannel.description}</p>
        <a class="button-link" href={`/channels/${resolvedChannel.id}`}>Browse videos</a>
      </div>
    </article>
  {/if}
</section>

<style>
  .workspace {
    display: grid;
    gap: 24px;
    max-width: 820px;
    padding-top: 44px;
  }

  .heading {
    display: grid;
    gap: 10px;
  }

  .heading p,
  .eyebrow {
    margin: 0;
    color: #6c716a;
    font-size: 13px;
    font-weight: 680;
    text-transform: uppercase;
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
    gap: 10px;
    width: min(100%, 760px);
  }

  input {
    min-width: 0;
    height: 48px;
    padding: 0 16px;
    border: 1px solid #cfd1cb;
    border-radius: 8px;
    background: #ffffff;
    color: #20251f;
  }

  button,
  .button-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 18px;
    border: 0;
    border-radius: 8px;
    background: #20251f;
    color: #ffffff;
    font-weight: 720;
  }

  button:disabled {
    opacity: 0.62;
  }

  .error {
    margin: 0;
    color: #ad3131;
  }

  .channel-result {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 18px;
    align-items: start;
    padding: 18px 0;
    border-top: 1px solid #ddded9;
  }

  .channel-result img {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
  }

  .channel-result h2 {
    margin: 4px 0 8px;
    font-size: 24px;
  }

  .channel-result p:not(.eyebrow) {
    display: -webkit-box;
    max-width: 680px;
    margin: 0 0 16px;
    overflow: hidden;
    color: #626861;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  @media (max-width: 620px) {
    .channel-form,
    .channel-result {
      grid-template-columns: 1fr;
    }

    .channel-result img {
      width: 72px;
      height: 72px;
    }
  }
</style>
