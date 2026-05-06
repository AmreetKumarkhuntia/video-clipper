<script lang="ts">
  import {
    configRegistry,
    configValues,
    configLoaded,
    initConfig,
    updateField,
    resetToDefaults,
  } from '@web/lib/configStore.js';
  import ConfigSection from '@web/components/settings/ConfigSection.svelte';

  $effect(() => {
    void initConfig();
  });

  function handleUpdate(key: string, value: unknown): void {
    updateField(key, value);
  }

  function handleReset(): void {
    resetToDefaults();
  }
</script>

<svelte:head>
  <title>Settings — Video Clipper Workbench</title>
</svelte:head>

{#if !$configLoaded}
  <p class="settings-loading">Loading settings...</p>
{:else if $configRegistry}
  <div class="settings-head">
    <div>
      <p class="settings-eyebrow">Configuration</p>
      <h1 class="settings-title">Settings</h1>
    </div>
    <button class="vc-btn vc-btn--secondary" onclick={handleReset}> Reset to Defaults </button>
  </div>

  <div class="settings-grid">
    {#each $configRegistry.groups as group (group.id)}
      <ConfigSection {group} values={$configValues} onupdate={handleUpdate} />
    {/each}
  </div>
{/if}

<style>
  .settings-loading {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
  }

  .settings-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  .settings-eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 4px;
  }

  .settings-title {
    font-family: var(--vc-font-display);
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--vc-text);
  }

  .settings-grid {
    display: grid;
    gap: 16px;
  }
</style>
