<script lang="ts">
  import type { CaptionPresetProps } from '@app/web/types/componentProps.js';

  let { id, label, active, onclick }: CaptionPresetProps = $props();
</script>

<button type="button" class="ce-preset ce-preset--{id}" class:is-active={active} {onclick}>
  {#if id === 'karaoke'}
    <span class="ce-preset__karaoke-fill"></span>
  {/if}
  <span class="ce-preset__text">{label}</span>
  {#if active}
    <span class="ce-preset__dot" aria-hidden="true"></span>
  {/if}
</button>
