<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href: string;
    children: Snippet;
  }

  let { href, children }: Props = $props();
</script>

<a {href} class="nav-link">
  {@render children()}
</a>

<style>
  .nav-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c-surface) 75%, white 25%);
    color: var(--c-text);
    font-weight: var(--fw-bold);
    text-decoration: none;
    transition:
      transform 0.16s ease,
      border-color 0.16s ease,
      background-color 0.16s ease;
  }

  .nav-link:hover {
    transform: translateY(-1px);
    border-color: var(--c-border-strong);
    background: var(--c-surface);
  }

  @media (max-width: 620px) {
    .nav-link {
      min-height: 44px;
    }
  }
</style>
