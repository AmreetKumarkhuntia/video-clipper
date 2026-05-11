<script lang="ts">
  import {
    configRegistry,
    configValues,
    configLoaded,
    initConfig,
    updateField,
    resetToDefaults,
  } from '@web/lib/stores/config.js';
  import ConfigSection from '@web/widgets/settings/ConfigSection.svelte';
  import Icon from '@web/components/Icon.svelte';
  import { GROUP_CONFIG } from '@web/widgets/settings/groupConfig.js';
  import Button from '@web/components/Button.svelte';

  $effect(() => {
    void initConfig();
  });

  let activeGroupId = $state<string | null>(null);

  let activeGroup = $derived.by(() => {
    if (!$configRegistry) return null;
    const groups = $configRegistry.groups;
    if (!groups.length) return null;
    return groups.find((g) => g.id === activeGroupId) ?? groups[0];
  });

  let activeGroupConfig = $derived(activeGroup ? GROUP_CONFIG[activeGroup.id] : undefined);

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
  <div class="settings-shell">
    <nav class="settings-nav">
      <p class="settings-nav__h">Configuration</p>
      {#each $configRegistry.groups as group (group.id)}
        <button
          type="button"
          class="settings-nav__item"
          class:is-active={group.id === activeGroup?.id}
          onclick={() => (activeGroupId = group.id)}
        >
          {#if GROUP_CONFIG[group.id]}
            <Icon name={GROUP_CONFIG[group.id].icon} size={16} />
          {/if}
          {group.label}
        </button>
      {/each}
    </nav>

    <main class="settings-main">
      {#if activeGroup}
        <div class="settings-head">
          <h2>{activeGroup.label}</h2>
          {#if activeGroupConfig?.subtitle}
            <p class="settings-head__sub">{activeGroupConfig.subtitle}</p>
          {/if}
        </div>

        <ConfigSection
          group={activeGroup}
          values={$configValues}
          sections={activeGroupConfig?.sections}
          onupdate={handleUpdate}
        />

        <div class="settings-foot">
          <span class="meta">Changes are saved automatically.</span>
          <Button variant="ghost" onclick={handleReset}>Reset to defaults</Button>
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  .settings-loading {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    padding: 40px 56px;
  }
</style>
