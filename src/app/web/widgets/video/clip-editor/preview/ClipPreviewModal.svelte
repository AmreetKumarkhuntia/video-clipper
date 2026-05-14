<script lang="ts">
  import type { ClipPreviewModalProps } from '@app/web/types/componentProps.js';
  import Button from '@web/components/Button.svelte';
  import Icon from '@web/components/Icon.svelte';

  let { clipId, onclose }: ClipPreviewModalProps = $props();

  // Cache-bust with timestamp so a fresh re-render is always loaded.
  const ts = Date.now();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="preview-backdrop" onclick={onclose}></div>

<div class="preview-modal" role="dialog" aria-modal="true" aria-label="Clip preview">
  <div class="preview-modal__header">
    <span class="preview-modal__title">Preview</span>
    <Button variant="ghost" size="icon" onclick={onclose}>
      <Icon name="x" size={18} />
    </Button>
  </div>

  <div class="preview-modal__body">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video class="preview-modal__video" src="/api/clips/{clipId}/file?v={ts}" controls autoplay
    ></video>
  </div>
</div>

<style>
  .preview-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 200;
  }

  .preview-modal {
    position: fixed;
    inset: 0;
    z-index: 201;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .preview-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: min(90vw, 640px);
    padding: 10px 12px;
    background: var(--vc-surface-1, #1a1a1a);
    border-radius: var(--vc-radius, 8px) var(--vc-radius, 8px) 0 0;
    pointer-events: all;
  }

  .preview-modal__title {
    font-size: var(--vc-text-14, 14px);
    font-weight: 600;
    color: var(--vc-text-primary, #fff);
  }

  .preview-modal__body {
    width: min(90vw, 640px);
    background: #000;
    border-radius: 0 0 var(--vc-radius, 8px) var(--vc-radius, 8px);
    overflow: hidden;
    pointer-events: all;
  }

  .preview-modal__video {
    display: block;
    width: 100%;
    max-height: 80vh;
    object-fit: contain;
  }
</style>
