<script lang="ts">
  import { setContext, untrack } from "svelte";
  import {
    SvelteFlow,
    Background,
    Controls,
    type Node,
    type Edge,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCollide,
    forceX,
    forceY,
  } from "d3-force";
  import GraphNode from "./GraphNode.svelte";
  import { GRAPH_CTX, type GraphCtx, type GraphState } from "./context";
  import type { RawGraphNode, RawGraphEdge } from "$lib/stores/graph";

  let {
    rawNodes = [],
    rawEdges = [],
    search = "",
    folder = null,
    onOpenNote,
  }: {
    rawNodes?: RawGraphNode[];
    rawEdges?: RawGraphEdge[];
    search?: string;
    folder?: string | null;
    onOpenNote?: (path: string) => void;
  } = $props();

  const PALETTE = [
    "#67e8f9", "#818cf8", "#34d399", "#f472b6", "#fbbf24", "#a78bfa",
    "#22d3ee", "#2dd4bf", "#f87171", "#a3e635", "#e879f9", "#38bdf8",
  ];
  // Mapa pasta -> cor, por índice (garante cores distintas entre pastas).
  let groupColors = new Map<string, string>();
  function colorFor(group: string): string {
    return groupColors.get(group) ?? "#94a3b8";
  }

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let baseEdges: Edge[] = [];
  let neighbors = new Map<string, Set<string>>();
  let firstDraw = true; // anima o "draw" das arestas só na entrada

  const gview = $state<GraphState>({ hoveredId: null, matched: null });

  setContext<GraphCtx>(GRAPH_CTX, {
    state: gview,
    get neighbors() {
      return neighbors;
    },
    open: (p) => onOpenNote?.(p),
    enter: (id) => (gview.hoveredId = id),
    leave: () => (gview.hoveredId = null),
  });

  const nodeTypes = { note: GraphNode };

  function applyEdgeStyles() {
    const h = gview.hoveredId;
    const matched = gview.matched;
    const drawOnce = firstDraw;
    firstDraw = false;
    edges = baseEdges.map((e) => {
      let opacity: number;
      let stroke = "rgba(103,232,249,0.38)"; // sinapse: ciano suave
      let width = 0.9;
      if (h !== null) {
        const strong = e.source === h || e.target === h;
        opacity = strong ? 1 : 0.04;
        if (strong) {
          stroke = "#67e8f9";
          width = 2.2;
        }
      } else if (matched) {
        const on = matched.has(e.source) && matched.has(e.target);
        opacity = on ? 0.9 : 0.04;
        if (on) {
          stroke = "#67e8f9";
          width = 1.8;
        }
      } else {
        opacity = 0.5;
      }
      const glow = "filter:drop-shadow(0 0 1px rgba(103,232,249,0.5));";
      const draw = drawOnce
        ? "stroke-dasharray:8000;stroke-dashoffset:8000;animation:edge-draw 0.9s var(--ease-out,ease) forwards;"
        : "";
      return { ...e, style: `stroke:${stroke};stroke-width:${width};opacity:${opacity};${glow}${draw}` };
    });
  }

  function rebuild(rNodes: RawGraphNode[], rEdges: RawGraphEdge[]) {
    firstDraw = true; // redesenha as arestas a cada (re)carga de dados
    // cores por pasta (índice estável, ordenado)
    groupColors = new Map();
    const uniqueGroups = [...new Set(rNodes.map((n) => n.group))].sort();
    uniqueGroups.forEach((g, i) => groupColors.set(g, PALETTE[i % PALETTE.length]));

    const degree = new Map<string, number>();
    neighbors = new Map();
    for (const n of rNodes) {
      degree.set(n.id, 0);
      neighbors.set(n.id, new Set());
    }
    const valid = rEdges.filter((e) => degree.has(e.source) && degree.has(e.target));
    for (const e of valid) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      neighbors.get(e.source)!.add(e.target);
      neighbors.get(e.target)!.add(e.source);
    }

    // Centros de cluster por pasta, distribuídos num círculo (folders se agrupam).
    const groupList = [...new Set(rNodes.map((n) => n.group))].sort();
    const radius = Math.max(170, groupList.length * 48);
    const groupPos = new Map<string, { x: number; y: number }>();
    groupList.forEach((g, i) => {
      const a = (i / Math.max(groupList.length, 1)) * Math.PI * 2;
      groupPos.set(g, { x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    });
    const groupOf = new Map(rNodes.map((n) => [n.id, n.group]));
    const gx = (id: string) => groupPos.get(groupOf.get(id)!)?.x ?? 0;
    const gy = (id: string) => groupPos.get(groupOf.get(id)!)?.y ?? 0;

    type SimNode = { id: string; x?: number; y?: number };
    // Posição inicial perto do cluster da pasta -> convergência mais limpa.
    const simNodes: SimNode[] = rNodes.map((n) => ({
      id: n.id,
      x: gx(n.id) + (degree.get(n.id) ?? 0) * 2 - 12,
      y: gy(n.id) + (degree.get(n.id) ?? 0) * 2 - 12,
    }));
    const simLinks = valid.map((e) => ({ source: e.source, target: e.target }));

    const sim = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-230).distanceMax(520))
      .force(
        "link",
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(46)
          .strength(0.5)
      )
      .force("collide", forceCollide().radius(16).strength(0.9))
      // Agrupa por pasta (clusters visíveis) sem separar rígido demais.
      .force("x", forceX((d: any) => gx(d.id)).strength(0.16))
      .force("y", forceY((d: any) => gy(d.id)).strength(0.16))
      .stop();

    const ticks = rNodes.length > 1000 ? 200 : rNodes.length > 300 ? 340 : 460;
    for (let i = 0; i < ticks; i++) sim.tick();

    const pos = new Map<string, { x: number; y: number }>();
    for (const s of simNodes) pos.set(s.id, { x: s.x ?? 0, y: s.y ?? 0 });

    nodes = rNodes.map((n, i) => {
      const deg = degree.get(n.id) ?? 0;
      const size = Math.max(7, Math.min(7 + deg * 1.8, 22));
      const p = pos.get(n.id)!;
      return {
        id: n.id,
        type: "note",
        position: { x: p.x, y: p.y },
        data: { label: n.label, color: colorFor(n.group), size, path: n.path, group: n.group, index: i },
      } satisfies Node;
    });

    baseEdges = valid.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "bezier" }));
    applyEdgeStyles();
  }

  // Reconstrói quando os dados mudam.
  $effect(() => {
    const rn = rawNodes;
    const re = rawEdges;
    untrack(() => rebuild(rn, re));
  });

  // Recalcula a busca/filtro -> conjunto destacado.
  $effect(() => {
    const q = search.trim().toLowerCase();
    const f = folder;
    if (!q && !f) {
      gview.matched = null;
      return;
    }
    const set = new Set<string>();
    for (const n of untrack(() => rawNodes)) {
      const okQ = !q || n.label.toLowerCase().includes(q);
      const okF = !f || n.group === f;
      if (okQ && okF) set.add(n.id);
    }
    gview.matched = set;
  });

  // Reaplica estilo das arestas quando hover/busca mudam.
  $effect(() => {
    gview.hoveredId;
    gview.matched;
    untrack(() => applyEdgeStyles());
  });
