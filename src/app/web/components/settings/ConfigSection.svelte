<script lang="ts">
  import type { ConfigGroupDescriptor } from '@lib/config/registry.js';
  import type { SectionConfig } from './groupConfig.js';
  import ConfigField from './ConfigField.svelte';

  interface Props {
    group: ConfigGroupDescriptor;
    values: Record<string, unknown>;
    sections?: SectionConfig[];
    onupdate?: (key: string, value: unknown) => void;
  }

  let { group, values, sections, onupdate }: Props = $props();

  // Build a lookup from field key → descriptor for fast resolution inside sections.
  let fieldMap = $derived(Object.fromEntries(group.fields.map((f) => [f.key, f])));

  // Flat fallback: split all group fields by widget type.
  let flatRegular = $derived(group.fields.filter((f) => f.widget !== 'toggle'));
  let flatToggles = $derived(group.fields.filter((f) => f.widget === 'toggle'));
</script>

{#if sections && sections.length > 0}
  {#each sections as section (section.h3)}
    {@const sectionFields = section.fields.map((k) => fieldMap[k]).filter(Boolean)}
    {@const regular = sectionFields.filter((f) => f.widget !== 'toggle')}
    {@const toggles = sectionFields.filter((f) => f.widget === 'toggle')}

    <div class="settings-section">
      <div class="settings-section__h">
        <h3>{section.h3}</h3>
        {#if section.meta}
          <span class="meta">{section.meta}</span>
        {/if}
      </div>

      {#if regular.length > 0}
        <div class="settings-form" class:settings-form--two={section.layout === 'two'}>
          {#each regular as field (field.key)}
            <ConfigField {field} value={values[field.key]} onupdate={(k, v) => onupdate?.(k, v)} />
          {/each}
        </div>
      {/if}

      {#if toggles.length > 0}
        <div class="settings-toggles">
          {#each toggles as field (field.key)}
            <ConfigField {field} value={values[field.key]} onupdate={(k, v) => onupdate?.(k, v)} />
          {/each}
        </div>
      {/if}
    </div>
  {/each}
{:else}
  <!-- Flat fallback for groups without a sections config -->
  {#if flatRegular.length > 0}
    <div class="settings-form">
      {#each flatRegular as field (field.key)}
        <ConfigField {field} value={values[field.key]} onupdate={(k, v) => onupdate?.(k, v)} />
      {/each}
    </div>
  {/if}

  {#if flatToggles.length > 0}
    <div class="settings-toggles">
      {#each flatToggles as field (field.key)}
        <ConfigField {field} value={values[field.key]} onupdate={(k, v) => onupdate?.(k, v)} />
      {/each}
    </div>
  {/if}
{/if}
