<script lang="ts">
  import { Plus, Minus, Maximize2, X } from "@lucide/svelte";

  let { src, alt = "", onClose }: { src: string; alt?: string; onClose?: () => void } = $props();

  // zoom/pan (comportamento de mídia estilo Eagle)
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let dragging = false;
  let sx = 0;
  let sy = 0;

  // PORTAL pro body (fixed sem ser recortado por nenhum container)
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function clampScale(v: number) {
    return Math.max(0.2, Math.min(8, v));
  }
  function reset() {
    scale = 1;
    tx = 0;
    ty = 0;
  }
  function zoomBy(f: number) {
    scale = clampScale(scale * f);
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.15 : 0.87);
  }
  function onPointerDown(e: PointerEvent) {
    if (scale <= 1) return;
    dragging = true;
    sx = e.clientX - tx;
    sy = e.clientY - ty;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    tx = e.clientX - sx;
    ty = e.clientY - sy;
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onClose?.();
    else if (e.key === "+" || e.key === "=") zoomBy(1.2);
    else if (e.key === "-") zoomBy(0.83);
    else if (e.key === "0") reset();
  }}
/>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div use:portal class="lb-backdrop" onclick={() => onClose?.()}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <img
    class="lb-img"
    class:grab={scale > 1}
    {src}
    {alt}
    style="transform: translate({tx}px, {ty}px) scale({scale})"
    onclick={(e) => e.stopPropagation()}
    ondblclick={(e) => {
      e.stopPropagation();
      scale > 1 ? reset() : zoomBy(2);
    }}
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    draggable="false"
  />
  <!-- controles (pílula glass, estilo Eagle) -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lb-ctrl" onclick={(e) => e.stopPropagation()}>
    <button onclick={() => zoomBy(1.2)} title="Aproximar" aria-label="zoom in"><Plus size={17} /></button>
    <button onclick={() => zoomBy(0.83)} title="Afastar" aria-label="zoom out"><Minus size={17} /></button>
    <button onclick={reset} title="Tamanho real" aria-label="reset"><Maximize2 size={16} /></button>
    <button onclick={() => onClose?.()} title="Fechar (Esc)" aria-label="close"><X size={18} /></button>
  </div>
</div>

<style>
  .lb-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2200;
    display: grid;
    place-items: center;
    background: rgba(3, 6, 14, 0.82);
    backdrop-filter: blur(10px) saturate(1.1);
    animation: lb-in 0.18s var(--ease-out, ease);
  }
  @keyframes lb-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .lb-img {
    max-width: 92vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    user-select: none;
    transform-origin: center;
    transition: transform 0.05s linear;
    cursor: zoom-in;
    animation: lb-pop 0.2s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
  }
  .lb-img.grab {
    cursor: grab;
  }
  .lb-img.grab:active {
    cursor: grabbing;
  }
  @keyframes lb-pop {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
    }
  }
  .lb-ctrl {
    position: fixed;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    padding: 4px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border));
    background: color-mix(in srgb, var(--color-surface) 72%, transparent);
    backdrop-filter: blur(16px) saturate(1.2);
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
  }
  .lb-ctrl button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 38px;
    border-radius: 10px;
    color: var(--color-text-secondary);
    transition:
      background 0.15s var(--ease-out, ease),
      color 0.15s var(--ease-out, ease),
      transform 0.12s var(--ease-out, ease);
  }
  .lb-ctrl button:hover {
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
    color: var(--color-accent-light);
  }
  .lb-ctrl button:active {
    transform: scale(0.9);
  }
  :global(html.no-anim) .lb-backdrop,
  :global(html.no-anim) .lb-img {
    animation: none;
  }
</style>
