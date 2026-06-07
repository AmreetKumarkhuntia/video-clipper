<script lang="ts">
  import type { SectionHeaderProps } from '@app/web/types/componentProps.js';

  let { eyebrow, title, subtitle, class: extraClass = '' }: SectionHeaderProps = $props();
</script>

<div class="section-header {extraClass}">
  <p class="section-header__eyebrow">{eyebrow}</p>
  <h2 class="section-header__title">{title}</h2>
  {#if subtitle}
    <p class="section-header__subtitle">{subtitle}</p>
  {/if}
</div>

<style>
  .section-header {
    display: grid;
    gap: 6px;
  }

  .section-header__eyebrow {
    font-family: var(--vc-font-mono);
    font-size: 11px;
    color: var(--vc-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .section-header__title {
    margin: 0;
    font-family: var(--vc-font-display);
    font-size: clamp(26px, 4vw, 36px);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: var(--vc-text);
  }

  .section-header__subtitle {
    margin: 0;
    font-size: var(--vc-text-14);
    font-weight: 600;
    color: var(--vc-text-muted);
  }
</style>
