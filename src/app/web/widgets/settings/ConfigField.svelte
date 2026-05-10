<script lang="ts">
  import InputText from '@web/components/InputText.svelte';
  import Textarea from '@web/components/Textarea.svelte';
  import Toggle from '@web/components/Toggle.svelte';
  import Slider from '@web/components/Slider.svelte';
  import Select from '@web/components/Select.svelte';
  import ConfigInputProviderGrid from './ConfigInputProviderGrid.svelte';
  import Badge from '@web/components/Badge.svelte';
  import type { ConfigFieldDescriptor } from '@lib/config/registry.js';
  import type { ConfigFieldProps } from '@app/web/types/componentProps.js';

  let { field, value, onupdate }: ConfigFieldProps = $props();

  // Stable id shared between the <label for="…"> and the underlying <input id="…">
  const inputId = $derived(`config-${field.key}`);

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

  const strNumberValue = $derived(typeof resolvedValue === 'number' ? String(resolvedValue) : '');

  const mappedSelectOptions = $derived(
    (field.options ?? []).map((opt, i) => ({
      value: opt,
      label: (field.optionLabels ?? [])[i] ?? opt,
    })),
  );
</script>

{#if field.widget === 'toggle'}
  <!-- Toggle fields render as a toggle-row (used inside .settings-toggles) -->
  <label class="toggle-row">
    <div class="toggle-row__text">
      <span class="toggle-row__t">
        {field.label}
        {#if field.secret}
          <Badge variant="clay" title="Secret">Secret</Badge>
        {/if}
      </span>
      {#if field.description}
        <span class="toggle-row__d">{field.description}</span>
      {/if}
    </div>
    <Toggle checked={Boolean(resolvedValue)} onchange={(v) => emit(v)} />
  </label>
{:else}
  <!-- All other fields render as a vc-field -->
  <div class="vc-field" class:field--secret={field.secret}>
    <label class="vc-label" for={inputId}>
      {field.label}
      {#if field.secret}
        <Badge variant="clay" title="Secret">Secret</Badge>
      {/if}
    </label>

    {#if field.description}
      <p class="vc-help">{field.description}</p>
    {/if}

    <div>
      {#if field.key === 'LLM_PROVIDER'}
        <ConfigInputProviderGrid value={String(resolvedValue ?? '')} onchange={(v) => emit(v)} />
      {:else if field.widget === 'select' && field.options}
        <Select
          id={inputId}
          value={String(resolvedValue)}
          options={mappedSelectOptions}
          onchange={(v) => emit(v)}
        />
      {:else if field.widget === 'slider'}
        <Slider
          id={inputId}
          value={typeof resolvedValue === 'number' ? resolvedValue : undefined}
          min={field.min}
          max={field.max}
          onchange={(v) => emit(v)}
        />
      {:else if field.widget === 'number'}
        <InputText
          id={inputId}
          type="number"
          value={strNumberValue}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder ?? String(field.defaultValue ?? '')}
          onchange={(raw) => {
            const n = raw === '' ? undefined : Number(raw);
            emit(n);
          }}
        />
      {:else if field.widget === 'textarea'}
        <Textarea
          id={inputId}
          value={String(resolvedValue ?? '')}
          placeholder={field.placeholder ?? ''}
          monospace={true}
          onchange={(v) => emit(v)}
        />
      {:else}
        <InputText
          id={inputId}
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
</style>
