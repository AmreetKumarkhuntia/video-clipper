<script lang="ts">
  import { page } from '$app/stores';
  import { theme } from '@web/lib/stores/theme.js';
  import Toaster from '@web/components/Toaster.svelte';
  import Icon from '@web/components/Icon.svelte';
  import '../style/index.css';

  function toggleTheme() {
    theme.update((t) => (t === 'light' ? 'dark' : 'light'));
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

    <nav class="topbar__nav" aria-label="Primary navigation">
      <a href="/" class="topbar__nav-link" class:is-active={$page.url.pathname === '/'}>Channels</a>
      <a
        href="/settings"
        class="topbar__nav-link"
        class:is-active={$page.url.pathname.startsWith('/settings')}
        ><Icon name="settings" size={14} /> Settings</a
      >
    </nav>

    <div class="topbar__actions">
      <button
        class="vc-btn vc-btn--ghost vc-btn--icon"
        aria-label="Toggle theme"
        onclick={toggleTheme}
      >
        {#if $theme === 'dark'}
          <Icon name="sun" />
        {:else}
          <Icon name="moon" />
        {/if}
      </button>
    </div>
  </header>

  <div class="app-content">
    <slot />
  </div>

  <Toaster />
</div>
