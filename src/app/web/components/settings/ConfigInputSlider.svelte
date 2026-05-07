<script lang="ts">
  import Slider from '@web/components/Slider.svelte';

  interface Props {
    id?: string;
    value?: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    onchange?: (value: number | undefined) => void;
  }

  let { id, value = $bindable(undefined), min, max, disabled = false, onchange }: Props = $props();
</script>

<Slider {id} {min} {max} {disabled} bind:value {onchange} />
