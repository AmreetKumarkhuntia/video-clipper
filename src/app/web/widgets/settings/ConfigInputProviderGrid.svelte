<script lang="ts">
  import Icon from '@web/components/Icon.svelte';
  import Badge from '@web/components/Badge.svelte';
  import Button from '@web/components/Button.svelte';
  import type { ConfigInputProviderGridProps, ProviderDef } from '@app/web/types/componentProps.js';

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

  let { value, onchange }: ConfigInputProviderGridProps = $props();
</script>

<div class="provider-grid">
  {#each PROVIDERS as p (p.key)}
    <Button
      variant="ghost"
      class={`provider${value === p.key ? ' is-active' : ''}`}
      onclick={() => onchange?.(p.key)}
    >
      <div class="provider__head">
        <span class="provider__name">{p.name}</span>
        {#if p.badge}
          <Badge variant="clay">{p.badge}</Badge>
        {/if}
      </div>
      <div class="provider__model">{p.defaultModel}</div>
      {#if value === p.key}
        <div class="provider__check">
          <Icon name="check" size={14} />
        </div>
      {/if}
    </Button>
  {/each}
</div>
