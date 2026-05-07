<script lang="ts">
  import type { TextareaProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(''),
    rows,
    placeholder = '',
    disabled = false,
    monospace = false,
    error = false,
    class: extraClass = '',
    oninput,
    onchange,
  }: TextareaProps = $props();

  const classes = $derived(
    [
      'vc-textarea',
      monospace ? 'vc-textarea--mono' : '',
      error ? 'vc-textarea--error' : '',
      extraClass,
    ]
      .filter(Boolean)
      .join(' '),
  );

  function handleInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    oninput?.(target.value);
  }

  function handleChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    onchange?.(target.value);
  }
</script>

<textarea
  {id}
  {rows}
  {placeholder}
  {disabled}
  class={classes}
  oninput={handleInput}
  onchange={handleChange}
  bind:value
></textarea>
