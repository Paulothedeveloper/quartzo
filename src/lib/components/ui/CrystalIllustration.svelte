<script lang="ts">
  let {
    size = 120,
    glow = 0.4,
    opacity = 1,
    float = true,
  }: { size?: number; glow?: number; opacity?: number; float?: boolean } = $props();
</script>

<div
  class="ci"
  class:float
  style="--s:{size}px; --glow:{glow}; --op:{opacity}"
  aria-hidden="true"
>
  <img src="/quartzo-crystal.png" alt="" />
</div>

<style>
  .ci {
    position: relative;
    width: var(--s);
    height: var(--s);
    flex-shrink: 0;
  }
  /* halo de luz ciano */
  .ci::before {
    content: "";
    position: absolute;
    inset: 4%;
    border-radius: 9999px;
    background: radial-gradient(
      circle,
      rgba(103, 232, 249, var(--glow)) 0%,
      rgba(103, 232, 249, 0) 68%
    );
    filter: blur(16px);
  }
  .ci img {
    position: relative;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: var(--op);
    /* dissolve as bordas do quadrado, deixando só o cristal brilhando */
    -webkit-mask-image: radial-gradient(circle at 50% 46%, #000 50%, transparent 72%);
    mask-image: radial-gradient(circle at 50% 46%, #000 50%, transparent 72%);
  }
  .float {
    animation: ci-float 6s var(--ease-out, ease-in-out) infinite;
  }
  @keyframes ci-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  :global(html.no-anim) .float {
    animation: none;
  }
</style>
