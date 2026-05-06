<script lang="ts">
  import Icon from '../Icon.svelte';

  interface ProviderDef {
    key: string;
    name: string;
    defaultModel: string;
    badge?: string;
  }

  const PROVIDERS: ProviderDef[] = [
    { key: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini', badge: 'default' },
    { key: 'anthropic', name: 'Anthropic', defaultModel: 'claude-haiku-4-5', badge: 'fastest' },
    { key: 'google', name: 'Google', defaultModel: 'gemini-2.5-flash' },
    { key: 'xai', name: 'xAI', defaultModel: 'grok-2-1212' },
    { key: 'mistral', name: 'Mistral', defaultModel: 'mistral-small' },
    { key: 'groq', name: 'Groq', defaultModel: 'llama-3.1-8b-instant', badge: 'free' },
    { key: 'zai', name: 'Zai', defaultModel: 'glm-4-flashx' },
    { key: 'openrouter', name: 'OpenRouter', defaultModel: 'auto' },
    { key: 'custom', name: 'Custom', defaultModel: 'custom endpoint' },
  ];

  interface Props {
    value: string;
    onchange?: (value: string) => void;
  }

  let { value, onchange }: Props = $props();
</script>

<div class="provider-grid">
  {#each PROVIDERS as p (p.key)}
    <button
      type="button"
      class="provider"
      class:is-active={value === p.key}
      onclick={() => onchange?.(p.key)}
    >
      <div class="provider__head">
        <span class="provider__name">{p.name}</span>
        {#if p.badge}
          <span class="vc-badge vc-badge--clay">{p.badge}</span>
        {/if}
      </div>
      <div class="provider__model">{p.defaultModel}</div>
      {#if value === p.key}
        <div class="provider__check">
          <Icon name="check" size={14} />
        </div>
      {/if}
    </button>
  {/each}
</div>
