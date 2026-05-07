<script lang="ts">
  import Slider from '@web/components/Slider.svelte';
  import type { ConfigInputSliderProps } from '@app/web/types/componentProps.js';

  let {
    id,
    value = $bindable(undefined),
    min,
    max,
    disabled = false,
    onchange,
  }: ConfigInputSliderProps = $props();
</script>

<Slider {id} {min} {max} {disabled} bind:value {onchange} />
