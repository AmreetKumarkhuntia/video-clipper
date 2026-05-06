<script lang="ts">
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
    <button
      type="button"
      class="reveal-btn vc-btn vc-btn--ghost vc-btn--sm"
      onclick={() => (revealed = !revealed)}
      title={revealed ? 'Hide' : 'Reveal'}
    >
      {revealed ? 'Hide' : 'Show'}
    </button>
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

  .reveal-btn {
    position: absolute;
    right: 6px;
  }
</style>
