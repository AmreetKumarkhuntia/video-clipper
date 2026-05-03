<script lang="ts">
  import { appName } from '$lib/index.js';
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
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    background: #f7f7f5;
    color: #1e2320;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }

  :global(button),
  :global(input) {
    font: inherit;
  }

  :global(button) {
    cursor: pointer;
  }

  :global(a) {
    color: inherit;
    text-decoration: none;
  }

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
    gap: 24px;
    height: 64px;
    padding: 0 28px;
    border-bottom: 1px solid #ddded9;
    background: rgba(247, 247, 245, 0.94);
    backdrop-filter: blur(16px);
  }

  .brand {
    font-size: 15px;
    font-weight: 760;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 18px;
    color: #5d645e;
    font-size: 14px;
  }

  main {
    width: min(1240px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 56px;
  }

  @media (max-width: 720px) {
    .topbar {
      padding: 0 16px;
    }

    main {
      width: min(100vw - 24px, 1240px);
      padding-top: 20px;
    }
  }
</style>
