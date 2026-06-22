<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import { getContext } from "svelte";
  import { GRAPH_CTX, type GraphCtx } from "./context";

  let {
    id,
    data,
  }: {
    id: string;
    data: { label: string; color: string; size: number; path: string; index: number };
  } = $props();

  const ctx = getContext<GraphCtx>(GRAPH_CTX);

  const hovered = $derived(ctx.state.hoveredId === id);
  const neighborOfHover = $derived(
    ctx.state.hoveredId !== null && ctx.neighbors.get(ctx.state.hoveredId)?.has(id) === true
  );
  const focused = $derived(hovered || neighborOfHover);
  const dim = $derived.by(() => {
    if (ctx.state.hoveredId !== null) return !focused;
    if (ctx.state.matched !== null) return !ctx.state.matched.has(id);
    return false;
  });

  const delay = $derived(Math.min(data.index * 6, 480));
  const icon = $derived(
    (data.label.match(/\p{Extended_Pictographic}/u)?.[0] as string | undefined) ?? null
  );
</script>

<div
  class="gnode"
  class:dim
  class:hovered
  class:focused
  style="--c:{data.color}; --delay:{delay}ms"
  role="button"
  tabindex="-1"
  title={data.label}
  onmouseenter={() => ctx.enter(id)}
  onmouseleave={() => ctx.leave()}
  onclick={() => ctx.open(data.path)}
  onkeydown={(e) => e.key === "Enter" && ctx.open(data.path)}
>
  <Handle type="target" position={Position.Top} class="ghandle" />
  <Handle type="source" position={Position.Bottom} class="ghandle" />
  <span class="neuron" style="width:{data.size}px;height:{data.size}px">
    {#if icon}
      <span class="gicon" style="font-size:{Math.max(data.size * 0.55, 6)}px">{icon}</span>
    {/if}
  </span>
  <span class="glabel">{data.label}</span>
</div>

<style>
  .gnode {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    transition:
      opacity 0.28s var(--ease-out, ease),
      filter 0.22s var(--ease-out, ease);
    animation: gnode-in 0.4s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)) both;
    animation-delay: var(--delay);
  }
  @keyframes gnode-in {
    from { opacity: 0; transform: scale(0.6); }
    to { opacity: 1; transform: scale(1); }
  }
  :global(html.no-anim) .gnode {
    animation: none;
  }

  /* ===== NEURÔNIO: soma redonda com glow suave, cor por pasta ===== */
  .neuron {
    position: relative;
    display: grid;
    place-items: center;
    border-radius: 9999px;
    background: radial-gradient(
      circle at 50% 38%,
      color-mix(in srgb, var(--c) 78%, #1a2336) 0%,
      color-mix(in srgb, var(--c) 30%, #0a1120) 96%
    );
    box-shadow:
      0 0 5px color-mix(in srgb, var(--c) 60%, transparent),
      0 0 13px color-mix(in srgb, var(--c) 28%, transparent),
      inset 0 0 3px rgba(255, 255, 255, 0.28);
    transition:
      transform 0.24s var(--ease-out, ease),
      box-shadow 0.24s var(--ease-out, ease);
  }
  .gicon {
    position: relative;
    z-index: 1;
    line-height: 1;
    opacity: 0.9;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
  }

  /* rótulo flutuante: aparece SÓ no nó sob o cursor, como um pill limpo
     (antes apareciam todos os vizinhos e o texto se sobrepunha) */
  .glabel {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(2px);
    z-index: 20;
    pointer-events: none;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1;
    color: #eaf6ff;
    white-space: nowrap;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(10, 15, 28, 0.82);
    border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(6px);
    opacity: 0;
    transition:
      opacity 0.16s var(--ease-out, ease),
      transform 0.16s var(--ease-out, ease);
  }
  .gnode.hovered .glabel {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .gnode.dim {
    opacity: 0.12;
  }
  .gnode.hovered {
    z-index: 10;
  }
  .gnode.hovered .neuron {
    transform: scale(1.5);
    box-shadow:
      0 0 12px color-mix(in srgb, var(--c) 95%, transparent),
      0 0 26px color-mix(in srgb, var(--c) 55%, transparent),
      inset 0 0 4px rgba(255, 255, 255, 0.35);
  }
  .gnode.focused .neuron {
    box-shadow:
      0 0 9px color-mix(in srgb, var(--c) 85%, transparent),
      0 0 18px color-mix(in srgb, var(--c) 40%, transparent),
      inset 0 0 3px rgba(255, 255, 255, 0.3);
  }
  .gnode.hovered .glabel {
    color: #f0f9ff;
  }

  :global(.svelte-flow__node.selected) .neuron {
    animation: gpulse 1.8s ease-in-out infinite;
  }
  @keyframes gpulse {
    0%, 100% {
      box-shadow: 0 0 7px rgba(103, 232, 249, 0.55), inset 0 0 3px rgba(255, 255, 255, 0.3);
    }
    50% {
      box-shadow: 0 0 18px rgba(103, 232, 249, 0.95), 0 0 30px rgba(165, 243, 252, 0.5), inset 0 0 4px rgba(255, 255, 255, 0.4);
    }
  }

  :global(.gnode .ghandle) {
    opacity: 0;
    width: 1px;
    height: 1px;
    min-width: 0;
    min-height: 0;
    border: none;
    top: 50%;
    left: 50%;
    pointer-events: none;
  }
</style>
