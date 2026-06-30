<script lang="ts">
  import { getContext } from "svelte";
  import { GRAPH_CTX, type GraphCtx } from "./context";

  let {
    data,
  }: {
    data: { label: string; color: string; w: number; h: number; count: number; group: string };
  } = $props();

  const ctx = getContext<GraphCtx>(GRAPH_CTX);

  // Quando há busca/filtro, esmaece as regiões que não casam.
  const dim = $derived(
    ctx.state.matched !== null || ctx.state.hoveredId !== null
  );
</script>

<div class="region" class:dim style="--c:{data.color}; width:{data.w}px; height:{data.h}px" title={data.label}>
  <span class="rlabel">{data.label}</span>
  <span class="rcount">{data.count}</span>
</div>

<style>
  .region {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* rótulo ANCORADO NO TOPO (não no centro) — senão o nome da pasta fica ATRÁS
       do aglomerado de nós (que a física centraliza na região) = colisão de texto
       com elementos. No topo, fica acima dos nós, legível e sem sobrepor. */
    justify-content: flex-start;
    padding-top: 13%;
    border-radius: 9999px;
    cursor: pointer;
    /* lobo: névoa colorida suave, como uma área cerebral / faceta do cristal */
    background: radial-gradient(
      ellipse at 50% 45%,
      color-mix(in srgb, var(--c) 22%, transparent) 0%,
      color-mix(in srgb, var(--c) 9%, transparent) 45%,
      transparent 72%
    );
    border: 1px dashed color-mix(in srgb, var(--c) 28%, transparent);
    transition:
      background 0.25s var(--ease-out, ease),
      opacity 0.25s var(--ease-out, ease),
      transform 0.25s var(--ease-out, ease);
  }
  /* BLOOM do cluster: brilho branco-quente atrás do aglomerado (clusters densos
     "acendem", como nos renderizadores de galáxia). Estático/GPU, atrás da névoa. */
  .region::before {
    content: "";
    position: absolute;
    inset: 8%;
    z-index: -1;
    border-radius: 9999px;
    pointer-events: none;
    background: radial-gradient(
      circle,
      rgba(255, 240, 255, 0.14) 0%,
      rgba(244, 170, 252, 0.09) 36%,
      transparent 68%
    );
  }
  .region:hover {
    background: radial-gradient(
      ellipse at 50% 45%,
      color-mix(in srgb, var(--c) 34%, transparent) 0%,
      color-mix(in srgb, var(--c) 15%, transparent) 48%,
      transparent 74%
    );
    border-color: color-mix(in srgb, var(--c) 55%, transparent);
    transform: scale(1.012);
  }
  .region.dim {
    opacity: 0.35;
  }

  .rlabel {
    font-family: var(--font-sans);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--c) 72%, #e2e8f0);
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
    opacity: 0.55;
    pointer-events: none;
    transition: opacity 0.25s var(--ease-out, ease);
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .region:hover .rlabel {
    opacity: 0.95;
  }
  .rcount {
    margin-top: 2px;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    color: color-mix(in srgb, var(--c) 60%, #94a3b8);
    opacity: 0.5;
    pointer-events: none;
  }
</style>
