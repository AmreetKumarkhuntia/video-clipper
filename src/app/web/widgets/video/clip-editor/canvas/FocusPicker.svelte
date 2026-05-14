<script lang="ts">
  import type { FocusPickerProps } from '@app/web/types/componentProps.js';

  let { focus, containerEl, onchange }: FocusPickerProps = $props();

  function startDrag(event: PointerEvent): void {
    event.stopPropagation();
    if (!containerEl) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = focus.xCenter;
    const origY = focus.yCenter;

    function onMove(ev: PointerEvent): void {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const xCenter = Math.max(0, Math.min(1, origX + (ev.clientX - startX) / rect.width));
      const yCenter = Math.max(0, Math.min(1, origY + (ev.clientY - startY) / rect.height));
      onchange({ xCenter, yCenter });
    }

    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="focus-handle"
  style="left: {focus.xCenter * 100}%; top: {focus.yCenter * 100}%;"
  onpointerdown={startDrag}
></div>

<style>
  .focus-handle {
    position: absolute;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.5),
      0 0 8px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%);
    cursor: grab;
    z-index: 5;
  }

  .focus-handle:active {
    cursor: grabbing;
  }
</style>
