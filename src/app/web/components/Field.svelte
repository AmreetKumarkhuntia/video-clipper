<script lang="ts">
  import type { FieldProps } from '@app/web/types/componentProps.js';

  let {
    label,
    for: htmlFor,
    help,
    error,
    required = false,
    class: extraClass = '',
    children,
  }: FieldProps = $props();

  const classes = $derived(
    ['vc-field', error ? 'vc-field--error' : '', extraClass].filter(Boolean).join(' '),
  );
</script>

<div class={classes}>
  {#if label}
    <label class="vc-label" for={htmlFor}>
      {label}{#if required}<span class="required" aria-hidden="true"> *</span>{/if}
    </label>
  {/if}
  {@render children()}
  {#if error}
    <p class="vc-field__error" role="alert">{error}</p>
  {:else if help}
    <p class="vc-help">{help}</p>
  {/if}
</div>

<style>
  .required {
    color: var(--vc-error);
    margin-left: 2px;
  }
</style>
