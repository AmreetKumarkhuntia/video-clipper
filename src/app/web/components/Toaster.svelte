<script lang="ts">
  import { toasts, dismissToast } from '@web/lib/stores/toast.js';
  import Toast from './Toast.svelte';
</script>

{#if $toasts.length > 0}
  <div class="toaster" role="status" aria-live="polite">
    {#each $toasts as toast (toast.id)}
      <Toast {toast} ondismiss={(id) => dismissToast(id)} />
    {/each}
  </div>
{/if}

<style>
  .toaster {
    position: fixed;
    bottom: var(--vc-space-5);
    right: var(--vc-space-5);
    z-index: 100;
    display: flex;
    flex-direction: column-reverse;
    gap: var(--vc-space-3);
    pointer-events: none;
  }

  .toaster > :global(*) {
    pointer-events: auto;
  }

  @media (max-width: 720px) {
    .toaster {
      left: var(--vc-space-3);
      right: var(--vc-space-3);
      bottom: var(--vc-space-3);
    }
  }
</style>
