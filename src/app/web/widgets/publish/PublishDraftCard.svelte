<script lang="ts">
  import Card from '@web/components/Card.svelte';
  import Icon from '@web/components/Icon.svelte';
  import Toggle from '@web/components/Toggle.svelte';
  import { formatDuration, formatTime } from '@web/lib/format.js';
  import type { PublishDraftItem } from '@app/web/types/publish.js';
  import type { PublishDraftCardProps } from '@app/web/types/componentProps.js';

  let { item, index, onupdate, onopen }: PublishDraftCardProps = $props();

  function patchItem(patch: Partial<PublishDraftItem>): void {
    onupdate?.({ index, item: { ...item, ...patch } });
  }

  function handleOpen(): void {
    onopen?.({ index, item });
  }
</script>

<Card
  interactive
  class={['draft-card', item.selected ? 'draft-card--selected' : ''].filter(Boolean).join(' ')}
>
  <button
    type="button"
    class="draft-card__open"
    aria-label={`Edit clip ${index + 1}: ${item.title || item.filename}`}
    onclick={handleOpen}
  >
    <div class="draft-card__thumb">
      <div class="draft-card__thumb-bg"></div>
      <div class="draft-card__thumb-time">
        {formatTime(item.startSec)}
      </div>
      <div class="draft-card__thumb-dur">
        {formatDuration(item.durationSec)}
      </div>
      <div class="draft-card__thumb-play">
        <Icon name="play" size={18} />
      </div>
    </div>

    <div class="draft-card__body">
      <div class="draft-card__row">
        <span class="draft-card__rank">Clip {index + 1}</span>
        {#if item.scheduledAt}
          <span class="draft-card__schedule" title={new Date(item.scheduledAt).toLocaleString()}>
            {new Date(item.scheduledAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        {/if}
        <span class="draft-card__privacy" data-privacy={item.privacyStatus}>
          {item.privacyStatus}
        </span>
      </div>
      <p class="draft-card__title">{item.title || item.filename}</p>
      {#if item.description}
        <p class="draft-card__desc">{item.description}</p>
      {/if}
    </div>
  </button>

  <label class="draft-card__include">
    <Toggle
      checked={item.selected}
      ariaLabel="Include in publish"
      onchange={(checked) => patchItem({ selected: checked })}
    />
    <span class="draft-card__include-label">Include in publish</span>
  </label>
</Card>

<style>
  :global(.draft-card) {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  :global(.draft-card:hover) {
    transform: translateY(-1px);
  }

  :global(.draft-card--selected) {
    border-color: var(--vc-clay-500);
    box-shadow: 0 0 0 1px var(--vc-clay-500);
    background: var(--vc-clay-50);
  }

  .draft-card__open {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .draft-card__open:focus-visible {
    outline: 2px solid var(--vc-clay-500);
    outline-offset: -2px;
  }

  .draft-card__thumb {
    position: relative;
    aspect-ratio: 9 / 12;
    background: #1a1714;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .draft-card__thumb-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 30%, rgba(217, 119, 87, 0.2), transparent 50%),
      radial-gradient(circle at 30% 80%, rgba(120, 160, 180, 0.1), transparent 50%);
  }

  .draft-card__thumb-time {
    position: absolute;
    top: 10px;
    left: 10px;
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(0, 0, 0, 0.4);
    padding: 3px 8px;
    border-radius: 4px;
    backdrop-filter: blur(4px);
  }

  .draft-card__thumb-dur {
    position: absolute;
    bottom: 10px;
    right: 10px;
    font-family: var(--vc-font-mono);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .draft-card__thumb-play {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    color: white;
  }

  .draft-card__body {
    padding: 12px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .draft-card__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .draft-card__rank {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .draft-card__privacy {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--vc-text-subtle);
    border: 1px solid var(--vc-divider);
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: auto;
  }

  .draft-card__schedule {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--vc-accent);
    border: 1px solid color-mix(in srgb, var(--vc-accent) 40%, transparent);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .draft-card__privacy[data-privacy='public'] {
    color: var(--vc-success, #16a34a);
    border-color: color-mix(in srgb, var(--vc-success, #16a34a) 40%, transparent);
  }

  .draft-card__title {
    font-size: var(--vc-text-14);
    font-weight: 500;
    line-height: 1.4;
    color: var(--vc-text);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .draft-card__desc {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
    line-height: 1.45;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .draft-card__include {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 12px;
    border-top: 1px solid var(--vc-divider);
  }

  .draft-card__include-label {
    font-size: var(--vc-text-13);
    color: var(--vc-text-muted);
  }
</style>
