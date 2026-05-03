<script lang="ts">
  import { appName } from '$lib/index.js';
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
    padding: 0 28px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(247, 247, 245, 0.94);
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
    width: min(1240px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 56px;
  }

  @media (max-width: 720px) {
    .topbar {
      padding: 0 var(--s-md);
    }

    main {
      width: min(100vw - 24px, 1240px);
      padding-top: 20px;
    }
  }
</style>
