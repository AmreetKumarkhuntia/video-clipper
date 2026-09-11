<script lang="ts">
  import {
    configRegistry,
    configValues,
    configLoaded,
    initConfig,
    updateField,
    resetToDefaults,
    setConfigWritable,
  } from '@web/lib/stores/config.js';
  import ConfigSection from '@web/widgets/settings/ConfigSection.svelte';
  import Icon from '@web/components/Icon.svelte';
  import { GROUP_CONFIG } from '@web/widgets/settings/groupConfig.js';
  import Button from '@web/components/Button.svelte';
  import { page } from '$app/stores';

  $effect(() => {
    void initConfig();
  });

  // Reading is open to any signed-in account; saving needs `settings:write`.
  // The backend enforces it — this only explains the 403 before it happens.
  let canWrite = $derived($page.data.customer?.permissions.includes('settings:write') ?? false);

  $effect(() => {
    setConfigWritable(canWrite);
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
    if (!canWrite) return;
    updateField(key, value);
  }

  function handleReset(): void {
    if (!canWrite) return;
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
        <Button
          variant="ghost"
          class={`settings-nav__item${group.id === activeGroup?.id ? ' is-active' : ''}`}
          onclick={() => (activeGroupId = group.id)}
        >
          {#if GROUP_CONFIG[group.id]}
            <Icon name={GROUP_CONFIG[group.id].icon} size={16} />
          {/if}
          {group.label}
        </Button>
      {/each}
    </nav>

    <main class="settings-main">
      {#if !canWrite}
        <p class="settings-readonly" role="status">
          Settings are read-only for your account. An admin can change them.
        </p>
      {/if}
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
          disabled={!canWrite}
          onupdate={handleUpdate}
        />

        <div class="settings-foot">
          <span class="meta">
            {canWrite ? 'Changes are saved automatically.' : 'No changes can be made.'}
          </span>
          <Button variant="ghost" disabled={!canWrite} onclick={handleReset}
            >Reset to defaults</Button
          >
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  .settings-readonly {
    margin: 0 0 16px;
    padding: 10px 14px;
    border: 1px solid var(--vc-border);
    border-radius: 8px;
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
  }
  .settings-loading {
    font-size: var(--vc-text-14);
    color: var(--vc-text-muted);
    padding: 40px 56px;
  }
</style>
