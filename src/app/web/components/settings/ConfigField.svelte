<script lang="ts">
  import type { ConfigFieldDescriptor } from '@lib/config/registry.js';
  import ConfigInputText from './ConfigInputText.svelte';
  import ConfigInputTextarea from './ConfigInputTextarea.svelte';
  import ConfigInputNumber from './ConfigInputNumber.svelte';
  import ConfigInputToggle from './ConfigInputToggle.svelte';
  import ConfigInputSelect from './ConfigInputSelect.svelte';
  import ConfigInputSlider from './ConfigInputSlider.svelte';
  import ConfigInputProviderGrid from './ConfigInputProviderGrid.svelte';

  interface Props {
    field: ConfigFieldDescriptor;
    value: unknown;
    onupdate?: (key: string, value: unknown) => void;
  }

  let { field, value, onupdate }: Props = $props();

  let resolvedValue = $derived(resolveValue(value, field));

  function resolveValue(val: unknown, f: ConfigFieldDescriptor): unknown {
    if (val !== undefined && val !== null && typeof val !== 'object') return val;
    if (val && typeof val === 'object' && 'hasValue' in (val as Record<string, unknown>)) {
      return '';
    }
    return f.defaultValue ?? '';
  }

  function emit(newValue: unknown): void {
    onupdate?.(field.key, newValue);
  }
</script>

{#if field.widget === 'toggle'}
  <!-- Toggle fields render as a toggle-row (used inside .settings-toggles) -->
  <label class="toggle-row">
    <div class="toggle-row__text">
      <span class="toggle-row__t">
        {field.label}
        {#if field.secret}
          <span class="field-badge" title="Secret">Secret</span>
        {/if}
      </span>
      {#if field.description}
        <span class="toggle-row__d">{field.description}</span>
      {/if}
    </div>
    <ConfigInputToggle value={Boolean(resolvedValue)} onchange={(v) => emit(v)} />
  </label>
{:else}
  <!-- All other fields render as a vc-field -->
  <div class="vc-field" class:field--secret={field.secret}>
    <label class="vc-label" for="config-{field.key}">
      {field.label}
      {#if field.secret}
        <span class="field-badge" title="Secret">Secret</span>
      {/if}
    </label>

    {#if field.description}
      <p class="vc-help">{field.description}</p>
    {/if}

    <div>
      {#if field.key === 'LLM_PROVIDER'}
        <ConfigInputProviderGrid value={String(resolvedValue ?? '')} onchange={(v) => emit(v)} />
      {:else if field.widget === 'select' && field.options}
        <ConfigInputSelect
          value={String(resolvedValue)}
          options={field.options}
          optionLabels={field.optionLabels ?? []}
          onchange={(v) => emit(v)}
        />
      {:else if field.widget === 'slider'}
        <ConfigInputSlider
          value={typeof resolvedValue === 'number' ? resolvedValue : undefined}
          min={field.min}
          max={field.max}
          onchange={(v) => emit(v)}
        />
      {:else if field.widget === 'number'}
        <ConfigInputNumber
          value={typeof resolvedValue === 'number' ? resolvedValue : undefined}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
          onchange={(v) => emit(v)}
        />
      {:else if field.widget === 'textarea'}
        <ConfigInputTextarea
          value={String(resolvedValue ?? '')}
          placeholder={field.placeholder ?? ''}
          onchange={(v) => emit(v)}
        />
      {:else}
        <ConfigInputText
          value={String(resolvedValue ?? '')}
          secret={field.secret}
          placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
          onchange={(v) => emit(v)}
        />
      {/if}
    </div>

    {#if field.defaultValue !== undefined}
      <p class="vc-help">Default: {JSON.stringify(field.defaultValue)}</p>
    {/if}
  </div>
{/if}

<style>
  .field--secret {
    background: color-mix(in srgb, var(--vc-surface-2) 50%, transparent);
    border-radius: var(--vc-radius-md);
    padding: var(--vc-space-3);
    margin: calc(-1 * var(--vc-space-3));
  }

  .toggle-row__text {
    display: flex;
    flex-direction: column;
  }

  .field-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--vc-radius-sm);
    background: var(--vc-clay-soft);
    color: var(--vc-clay-500);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    vertical-align: middle;
    margin-left: var(--vc-space-2);
  }
</style>
