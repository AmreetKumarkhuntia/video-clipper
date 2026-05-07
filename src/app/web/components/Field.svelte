<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    for?: string;
    help?: string;
    error?: string;
    required?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    label,
    for: htmlFor,
    help,
    error,
    required = false,
    class: extraClass = '',
    children,
  }: Props = $props();

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
