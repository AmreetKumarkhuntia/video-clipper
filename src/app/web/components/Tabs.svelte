<script lang="ts" generics="T extends string">
  import type { TabsProps } from '@app/web/types/componentProps.js';

  let { options, value, ariaLabel, onchange }: TabsProps<T> = $props();
</script>

<div class="vc-tabs" role="tablist" aria-label={ariaLabel}>
  {#each options as opt (opt.value)}
    <button
      type="button"
      class="vc-tab"
      role="tab"
      aria-selected={opt.value === value}
      class:is-active={opt.value === value}
      onclick={() => opt.value !== value && onchange(opt.value)}
    >
      {opt.label}{#if opt.count != null}<span class="tab-count">{opt.count}</span>{/if}
    </button>
  {/each}
</div>
