<script lang="ts">
  export let message = '';
</script>

{#if message}
  <p class="error-text">{message}</p>
{/if}
