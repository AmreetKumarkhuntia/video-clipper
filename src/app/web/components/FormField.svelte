<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    full?: boolean;
    children: Snippet;
  }

  let { label, full = false, children }: Props = $props();
</script>

<label class="field" class:field--full={full}>
  <span>{label}</span>
  {@render children()}
</label>

<style>
  .field {
    display: grid;
    gap: var(--s-xs);
  }

  .field--full {
    grid-column: 1 / -1;
  }

  .field > span {
    font-size: 12px;
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-text-muted);
  }

  .field :global(input),
  .field :global(textarea),
  .field :global(select) {
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--c-surface) 84%, white 16%);
    color: var(--c-text);
    font: inherit;
  }

  .field :global(input),
  .field :global(select) {
    min-height: 46px;
  }

  .field :global(textarea) {
    resize: vertical;
    line-height: 1.55;
  }

  .field :global(input:focus),
  .field :global(textarea:focus),
  .field :global(select:focus) {
    outline: 2px solid transparent;
    border-color: var(--c-accent);
    box-shadow: 0 0 0 4px var(--c-accent-soft);
  }
</style>
