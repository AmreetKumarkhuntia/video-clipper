<script lang="ts">
  import { toasts, dismissToast } from '@web/lib/toastStore.js';
  import Toast from './Toast.svelte';
</script>

{#if $toasts.length > 0}
  <div class="toaster" role="status" aria-live="polite">
    {#each $toasts as toast (toast.id)}
      <Toast {toast} on:dismiss={(e) => dismissToast(e.detail)} />
    {/each}
  </div>
{/if}

<style>
  .toaster {
    position: fixed;
    bottom: var(--s-lg);
    right: var(--s-lg);
    z-index: 100;
    display: flex;
    flex-direction: column-reverse;
    gap: var(--s-sm);
    pointer-events: none;
  }

  .toaster > :global(*) {
    pointer-events: auto;
  }

  @media (max-width: 720px) {
    .toaster {
      left: var(--s-sm);
      right: var(--s-sm);
      bottom: var(--s-sm);
    }
  }
</style>
