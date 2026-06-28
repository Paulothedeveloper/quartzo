<script lang="ts">
  import { setContext, untrack, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import {
    SvelteFlow,
    Background,
    Controls,
    Panel,
    type Node,
    type Edge,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { Maximize2 } from "@lucide/svelte";
  import { t } from "$lib/i18n";
  import { settings } from "$lib/stores/settings";
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCollide,
    forceX,
    forceY,
  } from "d3-force";
  import GraphNode from "./GraphNode.svelte";
  import RegionNode from "./RegionNode.svelte";
  import SynapseEdge from "./SynapseEdge.svelte";
  import GraphFocus from "./GraphFocus.svelte";
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
  let groupNodeIds = new Map<string, string[]>(); // pasta -> ids das notas (p/ zoom)

  // ---- Física contínua (d3 ao vivo) ----
  type SimNode = { id: string; x?: number; y?: number; fx?: number | null; fy?: number | null };
  let sim: ReturnType<typeof forceSimulation<SimNode>> | null = null;
  let simNodesRef: SimNode[] = [];
  let simById = new Map<string, SimNode>();
  let rNodesRef: RawGraphNode[] = [];
  let degreeRef = new Map<string, number>();
  // Caches de desempenho: os `data` dos nós e os lobos não mudam a cada tick —
  // só as posições. Reaproveitar evita recriar centenas de objetos 60x/s.
  let noteDataCache = new Map<string, any>();
  let cachedRegions: Node[] = [];
  let tickCount = 0;
  let layoutGen = 0; // invalida o pré-cálculo em lotes se os dados recarregarem
  // impulsos sinápticos (decl. cedo pra uso no onDestroy)
  let pulsingIds = new Set<string>();
  let allEdgeIds: string[] = [];
  let pulseTimer: ReturnType<typeof setInterval> | null = null;
  onDestroy(() => {
    layoutGen++;
    sim?.stop();
    if (pulseTimer) clearInterval(pulseTimer);
  });

  function posFromSim(): Map<string, { x: number; y: number }> {
    const m = new Map<string, { x: number; y: number }>();
    for (const s of simNodesRef) m.set(s.id, { x: s.x ?? 0, y: s.y ?? 0 });
    return m;
  }

  // Prepara, UMA vez por carga de dados, o `data` de cada nota + os membros de
  // cada pasta (não dependem de posição). Barato no tick (só posições mudam).
  function prepareCaches(rNodes: RawGraphNode[]) {
    noteDataCache = new Map();
    groupNodeIds = new Map();
    rNodes.forEach((n, i) => {
      const deg = degreeRef.get(n.id) ?? 0;
      const size = Math.max(7, Math.min(7 + deg * 1.8, 22));
      noteDataCache.set(n.id, {
        label: n.label,
        color: colorFor(n.group),
        size,
        path: n.path,
        group: n.group,
        index: i,
        lite: liteMode,
      });
      if (!groupNodeIds.has(n.group)) groupNodeIds.set(n.group, []);
      groupNodeIds.get(n.group)!.push(n.id);
    });
  }

  // Recalcula só os lobos/regiões (bbox por pasta) — chamado em cadência baixa.
  function computeRegions(pos: Map<string, { x: number; y: number }>): Node[] {
    const bbox = new Map<string, { minX: number; minY: number; maxX: number; maxY: number; n: number }>();
    for (const n of rNodesRef) {
      const p = pos.get(n.id) ?? { x: 0, y: 0 };
      const size = noteDataCache.get(n.id)?.size ?? 7;
      const b = bbox.get(n.group) ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, n: 0 };
      b.minX = Math.min(b.minX, p.x);
      b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x + size);
      b.maxY = Math.max(b.maxY, p.y + size);
      b.n += 1;
      bbox.set(n.group, b);
    }
    const PAD = 70;
    return [...bbox.entries()]
      .filter(([, b]) => b.n >= 2)
      .map(([group, b]) => ({
        id: `region:${group}`,
        type: "region",
        position: { x: b.minX - PAD, y: b.minY - PAD },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 0,
        data: {
          label: group || "/",
          color: colorFor(group),
          w: b.maxX - b.minX + PAD * 2,
          h: b.maxY - b.minY + PAD * 2,
          count: b.n,
          group,
        },
      })) satisfies Node[];
  }

  // Monta os nós reaproveitando `data` (cache) e, opcionalmente, recalculando
  // os lobos (caro) — no tick isso roda em cadência baixa.
  function buildNodes(pos: Map<string, { x: number; y: number }>, recomputeRegions = true): Node[] {
    if (recomputeRegions) cachedRegions = computeRegions(pos);
    const noteNodes: Node[] = rNodesRef.map((n) => ({
      id: n.id,
      type: "note",
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      zIndex: 2,
      data: noteDataCache.get(n.id),
    }));
    return [...cachedRegions, ...noteNodes];
  }

  // Arrastar um nó: fixa no ponteiro. Se a física contínua estiver ligada,
  // reaquece a simulação de leve (vizinhos reagem) — e ela esfria/para sozinha
  // ao soltar. Se estiver desligada, o SvelteFlow move só aquele nó (sem loop).
  let dragWarm = false;
  function onDragStart(node: Node | null) {
    if (!sim || !node) return;
    const s = simById.get(node.id);
    if (!s) return;
    s.fx = node.position.x;
    s.fy = node.position.y;
    dragWarm = get(settings).graphContinuous && !liteMode;
    if (dragWarm) sim.alphaTarget(0.3).restart();
  }
  function onDrag(node: Node | null) {
    if (!sim || !node) return;
    const s = simById.get(node.id);
    if (!s) return;
    s.fx = node.position.x;
    s.fy = node.position.y;
    // Sem reaquecimento: acompanha o nó na hora (sim parado, sem ticks).
    if (!dragWarm) {
      s.x = node.position.x;
      s.y = node.position.y;
      nodes = buildNodes(posFromSim(), false);
    }
  }
  function onDragStop(node: Node | null) {
    if (!node) return;
    const s = simById.get(node.id);
    if (s) {
      // Mantém a posição solta (evita "snap back" num rebuild futuro).
      s.x = node.position.x;
      s.y = node.position.y;
      s.fx = null;
      s.fy = null;
    }
    if (dragWarm) sim?.alphaTarget(0); // deixa esfriar até parar (on "end")
    dragWarm = false;
  }

  const gview = $state<GraphState>({ hoveredId: null, matched: null });
  // Modo leve: em grafos grandes desliga sombras/blur/glow (GPU-pesados ao
  // dar pan/zoom) e congela o layout. Visual quase idêntico de longe, MUITO
  // mais fluido. Limiar por nº de nós OU de arestas.
  let liteMode = $state(false);
  // Só ligamos o culling (onlyRenderVisibleElements) em grafos ENORMES: ele
  // monta/desmonta nós a cada passo de zoom (causa lag no zoom). Em grafos
  // normais, renderizar tudo e deixar o zoom ser só transform GPU é mais suave.
  let veryLarge = $state(false);
  let activeGroup = $state<string | null>(null);
  let focusTarget = $state<{ ids: string[] | null; nonce: number }>({ ids: null, nonce: 0 });

  // ---- Impulsos sinápticos (energia viajando pelas arestas) ----
  // Só ALGUMAS arestas pulsam por vez (~12), revezando a cada ~2s. As demais
  // ficam estáticas (zero repaint). SMIL (animateMotion) anima no browser, fora
  // da thread principal. Desligado no modo leve e com "reduzir animações".
  function pulsesAllowed(): boolean {
    if (liteMode || allEdgeIds.length === 0) return false;
    if (typeof document !== "undefined" && document.documentElement.classList.contains("no-anim"))
      return false;
    return true;
  }
  function tickPulses() {
    if (!pulsesAllowed()) {
      if (pulsingIds.size) { pulsingIds = new Set(); applyEdgeStyles(); }
      return;
    }
    const count = Math.min(16, Math.max(4, Math.round(allEdgeIds.length * 0.12)));
    const next = new Set<string>();
    let guard = 0;
    while (next.size < count && guard < count * 12) {
      // índice pseudo-aleatório estável o suficiente (sem Math.random global)
      const k = (tickCount * 2654435761 + next.size * 40503 + guard * 97 + allEdgeIds.length) >>> 0;
      next.add(allEdgeIds[k % allEdgeIds.length]);
      guard++;
    }
    tickCount++;
    pulsingIds = next;
    applyEdgeStyles();
  }
  function startPulses() {
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
    pulsingIds = new Set();
    if (!pulsesAllowed()) return;
    tickPulses();
    pulseTimer = setInterval(tickPulses, 1600);
  }

  function focusGroup(group: string) {
    const ids = groupNodeIds.get(group) ?? [];
    activeGroup = group;
    gview.matched = new Set(ids);
    focusTarget = { ids, nonce: focusTarget.nonce + 1 };
  }
  function resetFocus() {
    activeGroup = null;
    gview.matched = null;
    focusTarget = { ids: null, nonce: focusTarget.nonce + 1 };
  }

  setContext<GraphCtx>(GRAPH_CTX, {
    state: gview,
    get neighbors() {
      return neighbors;
    },
    open: (p) => onOpenNote?.(p),
    enter: (id) => (gview.hoveredId = id),
    leave: () => (gview.hoveredId = null),
    focusGroup,
  });

  const nodeTypes = { note: GraphNode, region: RegionNode };
  const edgeTypes = { synapse: SynapseEdge };

  function applyEdgeStyles() {
    const h = gview.hoveredId;
    const matched = gview.matched;
    const drawOnce = firstDraw;
    firstDraw = false;
    edges = baseEdges.map((e) => {
      let opacity: number;
      let stroke = "rgba(103,232,249,0.38)"; // sinapse: ciano suave
      let width = 0.9;
      // "strong" = aresta em destaque (incidente ao hover, ou dentro do filtro).
      let strong = false;
      if (h !== null) {
        strong = e.source === h || e.target === h;
        opacity = strong ? 1 : 0.04;
        if (strong) {
          stroke = "#67e8f9";
          width = 2.2;
        }
      } else if (matched) {
        strong = matched.has(e.source) && matched.has(e.target);
        opacity = strong ? 0.9 : 0.04;
        if (strong) {
          stroke = "#67e8f9";
          width = 1.8;
        }
      } else {
        opacity = 0.5;
      }
      // Sinapse "disparando": a aresta que está pulsando ACENDE (traço mais
      // forte + glow), como um neurônio real conduzindo o impulso. Só ~14 por
      // vez -> barato. As destacadas (hover/filtro) também acendem.
      const firing = !strong && !liteMode && pulsingIds.has(e.id);
      if (firing) {
        stroke = "#7df0fb";
        width = Math.max(width, 1.7);
        opacity = Math.max(opacity, 0.95);
      }
      // Glow (filtro SVG) só nas POUCAS arestas acesas (destacadas ou disparando)
      // — composita barato; as demais ficam só com o traço (sem repaint).
      const glow =
        (strong || firing) && !liteMode
          ? "filter:drop-shadow(0 0 3px rgba(103,232,249,0.9));"
          : "";
      const draw =
        drawOnce && !liteMode
          ? "stroke-dasharray:8000;stroke-dashoffset:8000;animation:edge-draw 0.9s var(--ease-out,ease) forwards;"
          : "";
      return {
        ...e,
        data: { ...(e.data as any), pulse: pulsingIds.has(e.id) },
        style: `stroke:${stroke};stroke-width:${width};opacity:${opacity};${glow}${draw}`,
      };
    });
  }

  function rebuild(rNodes: RawGraphNode[], rEdges: RawGraphEdge[]) {
    sim?.stop();
    sim = null;
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
    pulsingIds = new Set();
    layoutGen++; // invalida qualquer pré-cálculo em lotes ainda rodando
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

    // Grafo grande -> modo leve (sem efeitos pesados) + layout congelado.
    liteMode = rNodes.length > 120 || valid.length > 250;
    // Culling (onlyRenderVisibleElements): liga mais cedo (>350) — em vaults
    // grandes, pintar só o que está na viewport é MUITO mais fluido no pan/zoom.
    veryLarge = rNodes.length > 350;

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

    // Posição inicial perto do cluster da pasta -> convergência mais limpa.
    const simNodes: SimNode[] = rNodes.map((n) => ({
      id: n.id,
      x: gx(n.id) + (degree.get(n.id) ?? 0) * 2 - 12,
      y: gy(n.id) + (degree.get(n.id) ?? 0) * 2 - 12,
    }));
    const simLinks = valid.map((e) => ({ source: e.source, target: e.target }));

    // refs usadas por buildNodes() e pelos handlers de arraste
    rNodesRef = rNodes;
    degreeRef = degree;
    simNodesRef = simNodes;
    simById = new Map(simNodes.map((s) => [s.id, s]));
    prepareCaches(rNodes); // data dos nós + membros das pastas (1x por carga)

    const s = forceSimulation(simNodes)
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
      .force("y", forceY((d: any) => gy(d.id)).strength(0.16));

    // Custom edge "synapse" (desenha a aresta + impulso opcional). Reta no modo
    // leve (geometria mais barata) via data.straight.
    baseEdges = valid.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "synapse",
      data: { straight: liteMode },
    }));
    allEdgeIds = valid.map((e) => e.id);

    // ===== LAYOUT SEMPRE CONGELADO (pan/zoom liso) =====
    // A física ao VIVO era a causa do travamento: ela reconciliava os ~100 nós
    // pelo SvelteFlow ~60x/s por vários segundos ao abrir (e em máquina com
    // throttle térmico isso vira lag permanente). Agora o layout é pré-computado
    // e CONGELA — idêntico no visual, mas sem loop de repaint. A simulação só
    // reaquece de leve ao ARRASTAR um nó (se ligado nas configs) e esfria/para
    // sozinha ao soltar. `sim` fica disponível (parado) para isso.
    sim = s;
    tickCount = 0;
    s.alphaDecay(0.06); // se reaquecer (arraste), esfria rápido e PARA
    // O "tick" só dispara pelo timer interno do d3 — ou seja, apenas durante o
    // reaquecimento por arraste. No pré-cálculo abaixo usamos s.tick() manual,
    // que NÃO emite "tick"/"end" (não cria loop).
    s.on("tick", () => {
      tickCount++;
      nodes = buildNodes(posFromSim(), tickCount % 6 === 0); // lobos a cada 6
    });
    s.on("end", () => {
      nodes = buildNodes(posFromSim(), true); // acerta os lobos ao repousar
    });

    const settleAndFreeze = () => {
      s.stop(); // garante que não há timer rodando -> nada anima parado
      nodes = buildNodes(posFromSim(), true);
      applyEdgeStyles();
      startPulses(); // começa os impulsos sinápticos (poucos por vez, revezando)
      focusTarget = { ids: null, nonce: focusTarget.nonce + 1 }; // enquadra 1x
    };

    if (rNodes.length > 300) {
      // GRANDE: pré-computa em LOTES via requestAnimationFrame pra NÃO congelar
      // a thread principal (era o "travar" ao abrir vault grande).
      const total = rNodes.length > 1500 ? 160 : rNodes.length > 800 ? 230 : 320;
      const myGen = layoutGen;
      let done = 0;
      // posições parciais enquanto pré-calcula (feedback), sem emitir "tick"
      const run = () => {
        if (myGen !== layoutGen) return; // dados recarregaram -> aborta
        const batch = Math.min(25, total - done);
        for (let k = 0; k < batch; k++) s.tick();
        done += batch;
        if (done >= total) settleAndFreeze();
        else requestAnimationFrame(run);
      };
      run();
    } else {
      // Pequeno/médio: pré-computa de uma vez (rápido) e congela.
      for (let i = 0; i < 460; i++) s.tick();
      settleAndFreeze();
    }
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
  // No modo leve, NÃO restiliza centenas de arestas a cada hover (era o que
  // mais travava ao passar o mouse); as arestas ficam no estilo base.
  $effect(() => {
    gview.hoveredId;
    gview.matched;
    if (liteMode) return;
    untrack(() => applyEdgeStyles());
  });

  // Dropdown de pasta também dá zoom no lobo correspondente.
  $effect(() => {
    const f = folder;
    untrack(() => {
      if (f) focusGroup(f);
      else if (activeGroup !== null) resetFocus();
    });
  });
