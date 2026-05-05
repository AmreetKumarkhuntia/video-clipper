<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ConfigFieldDescriptor } from '@lib/config/registry.js';
  import ConfigInputText from './ConfigInputText.svelte';
  import ConfigInputTextarea from './ConfigInputTextarea.svelte';
  import ConfigInputNumber from './ConfigInputNumber.svelte';
  import ConfigInputToggle from './ConfigInputToggle.svelte';
  import ConfigInputSelect from './ConfigInputSelect.svelte';
  import ConfigInputSlider from './ConfigInputSlider.svelte';

  export let field: ConfigFieldDescriptor;
  export let value: unknown;

  const dispatch = createEventDispatcher<{ update: { key: string; value: unknown } }>();

  function emit(newValue: unknown): void {
    dispatch('update', { key: field.key, value: newValue });
  }

  $: resolvedValue = resolveValue(value, field);

  function resolveValue(val: unknown, f: ConfigFieldDescriptor): unknown {
    if (val !== undefined && val !== null && typeof val !== 'object') return val;
    if (val && typeof val === 'object' && 'hasValue' in (val as Record<string, unknown>)) {
      return '';
    }
    return f.defaultValue ?? '';
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
        on:change={(e) => emit(e.detail)}
      />
    {:else if field.widget === 'toggle'}
      <ConfigInputToggle value={Boolean(resolvedValue)} on:change={(e) => emit(e.detail)} />
    {:else if field.widget === 'slider'}
      <ConfigInputSlider
        value={typeof resolvedValue === 'number' ? resolvedValue : undefined}
        min={field.min}
        max={field.max}
        on:change={(e) => emit(e.detail)}
      />
    {:else if field.widget === 'number'}
      <ConfigInputNumber
        value={typeof resolvedValue === 'number' ? resolvedValue : undefined}
        min={field.min}
        max={field.max}
        placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
        on:change={(e) => emit(e.detail)}
      />
    {:else if field.widget === 'textarea'}
      <ConfigInputTextarea
        value={String(resolvedValue ?? '')}
        placeholder={field.placeholder ?? ''}
        on:change={(e) => emit(e.detail)}
      />
    {:else}
      <ConfigInputText
        value={String(resolvedValue ?? '')}
        secret={field.secret}
        placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
        on:change={(e) => emit(e.detail)}
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
    background: color-mix(in srgb, var(--c-surface-muted) 50%, transparent);
    border-radius: var(--r-md);
    padding: var(--s-sm);
    margin: calc(-1 * var(--s-sm));
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: var(--s-xs);
  }

  .field-label {
    font-size: 14px;
    font-weight: var(--fw-semibold);
    color: var(--c-text);
    display: flex;
    align-items: center;
    gap: var(--s-xs);
  }

  .field-badge {
    font-size: 10px;
    font-weight: var(--fw-semibold);
    padding: 1px 6px;
    border-radius: var(--r-sm);
    background: var(--c-accent-soft);
    color: var(--c-accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field-desc {
    font-size: 13px;
    color: var(--c-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .field-widget {
    margin-top: 4px;
  }

  .field-default {
    font-size: 12px;
    color: var(--c-text-muted);
    margin: 2px 0 0;
  }
</style>
