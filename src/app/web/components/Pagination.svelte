<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './Button.svelte';

  export let hasPrev = false;
  export let hasNext = false;

  const dispatch = createEventDispatcher<{ prev: void; next: void }>();
</script>

<div class="pager">
  <Button variant="outline" disabled={!hasPrev} on:click={() => dispatch('prev')}>Previous</Button>
  <Button variant="outline" disabled={!hasNext} on:click={() => dispatch('next')}>Next</Button>
</div>

<style>
  .pager {
    display: flex;
    justify-content: center;
    gap: var(--s-sm);
    margin-top: var(--s-xl);
  }
</style>
