<script lang="ts">
  import { onMount } from 'svelte';
  import {
    configRegistry,
    configValues,
    configLoaded,
    initConfig,
    updateField,
    resetToDefaults,
  } from '@web/lib/configStore.js';
  import PageHead from '@web/components/PageHead.svelte';
  import Button from '@web/components/Button.svelte';
  import MutedText from '@web/components/MutedText.svelte';
  import ConfigSection from '@web/components/settings/ConfigSection.svelte';

  onMount(() => {
    void initConfig();
  });

  function handleUpdate(event: CustomEvent<{ key: string; value: unknown }>): void {
    updateField(event.detail.key, event.detail.value);
  }

  function handleReset(): void {
    resetToDefaults();
  }
</script>

<svelte:head>
  <title>Settings — Video Clipper Workbench</title>
</svelte:head>

{#if !$configLoaded}
  <MutedText>Loading settings...</MutedText>
{:else if $configRegistry}
  <PageHead eyebrow="Configuration" heading="Settings">
    <div class="header-actions" slot="action">
      <Button variant="outline" on:click={handleReset}>Reset to Defaults</Button>
    </div>
  </PageHead>

  <div class="settings-grid">
    {#each $configRegistry.groups as group (group.id)}
      <ConfigSection {group} values={$configValues} on:update={handleUpdate} />
    {/each}
  </div>
{/if}

<style>
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--s-md);
  }

  .settings-grid {
    display: grid;
    gap: var(--s-lg);
    margin-top: var(--s-lg);
  }
</style>