</script>

<div class="graph-wrap h-full w-full">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    colorMode="dark"
    fitView
    minZoom={0.05}
    maxZoom={4}
    nodesConnectable={false}
    elementsSelectable={true}
    defaultEdgeOptions={{ type: "bezier" }}
  >
    <Background bgColor="#0a0f1c" patternColor="#16223a" gap={28} size={1.2} />
    <Controls showLock={false} />
  </SvelteFlow>
</div>

<style>
  .graph-wrap {
    position: relative;
  }
  /* atmosfera cristalina: glow ciano sutil sobre o canvas */
  .graph-wrap::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background: radial-gradient(ellipse at 50% 38%, rgba(103, 232, 249, 0.06), transparent 62%);
  }
  /* arestas surgem suavemente ao carregar */
  .graph-wrap :global(.svelte-flow__edges) {
    animation: edges-in 0.7s var(--ease-out, ease) both;
  }
  @keyframes edges-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  :global(html.no-anim) .graph-wrap :global(.svelte-flow__edges) {
    animation: none;
  }
  .graph-wrap :global(.svelte-flow) {
    background-color: #0a0f1c;
  }
  /* arestas com leve brilho cristalino (as destacadas ficam mais fortes pelo stroke) */
  .graph-wrap :global(.svelte-flow__edge-path) {
    filter: drop-shadow(0 0 2.5px rgba(103, 232, 249, 0.35));
    transition: stroke 0.22s var(--ease-out, ease), stroke-width 0.22s var(--ease-out, ease);
  }
  .graph-wrap :global(.svelte-flow__minimap) {
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.4);
    margin: 14px;
  }
  .graph-wrap :global(.svelte-flow__controls) {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
    margin: 14px;
  }
  .graph-wrap :global(.svelte-flow__controls-button) {
    background: rgba(28, 37, 54, 0.72);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    color: #cbd5e1;
    width: 28px;
    height: 28px;
    transition: all 0.15s var(--ease-out, ease);
  }
  .graph-wrap :global(.svelte-flow__controls-button:hover) {
    background: var(--color-accent);
    color: #06121a;
  }
  .graph-wrap :global(.svelte-flow__controls-button svg) {
    fill: currentColor;
  }
</style>
