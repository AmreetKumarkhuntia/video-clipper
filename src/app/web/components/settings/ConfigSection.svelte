<script lang="ts">
  import type { ConfigGroupDescriptor } from '@lib/config/registry.js';
  import ConfigField from './ConfigField.svelte';

  interface Props {
    group: ConfigGroupDescriptor;
    values: Record<string, unknown>;
    onupdate?: (key: string, value: unknown) => void;
  }

  let { group, values, onupdate }: Props = $props();

  let collapsed = $state(false);
</script>

<section class="config-section">
  <button type="button" class="section-header" onclick={() => (collapsed = !collapsed)}>
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
          onupdate={(key, value) => onupdate?.(key, value)}
        />
      {/each}
    </div>
  {/if}
</section>

<style>
  .config-section {
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-lg);
    background: color-mix(in srgb, var(--vc-surface) 80%, white 20%);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--vc-space-4) var(--vc-space-5);
    border: none;
    background: var(--vc-surface-2);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.16s ease;
  }

  .section-header:hover {
    background: var(--vc-surface-2);
    filter: brightness(0.97);
  }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--vc-text);
    margin: 0;
  }

  .section-toggle {
    display: flex;
    align-items: center;
    color: var(--vc-text-muted);
    transition: transform 0.2s ease;
  }

  .section-toggle--collapsed {
    transform: rotate(-90deg);
  }

  .section-fields {
    display: grid;
    gap: var(--vc-space-5);
    padding: var(--vc-space-5);
  }
</style>
