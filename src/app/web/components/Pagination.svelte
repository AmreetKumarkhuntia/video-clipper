<script lang="ts">
  import Button from '@web/components/Button.svelte';

  interface Props {
    hasPrev?: boolean;
    hasNext?: boolean;
    onprev?: () => void;
    onnext?: () => void;
  }

  let { hasPrev = false, hasNext = false, onprev, onnext }: Props = $props();
</script>

<div class="pager">
  <Button variant="secondary" disabled={!hasPrev} onclick={onprev}>← Previous</Button>
  <Button variant="secondary" disabled={!hasNext} onclick={onnext}>Next →</Button>
</div>

<style>
  .pager {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: var(--vc-space-6);
  }
</style>