</script>

<div class="graph-wrap h-full w-full" class:graph-wrap--lite={liteMode}>
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    colorMode="dark"
    fitView
    minZoom={0.05}
    maxZoom={4}
    nodesConnectable={false}
    elementsSelectable={true}
    onlyRenderVisibleElements={veryLarge}
    defaultEdgeOptions={{ type: "synapse" }}
    onnodeclick={({ node }) => {
      if (node.type === "region") focusGroup((node.data as any).group as string);
    }}
    onnodedragstart={({ targetNode }) => onDragStart(targetNode)}
    onnodedrag={({ targetNode }) => onDrag(targetNode)}
    onnodedragstop={({ targetNode }) => onDragStop(targetNode)}
  >
    <Background bgColor="#0a0f1c" patternColor="#16223a" gap={28} size={1.2} />
    <Controls showLock={false} />
    <GraphFocus target={focusTarget} />
    {#if activeGroup !== null}
      <Panel position="top-left">
        <button class="region-back" onclick={resetFocus}>
          <Maximize2 size={13} />
          {$t("graph.seeAll")}
        </button>
      </Panel>
    {/if}
  </SvelteFlow>
</div>

<style>
  .graph-wrap {
    position: relative;
    /* animação de ENTRADA da tela do grafo: o "cérebro" desperta (fade + leve
       zoom). Roda ao abrir/montar a view. Respeita "reduzir animações". */
    animation: graph-wake 0.62s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  }
  @keyframes graph-wake {
    from {
      opacity: 0;
      transform: scale(0.965);
      filter: brightness(1.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
      filter: brightness(1);
    }
  }
  :global(html.no-anim) .graph-wrap {
    animation: none;
  }
  /* ===== MODO LEVE (grafos grandes): tira efeitos GPU-pesados que travam o
     pan/zoom — sombras, glow, blur e a animação de entrada. Cores e formas
     ficam (de longe é quase imperceptível), mas a fluidez melhora muito. ===== */
  .graph-wrap--lite :global(.neuron) {
    background: color-mix(in srgb, var(--c) 58%, #0a1120) !important;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16) !important;
  }
  .graph-wrap--lite :global(.gnode.hovered .neuron),
  .graph-wrap--lite :global(.gnode.focused .neuron) {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16),
      0 0 6px color-mix(in srgb, var(--c) 70%, transparent) !important;
  }
  .graph-wrap--lite :global(.gnode) {
    animation: none !important;
    transition: none !important;
  }
  .graph-wrap--lite :global(.neuron) {
    transition: none !important;
  }
  .graph-wrap--lite :global(.glabel) {
    backdrop-filter: none !important;
    box-shadow: none !important;
  }
  .graph-wrap--lite :global(.svelte-flow__edge-path) {
    filter: none !important;
    transition: none !important;
  }
  .graph-wrap--lite::after {
    content: none;
  }
  .region-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 11px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
    background: rgba(28, 37, 54, 0.78);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
    cursor: pointer;
    transition: all 0.15s var(--ease-out, ease);
  }
  .region-back:hover {
    background: var(--color-accent);
    color: #06121a;
    border-color: transparent;
  }
  .region-back:active {
    transform: scale(0.97);
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
  /* promove o viewport a uma camada própria de GPU: o pan vira um translate
     composto (sem repaint dos nós/arestas). Não muda nada visual. */
  .graph-wrap :global(.svelte-flow__viewport) {
    will-change: transform;
  }
  /* arestas: brilho-base SUTIL (sinapse) — restaura a beleza "neurônio". Como o
     layout é congelado, o pan é translate na GPU (sem repaint); só re-rasteriza
     no zoom ativo, o que é aceitável. No modo leve (grafos grandes) fica sem
     filtro (regra acima). As arestas DISPARANDO/destacadas acendem mais (inline). */
  .graph-wrap :global(.svelte-flow__edge-path) {
    filter: drop-shadow(0 0 1.5px rgba(103, 232, 249, 0.4));
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
