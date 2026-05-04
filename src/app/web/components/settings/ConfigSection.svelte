<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ConfigGroupDescriptor } from '@lib/config/registry.js';
  import ConfigField from './ConfigField.svelte';

  export let group: ConfigGroupDescriptor;
  export let values: Record<string, unknown>;

  const dispatch = createEventDispatcher<{ update: { key: string; value: unknown } }>();

  let collapsed = false;
</script>

<section class="config-section">
  <button type="button" class="section-header" on:click={() => (collapsed = !collapsed)}>
    <h2 class="section-title">{group.label}</h2>
    <span class="section-toggle" class:section-toggle--collapsed={collapsed}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </span>
  </button>

  {#if !collapsed}
    <div class="section-fields">
      {#each group.fields as field (field.key)}
        <ConfigField
          {field}
          value={values[field.key]}
          on:update={(e) => dispatch('update', e.detail)}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .config-section {
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--c-surface) 80%, white 20%);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--s-md) var(--s-lg);
    border: none;
    background: var(--c-surface-muted);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.16s ease;
  }

  .section-header:hover {
    background: var(--c-surface-strong);
  }

  .section-title {
    font-size: 16px;
    font-weight: var(--fw-bold);
    color: var(--c-text);
    margin: 0;
  }

  .section-toggle {
    display: flex;
    align-items: center;
    color: var(--c-text-muted);
    transition: transform 0.2s ease;
  }

  .section-toggle--collapsed {
    transform: rotate(-90deg);
  }

  .section-fields {
    display: grid;
    gap: var(--s-lg);
    padding: var(--s-lg);
  }
</style>
