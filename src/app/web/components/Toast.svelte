<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Toast } from '@web/lib/toastStore.js';

  export let toast: Toast;

  const dispatch = createEventDispatcher<{ dismiss: string }>();
</script>

<div
  class="toast"
  class:toast--error={toast.type === 'error'}
  class:toast--success={toast.type === 'success'}
>
  <span class="toast-message">{toast.message}</span>
  <button
    type="button"
    class="toast-dismiss"
    on:click={() => dispatch('dismiss', toast.id)}
    aria-label="Dismiss"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  </button>
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
    padding: 10px 14px;
    border-radius: var(--r-md);
    background: var(--c-surface);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    box-shadow: var(--shadow-soft);
    font-size: 14px;
    animation: toast-in 0.2s ease-out;
    max-width: 400px;
  }

  .toast--success {
    border-color: var(--c-success);
    background: var(--c-success-soft);
  }

  .toast--error {
    border-color: var(--c-error);
    background: color-mix(in srgb, var(--c-error) 10%, var(--c-surface));
    color: var(--c-error);
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
    border-radius: var(--r-sm);
    flex-shrink: 0;
  }

  .toast-dismiss:hover {
    opacity: 1;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
