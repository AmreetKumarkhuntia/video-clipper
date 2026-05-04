<script lang="ts">
  import { appName } from '@web/lib/index.js';
  import '../style/index.css';
</script>

<svelte:head>
  <title>{appName}</title>
  <meta
    name="description"
    content="Local YouTube transcript analysis and clip generation workbench"
  />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="/">{appName}</a>
    <nav aria-label="Primary navigation">
      <a href="/">Channels</a>
    </nav>
  </header>
  <main>
    <slot />
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-lg);
    height: 64px;
    width: min(var(--layout-max), calc(100vw - 32px));
    margin: 0 auto;
    padding: 0 6px;
    border-bottom: 1px solid var(--c-border);
    background: color-mix(in srgb, var(--c-bg) 90%, white 10%);
    backdrop-filter: blur(16px);
  }

  .brand {
    font-size: 15px;
    font-weight: var(--fw-semibold);
  }

  nav {
    display: flex;
    align-items: center;
    gap: 18px;
    color: var(--c-text-muted);
    font-size: 14px;
  }

  main {
    width: min(var(--layout-max), calc(100vw - 32px));
    margin: 0 auto;
    padding: 32px 0 64px;
  }

  @media (max-width: 720px) {
    .topbar {
      width: min(100vw - 24px, var(--layout-max));
      padding: 0;
    }

    main {
      width: min(100vw - 24px, var(--layout-max));
      padding-top: 20px;
    }
  }
</style>
