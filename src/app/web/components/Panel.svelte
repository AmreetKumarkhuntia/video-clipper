<script lang="ts">
  export let tag: 'section' | 'article' | 'aside' | 'div' = 'section';
  export let padded = true;
</script>

<svelte:element this={tag} class="panel" class:panel--unpadded={!padded}>
  <slot />
</svelte:element>

<style>
  .panel {
    padding: clamp(18px, 2.4vw, 28px);
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl);
    background: color-mix(in srgb, var(--c-surface) 80%, white 20%);
    box-shadow: var(--shadow-soft);
  }

  .panel--unpadded {
    padding: 0;
  }
</style>
