<script lang="ts">
  import type { TimecodeInputProps } from '@app/web/types/componentProps.js';
  import { formatTimecode, parseTimecode } from '@web/lib/format.js';

  let { id, valueSec, disabled = false, onchange }: TimecodeInputProps = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let draft = $state('');
  let invalid = $state(false);

  $effect(() => {
    const formatted = formatTimecode(valueSec);
    if (document.activeElement !== inputEl && draft !== formatted) {
      draft = formatted;
    }
  });

  function commit(): void {
    const parsed = parseTimecode(draft);
    if (parsed === null) {
      invalid = true;
      draft = formatTimecode(valueSec);
      invalid = false;
      return;
    }
    invalid = false;
    if (parsed !== valueSec) onchange(parsed);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    }
  }
</script>

<input
  bind:this={inputEl}
  {id}
  type="text"
  class="vc-input ce-mono-input"
  class:is-invalid={invalid}
  {disabled}
  bind:value={draft}
  onblur={commit}
  onkeydown={handleKeydown}
  inputmode="numeric"
  spellcheck="false"
  autocomplete="off"
/>

<style>
  .is-invalid {
    border-color: var(--vc-error);
  }
</style>
