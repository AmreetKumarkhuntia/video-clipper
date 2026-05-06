<script lang="ts">
  interface Props {
    value?: boolean;
    disabled?: boolean;
    onchange?: (value: boolean) => void;
  }

  let { value = $bindable(false), disabled = false, onchange }: Props = $props();

  function handleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    value = target.checked;
    onchange?.(value);
  }
</script>

<label class="vc-toggle" aria-label={value ? 'Enabled' : 'Disabled'}>
  <input type="checkbox" checked={value} {disabled} onchange={handleChange} />
  <span class="vc-toggle__track"></span>
  <span class="vc-toggle__thumb"></span>
</label>
