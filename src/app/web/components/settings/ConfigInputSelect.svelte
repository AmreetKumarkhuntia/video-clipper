<script lang="ts">
  interface Props {
    value?: string;
    options?: string[];
    optionLabels?: string[];
    disabled?: boolean;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    options = [],
    optionLabels = [],
    disabled = false,
    onchange,
  }: Props = $props();

  function handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    value = target.value;
    onchange?.(value);
  }
</script>

<select class="select" {disabled} onchange={handleChange} bind:value>
  {#each options as option, i (option)}
    <option value={option}>{optionLabels[i] ?? option}</option>
  {/each}
</select>

<style>
  .select {
    width: 100%;
    min-height: 40px;
    padding: 0 32px 0 12px;
    border: 1px solid var(--vc-border);
    border-radius: var(--vc-radius-md);
    background: var(--vc-surface);
    color: var(--vc-text);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%2370756c' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    transition: border-color 0.16s ease;
  }

  .select:focus {
    outline: none;
    border-color: var(--vc-clay-500);
  }

  .select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
