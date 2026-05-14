<script lang="ts">
  import type { CanvasOverlayProps } from '@app/web/types/componentProps.js';

  let { overlay, selected, containerEl, onSelect, onUpdate }: CanvasOverlayProps = $props();

  let dragMoved = false;

  let outlineStyle = $derived(
    overlay.style.outlineColor !== null
      ? `-webkit-text-stroke: ${overlay.style.outlineWidth}px ${overlay.style.outlineColor}; paint-order: stroke fill;`
      : '',
  );

  let bgStyle = $derived(
    overlay.style.bgColor !== null
      ? `background-color: ${overlay.style.bgColor}; padding: ${overlay.style.bgPaddingY}px ${overlay.style.bgPaddingX}px; border-radius: ${overlay.style.bgRadius}px;`
      : '',
  );

  // Mirror the canvas `translate(-50%, -50%)` center anchor, switching for align.
  let transformStyle = $derived(
    overlay.style.align === 'left'
      ? 'translate(0, -50%)'
      : overlay.style.align === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(-50%, -50%)',
  );

  function startDrag(event: PointerEvent): void {
    event.stopPropagation();
    if (!containerEl) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = overlay.position.xCenter;
    const origY = overlay.position.yCenter;
    dragMoved = false;

    function onMove(ev: PointerEvent): void {
      if (!containerEl) return;
      if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
        dragMoved = true;
      }
      if (!dragMoved) return;
      const rect = containerEl.getBoundingClientRect();
      const xCenter = Math.max(0, Math.min(1, origX + (ev.clientX - startX) / rect.width));
      const yCenter = Math.max(0, Math.min(1, origY + (ev.clientY - startY) / rect.height));
      onUpdate({ ...overlay, position: { xCenter, yCenter } });
    }

    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setTimeout(() => {
        dragMoved = false;
      }, 0);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleClick(): void {
    if (!dragMoved) onSelect();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }
</script>

<div
  class="canvas-overlay"
  class:canvas-overlay--selected={selected}
  style="left: {overlay.position.xCenter * 100}%; top: {overlay.position.yCenter *
    100}%; font-size: {overlay.style.fontSize * 0.045}cqw; color: {overlay.style
    .color}; font-weight: {overlay.style
    .weight}; transform: {transformStyle}; {bgStyle}; {outlineStyle}"
  role="button"
  tabindex="0"
  onpointerdown={startDrag}
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  {overlay.text}
</div>

<style>
  .canvas-overlay {
    position: absolute;
    text-align: center;
    white-space: pre-wrap;
    cursor: grab;
  }

  .canvas-overlay:active {
    cursor: grabbing;
  }

  .canvas-overlay--selected {
    outline: 2px solid rgba(255, 255, 255, 0.7);
    outline-offset: 4px;
    border-radius: 2px;
  }
</style>
