<script lang="ts">
  import { getBezierPath, BaseEdge } from "@xyflow/svelte";

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

  // SEMPRE bezier (curva orgânica) — neurônio não liga por linha reta.
  const geom = $derived(
    getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  );
  const path = $derived(geom[0]);

  // Duração/fase variam por aresta (hash do id) pro fluxo NÃO sincronizar.
  // Mais lento = mais elegante (motion design).
  function hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const dur = $derived(2.0 + (hash(id) % 170) / 100); // 2.0–3.7s (glide lento)
  const begin = $derived(-((hash(id + "b") % 400) / 100)); // fase espalhada 0–4s
  const fade = "0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1"; // aparece/some suave
  const glide = "0.45 0 0.55 1"; // ease-in-out na posição (glide)
</script>

<BaseEdge {id} {path} {markerEnd} {style} />

{#if data?.pulse}
  <!-- COMETA: cabeça brilhante + cauda (2 dots que ficam pra trás, opacidade
       decrescente) = rastro de energia fluindo pela sinapse. Tudo com easing. -->
  <circle class="syn-tail" r="2.2" fill="#e879f9">
    <animateMotion dur="{dur}s" begin="{begin + 0.11}s" repeatCount="indefinite" path={path} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={glide} />
    <animate attributeName="opacity" values="0;0.28;0.28;0" keyTimes="0;0.22;0.7;1" calcMode="spline" keySplines={fade} dur="{dur}s" begin="{begin + 0.11}s" repeatCount="indefinite" />
  </circle>
  <circle class="syn-tail" r="2.5" fill="#f5b8fc">
    <animateMotion dur="{dur}s" begin="{begin + 0.055}s" repeatCount="indefinite" path={path} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={glide} />
    <animate attributeName="opacity" values="0;0.45;0.45;0" keyTimes="0;0.2;0.72;1" calcMode="spline" keySplines={fade} dur="{dur}s" begin="{begin + 0.055}s" repeatCount="indefinite" />
  </circle>
  <circle class="syn-head" r="2.8" fill="#fff0fe">
    <animateMotion dur="{dur}s" begin="{begin}s" repeatCount="indefinite" path={path} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={glide} />
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.18;0.74;1" calcMode="spline" keySplines={fade} dur="{dur}s" begin="{begin}s" repeatCount="indefinite" />
    <animate attributeName="r" values="1.4;3;3;1.4" keyTimes="0;0.18;0.74;1" calcMode="spline" keySplines={fade} dur="{dur}s" begin="{begin}s" repeatCount="indefinite" />
  </circle>
{/if}

<style>
  .syn-head {
    filter: drop-shadow(0 0 5px rgba(240, 171, 252, 0.95));
    pointer-events: none;
  }
  .syn-tail {
    pointer-events: none;
  }
  :global(html.no-anim) .syn-head,
  :global(html.no-anim) .syn-tail {
    display: none;
  }
</style>
