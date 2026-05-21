<script lang="ts">
  import type { ToggleRowProps } from '@app/web/types/componentProps.js';
  import Toggle from '@web/components/Toggle.svelte';

  let {
    title,
    titleContent,
    description,
    checked,
    ariaLabel,
    onchange,
    class: extraClass,
  }: ToggleRowProps = $props();
</script>

<label class={['toggle-row', extraClass].filter(Boolean).join(' ')}>
  <div class="toggle-row__text">
    <span class="toggle-row__t">
      {#if titleContent}{@render titleContent()}{:else}{title ?? ''}{/if}
    </span>
    {#if description}<span class="toggle-row__d">{description}</span>{/if}
  </div>
  <Toggle {checked} {ariaLabel} {onchange} />
</label>
