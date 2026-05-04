<script lang="ts">
  export let eyebrow = '';
  export let heading = '';
</script>

<section class="page-head">
  <div>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{heading}</h1>
  </div>
  <div class="action">
    <slot name="action" />
  </div>
</section>

<style>
  .page-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 30px;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 42px);
    line-height: 1;
  }

  .action {
    display: flex;
    align-items: center;
    gap: var(--s-sm);
  }

  @media (max-width: 620px) {
    .page-head {
      flex-direction: column;
      align-items: start;
    }
  }
</style>
