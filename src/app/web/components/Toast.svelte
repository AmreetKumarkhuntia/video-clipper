<script lang="ts">
  import type { ToastProps } from '@app/web/types/componentProps.js';

  let { toast, ondismiss }: ToastProps = $props();
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
    onclick={() => ondismiss?.(toast.id)}
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
    gap: var(--vc-space-3);
    padding: 10px 14px;
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    border: 1px solid var(--vc-border);
    box-shadow: var(--vc-shadow-1);
    font-size: 14px;
    animation: toast-in 0.2s ease-out;
    max-width: 400px;
  }

  .toast--success {
    border-color: var(--vc-success);
    background: var(--vc-success-soft);
  }

  .toast--error {
    border-color: var(--vc-error);
    background: color-mix(in srgb, var(--vc-error) 10%, var(--vc-surface));
    color: var(--vc-error);
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 2px;
    border: none;
    border-radius: var(--vc-radius-sm);
    background: none;
    color: inherit;
    opacity: 0.5;
    cursor: pointer;
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
