<script lang="ts">
  interface Props {
    hasPrev?: boolean;
    hasNext?: boolean;
    onprev?: () => void;
    onnext?: () => void;
  }

  let { hasPrev = false, hasNext = false, onprev, onnext }: Props = $props();
</script>

<div class="pager">
  <button class="vc-btn vc-btn--secondary" disabled={!hasPrev} onclick={onprev}>
    ← Previous
  </button>
  <button class="vc-btn vc-btn--secondary" disabled={!hasNext} onclick={onnext}> Next → </button>
</div>

<style>
  .pager {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: var(--vc-space-6);
  }
</style>
