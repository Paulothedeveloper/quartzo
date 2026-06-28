<script lang="ts">
  import { getBezierPath, getStraightPath, BaseEdge } from "@xyflow/svelte";

  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    data,
  }: any = $props();

  // Bezier por padrão; reto no modo leve (mais barato).
  const geom = $derived(
    data?.straight
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  );
  const path = $derived(geom[0]);

  // Duração/atraso variam por aresta (hash do id) pra os impulsos não sincronizarem.
  function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const dur = $derived(1.1 + (hash(id) % 90) / 100); // 1.10–1.99s
  const begin = $derived(-((hash(id + "b") % 140) / 100)); // começa em fase diferente
</script>

<BaseEdge {id} {path} {markerEnd} {style} />

{#if data?.pulse}
  <!-- impulso: energia viajando do neurônio de origem pro de destino.
       "cometa": um rastro maior e suave + a cabeça brilhante. -->
  <circle class="synapse-trail" r="5" fill="#67e8f9">
    <animateMotion dur="{dur}s" begin="{begin}s" repeatCount="indefinite" path={path} rotate="auto" />
    <animate
      attributeName="opacity"
      values="0;0.5;0.5;0"
      keyTimes="0;0.18;0.7;1"
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
  </circle>
  <circle class="synapse-head" r="3" fill="#ecfeff">
    <animateMotion dur="{dur}s" begin="{begin}s" repeatCount="indefinite" path={path} rotate="auto" />
    <animate
      attributeName="opacity"
      values="0;1;1;0"
      keyTimes="0;0.12;0.72;1"
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
    <animate
      attributeName="r"
      values="1.6;3;3;1.6"
      keyTimes="0;0.12;0.72;1"
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
  </circle>
{/if}

<style>
  .synapse-head {
    filter: drop-shadow(0 0 5px rgba(165, 243, 252, 0.95));
    pointer-events: none;
  }
  /* rastro: círculo maior e translúcido (sem blur — blur por frame é caro);
     o glow da cabeça já dá a sensação de cometa. */
  .synapse-trail {
    opacity: 0.4;
    pointer-events: none;
  }
  /* respeita "reduzir animações" */
  :global(html.no-anim) .synapse-head,
  :global(html.no-anim) .synapse-trail {
    display: none;
  }
</style>
