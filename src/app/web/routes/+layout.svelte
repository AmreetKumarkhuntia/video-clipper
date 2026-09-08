<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { theme } from '@web/lib/stores/theme.js';
  import Toaster from '@web/components/Toaster.svelte';
  import Icon from '@web/components/Icon.svelte';
  import Button from '@web/components/Button.svelte';
  import '../style/index.css';

  // Read from the store rather than $props() so this component keeps using
  // <slot />; mixing runes with <slot /> is an error in Svelte 5.
  $: customer = $page.data.customer ?? null;
  $: channelTitle = $page.data.channelTitle ?? null;
  $: isSignedIn = Boolean(customer);
  $: pathname = $page.url.pathname;

  function toggleTheme() {
    theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    // Both are needed: invalidateAll drops the cached customer, goto leaves a
    // page the guard would now bounce.
    await invalidateAll();
    await goto('/login');
  }
</script>

<svelte:head>
  <title>Video Clipper</title>
  <meta
    name="description"
    content="Local YouTube transcript analysis and clip generation workbench"
  />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div class="topbar__brand">
      <a href="/" class="vc-wordmark">
        Video<span class="vc-wordmark__accent">Clipper</span><span class="vc-wordmark__dot"></span>
      </a>
    </div>

    {#if isSignedIn}
      <nav class="topbar__nav" aria-label="Primary navigation">
        <a href="/" class="topbar__nav-link" class:is-active={pathname === '/'}>My videos</a>
        <a href="/browse" class="topbar__nav-link" class:is-active={pathname.startsWith('/browse')}
          ><Icon name="search" size={14} /> Browse</a
        >
        <a
          href="/settings"
          class="topbar__nav-link"
          class:is-active={pathname.startsWith('/settings')}
          ><Icon name="settings" size={14} /> Settings</a
        >
      </nav>
    {:else}
      <div class="topbar__nav"></div>
    {/if}

    <div class="topbar__actions">
      {#if channelTitle}
        <span class="topbar__chip" title="Linked YouTube channel">
          <Icon name="youtube" size={13} />
          {channelTitle}
        </span>
      {/if}
      <Button variant="ghost" size="icon" aria-label="Toggle theme" onclick={toggleTheme}>
        {#if $theme === 'dark'}
          <Icon name="sun" />
        {:else}
          <Icon name="moon" />
        {/if}
      </Button>
      {#if isSignedIn}
        <Button variant="ghost" size="sm" onclick={signOut}>Sign out</Button>
      {/if}
    </div>
  </header>

  <div class="app-content">
    <slot />
  </div>

  <Toaster />
</div>

<style>
  .topbar__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 22ch;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
