<script lang="ts">
  import { page } from '$app/stores';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';

  let errorMessage = $derived($page.url.searchParams.get('error') ?? '');
  let returnTo = $derived($page.url.searchParams.get('returnTo') ?? '/');
  let startHref = $derived(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
</script>

<svelte:head><title>Sign in · Video Clipper</title></svelte:head>

<main class="main main--empty">
  <div class="empty">
    <div class="empty__glyph"><Icon name="youtube" size={28} /></div>
    <h1 class="empty__title">Sign in to Video Clipper</h1>
    <p class="empty__lede">
      Use the Google account that owns your YouTube channel. We link your channel once, then you
      pick the videos you want to work on.
    </p>

    {#if errorMessage}
      <p class="error-text login__error" role="alert">{errorMessage}</p>
    {/if}

    <div class="login__action">
      <Button variant="primary" size="lg" href={startHref}>Continue with Google</Button>
    </div>

    <p class="empty__hint muted">
      We ask only to read your channel. Permission to upload is requested later, when you publish.
    </p>
  </div>
</main>

<style>
  .login__action {
    margin: 20px 0 14px;
  }
  .login__error {
    max-width: 46ch;
    margin: 4px auto 0;
  }
  .empty__hint {
    max-width: 44ch;
    margin: 0 auto;
    font-size: 13px;
  }
</style>
