<script lang="ts">
  import type { ConfigFieldDescriptor } from '@lib/config/registry.js';
  import ConfigInputText from './ConfigInputText.svelte';
  import ConfigInputTextarea from './ConfigInputTextarea.svelte';
  import ConfigInputNumber from './ConfigInputNumber.svelte';
  import ConfigInputToggle from './ConfigInputToggle.svelte';
  import ConfigInputSelect from './ConfigInputSelect.svelte';
  import ConfigInputSlider from './ConfigInputSlider.svelte';

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

<div class="field" class:field--secret={field.secret}>
  <div class="field-header">
    <label class="field-label" for="config-{field.key}">
      {field.label}
      {#if field.secret}
        <span class="field-badge" title="Secret">Secret</span>
      {/if}
    </label>
  </div>

  {#if field.description}
    <p class="field-desc">{field.description}</p>
  {/if}

  <div class="field-widget">
    {#if field.widget === 'select' && field.options}
      <ConfigInputSelect
        value={String(resolvedValue)}
        options={field.options}
        optionLabels={field.optionLabels ?? []}
        onchange={(v) => emit(v)}
      />
    {:else if field.widget === 'toggle'}
      <ConfigInputToggle value={Boolean(resolvedValue)} onchange={(v) => emit(v)} />
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
    <p class="field-default">Default: {JSON.stringify(field.defaultValue)}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 4px;
  }

  .field--secret {
    background: color-mix(in srgb, var(--vc-surface-2) 50%, transparent);
    border-radius: var(--vc-radius-md);
    padding: var(--vc-space-3);
    margin: calc(-1 * var(--vc-space-3));
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: var(--vc-space-2);
  }

  .field-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--vc-text);
    display: flex;
    align-items: center;
    gap: var(--vc-space-2);
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
  }

  .field-desc {
    font-size: 13px;
    color: var(--vc-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .field-widget {
    margin-top: 4px;
  }

  .field-default {
    font-size: 12px;
    color: var(--vc-text-muted);
    margin: 2px 0 0;
  }
</style>
