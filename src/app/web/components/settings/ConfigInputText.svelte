<script lang="ts">
  import Button from '@web/components/Button.svelte';

  interface Props {
    value?: string;
    secret?: boolean;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    secret = false,
    placeholder = '',
    disabled = false,
    onchange,
  }: Props = $props();

  let revealed = $state(false);
  let type = $derived(secret && !revealed ? 'password' : 'text');

  function handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<div class="text-wrap">
  <input
    {type}
    {placeholder}
    {disabled}
    class="vc-input"
    class:vc-input--has-action={secret}
    oninput={handleInput}
    bind:value
  />
  {#if secret}
    <Button
      variant="ghost"
      size="sm"
      class="reveal-btn"
      onclick={() => (revealed = !revealed)}
      title={revealed ? 'Hide' : 'Reveal'}
    >
      {revealed ? 'Hide' : 'Show'}
    </Button>
  {/if}
</div>

<style>
  .text-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .text-wrap .vc-input {
    flex: 1;
  }

  .vc-input--has-action {
    padding-right: 68px;
  }

  .text-wrap :global(.reveal-btn) {
    position: absolute;
    right: 6px;
  }
</style>
