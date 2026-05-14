<script lang="ts">
  import type { PanelHeaderProps } from '@app/web/types/componentProps.js';

  let { text, hint, class: extraClass = '' }: PanelHeaderProps = $props();

  const classes = $derived(['ce-panel-h', extraClass].filter(Boolean).join(' '));
</script>

<div class={classes}>
  <span>{text}</span>
  {#if hint}
    <span class="ce-panel-h__hint">{hint}</span>
  {/if}
</div>
