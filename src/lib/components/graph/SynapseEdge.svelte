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

  // Duração/fase variam por aresta (hash do id) pro fluxo NÃO sincronizar —
  // dá a sensação de energia contínua e orgânica. Mais lento = mais elegante.
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
  // easing do FADE (aparece/some suave, sem "pop"). 3 intervalos (4 keyTimes).
  const fade = "0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1";
  // easing da POSIÇÃO ao longo da curva: acelera e desacelera (ease-in-out).
  const glide = "0.45 0 0.55 1";
</script>

<BaseEdge {id} {path} {markerEnd} {style} />

{#if data?.pulse}
  <!-- impulso: energia fluindo do neurônio de origem pro de destino.
       rastro translúcido (cometa) + cabeça brilhante, ambos com glide suave. -->
  <circle class="synapse-trail" r="6" fill="#67e8f9">
    <animateMotion
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
      path={path}
      rotate="auto"
      calcMode="spline"
      keyPoints="0;1"
      keyTimes="0;1"
      keySplines={glide}
    />
    <animate
      attributeName="opacity"
      values="0;0.42;0.42;0"
      keyTimes="0;0.22;0.7;1"
      calcMode="spline"
      keySplines={fade}
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
  </circle>
  <circle class="synapse-head" r="2.6" fill="#ecfeff">
    <animateMotion
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
      path={path}
      rotate="auto"
      calcMode="spline"
      keyPoints="0;1"
      keyTimes="0;1"
      keySplines={glide}
    />
    <animate
      attributeName="opacity"
      values="0;1;1;0"
      keyTimes="0;0.2;0.72;1"
      calcMode="spline"
      keySplines={fade}
      dur="{dur}s"
      begin="{begin}s"
      repeatCount="indefinite"
    />
    <animate
      attributeName="r"
      values="1.4;2.8;2.8;1.4"
      keyTimes="0;0.2;0.72;1"
      calcMode="spline"
      keySplines={fade}
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
  /* rastro: círculo maior e translúcido (sem blur por-frame — caro); o glow da
     cabeça já dá o efeito de cometa suave. */
  .synapse-trail {
    opacity: 0.4;
    pointer-events: none;
  }
  :global(html.no-anim) .synapse-head,
  :global(html.no-anim) .synapse-trail {
    display: none;
  }
</style>
