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
  <!-- impulso: energia viajando do neurônio de origem pro de destino -->
  <circle class="synapse-pulse" r="2.6" fill="#a5f3fc">
    <animateMotion dur="{dur}s" begin="{begin}s" repeatCount="indefinite" path={path} rotate="auto" />
    <animate
      attributeName="opacity"
      values="0;1;1;0"
      keyTimes="0;0.15;0.7;1"
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
  </circle>
{/if}

<style>
  .synapse-pulse {
    filter: drop-shadow(0 0 3.5px rgba(165, 243, 252, 0.95));
    pointer-events: none;
  }
  /* respeita "reduzir animações" */
  :global(html.no-anim) .synapse-pulse {
    display: none;
  }
</style>
