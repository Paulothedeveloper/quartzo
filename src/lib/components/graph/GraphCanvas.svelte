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

  // Paleta restrita à família do CRISTAL (cyan -> teal -> azul -> violeta ->
  // magenta) — nada de verde/âmbar/vermelho quente. Mantém distinção de pastas
  // mas tudo "lê" como a rede neural dentro do cristal (o ícone do app).
  const PALETTE = [
    "#67e8f9", "#a5f3fc", "#22d3ee", "#38bdf8", "#7dd3fc",
    "#818cf8", "#a78bfa", "#c4b5fd", "#60a5fa", "#5eead4",
    "#e879f9", "#f0abfc",
  ];
  // Mapa pasta -> cor, por índice (garante cores distintas entre pastas).
  let groupColors = new Map<string, string>();
  function colorFor(group: string): string {
    return groupColors.get(group) ?? "#8ba6d8"; // fallback frio (azul-violeta)
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
  onDestroy(() => {
    layoutGen++;
    sim?.stop();
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
  // ESTÁTICOS: cada aresta pulsa (ou não) de forma fixa, definida no build. SEM
  // timer/rebuild periódico — era ele que reiniciava TODOS os pulsos a cada 1,6s
  // e dava o aspecto "engasgado/animalesco". Agora o cometa flui contínuo (SMIL,
  // com easing), cada um numa fase/velocidade diferente -> energia fluida.
  // Em vaults grandes, limitamos a ~120 cometas (escolha estável, não rotativa)
  // pra não exagerar; o resto fica só com o traço. Desliga com "reduzir animações".
  const PULSE_CAP = 120;
  function noAnim(): boolean {
    return typeof document !== "undefined" && document.documentElement.classList.contains("no-anim");
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
      let stroke = "rgba(232,121,249,0.40)"; // sinapse: magenta/rosa suave (rede da logo)
      let width = 0.9;
      // "strong" = aresta em destaque (incidente ao hover, ou dentro do filtro).
      let strong = false;
      if (h !== null) {
        strong = e.source === h || e.target === h;
        opacity = strong ? 1 : 0.04;
        if (strong) {
          stroke = "#f0abfc";
          width = 2.2;
        }
      } else if (matched) {
        strong = matched.has(e.source) && matched.has(e.target);
        opacity = strong ? 0.9 : 0.04;
        if (strong) {
          stroke = "#f0abfc";
          width = 1.8;
        }
      } else {
        // Teia neural ROSA da logo (sinapses magenta firing) — legível sobre o navy.
        stroke = "rgba(232,121,249,0.52)";
        width = 1.0;
        opacity = 0.66;
        // Arestas "energizadas" (as que têm cometa) ficam mais VIVAS: traço mais
        // claro/grosso. Sem filtro (barato) e ESTÁVEL (data.pulse é fixo, não
        // rotaciona) -> rede de neurônios vibrante, sem engasgo.
        if ((e.data as any)?.pulse) {
          stroke = "rgba(244,170,252,0.68)";
          width = 1.35;
          opacity = 0.8;
        }
      }
      // Glow (filtro SVG) só nas arestas DESTACADAS (hover/filtro) — são poucas,
      // composita barato. O "neurônio piscando" vem do COMETA (data.pulse), que é
      // estável (definido no build) e animado por SMIL com easing — sem rebuild
      // periódico, então flui sem engasgar.
      const glow = strong
        ? "filter:drop-shadow(0 0 3px rgba(232,121,249,0.9));"
        : "";
      const draw =
        drawOnce && !liteMode
          ? "stroke-dasharray:8000;stroke-dashoffset:8000;animation:edge-draw 0.9s var(--ease-out,ease) forwards;"
          : "";
      return {
        ...e,
        data: e.data, // pulse já definido no build (estável)
        style: `stroke:${stroke};stroke-width:${width};opacity:${opacity};${glow}${draw}`,
      };
    });
  }

  function rebuild(rNodes: RawGraphNode[], rEdges: RawGraphEdge[]) {
    sim?.stop();
    sim = null;
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
    // EXCEÇÃO do Paulo: se "qualidade total" estiver ligada nas configs, força o
    // visual completo (nós cyan com glow + animações) mesmo em vault grande.
    liteMode = (rNodes.length > 120 || valid.length > 250) && !get(settings).graphFullQuality;
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

    // Custom edge "synapse" (desenha a aresta + impulso opcional). SEMPRE bezier
    // (curva) — neurônios não se ligam por linha reta. Curvar vs. reto não muda
    // o custo (é só o "d" do path); a otimização real é o layout congelado.
    // Pulso ESTÁVEL por aresta (sem rotação/timer). Em vaults grandes, ~1 a cada
    // N arestas pulsa (cap ~120 cometas) — escolha fixa, então nada reinicia.
    const off = noAnim();
    const step = !off && valid.length > PULSE_CAP ? Math.ceil(valid.length / PULSE_CAP) : 1;
    baseEdges = valid.map((e, i) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "synapse",
      data: { pulse: !off && i % step === 0 },
    }));

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

  // Reconstrói quando os dados mudam — ou quando o Paulo alterna a "qualidade total"
  // (precisa rebuildar pq o data.lite dos nós é definido no build).
  $effect(() => {
    const rn = rawNodes;
    const re = rawEdges;
    $settings.graphFullQuality;
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
  <!-- FUNDO DE ESPAÇO: nebulosa (gradientes coloridos difusos) + campo de estrelas.
       Estático/na GPU (pointer-events:none) — não afeta o pan/zoom da rede. -->
  <div class="graph-space" aria-hidden="true">
    <!-- zonas de cor da nebulosa -->
    <div class="nebcolor"></div>
    <!-- nuvem de gás PROCEDURAL (ruído Perlin / fractalNoise) modulando a cor via
         blend -> nebulosa real estilo Hubble. Renderizada UMA vez (estática). -->
    <svg class="nebnoise" viewBox="0 0 900 640" preserveAspectRatio="xMidYMid slice">
      <filter id="qz-neb"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="8" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#qz-neb)"/>
    </svg>
    <svg class="nebnoise2" viewBox="0 0 900 640" preserveAspectRatio="xMidYMid slice">
      <filter id="qz-neb2"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#qz-neb2)"/>
    </svg>
    <svg class="starfield" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <circle class="st" cx="761.7" cy="28.6" r="1.16" fill="#ffffff" opacity="0.58"/>
        <circle class="st" cx="539.2" cy="591.1" r="0.52" fill="#a5f3fc" opacity="0.57"/>
        <circle class="st" cx="911.4" cy="829.3" r="1.24" fill="#ffffff" opacity="0.83"/>
        <circle class="st" cx="750.3" cy="415.5" r="1.28" fill="#ffffff" opacity="0.27"/>
        <circle class="st big" cx="573.6" cy="517.3" r="2.44" fill="#ffffff" opacity="0.43"/>
        <circle class="st" cx="986.7" cy="705.1" r="0.56" fill="#a5f3fc" opacity="0.63"/>
        <circle class="st big" cx="562.8" cy="402.5" r="1.62" fill="#ffffff" opacity="0.44"/>
        <circle class="st big" cx="572.1" cy="244.2" r="1.78" fill="#ffffff" opacity="0.56"/>
        <circle class="st tw" cx="426.8" cy="704.4" r="0.47" fill="#ffffff" opacity="0.74" style="animation-delay:-0.78s"/>
        <circle class="st tw" cx="859.0" cy="821.9" r="0.67" fill="#ffffff" opacity="0.66" style="animation-delay:-2.48s"/>
        <circle class="st tw" cx="462.7" cy="11.1" r="0.81" fill="#a5f3fc" opacity="0.84" style="animation-delay:-2.57s"/>
        <circle class="st" cx="477.6" cy="695.2" r="0.73" fill="#a5f3fc" opacity="0.63"/>
        <circle class="st tw" cx="506.2" cy="534.0" r="0.48" fill="#ffffff" opacity="0.40" style="animation-delay:-0.20s"/>
        <circle class="st" cx="980.4" cy="656.4" r="1.21" fill="#ffffff" opacity="0.76"/>
        <circle class="st" cx="823.4" cy="230.6" r="0.55" fill="#ffffff" opacity="0.61"/>
        <circle class="st" cx="18.8" cy="997.7" r="1.13" fill="#a5f3fc" opacity="0.82"/>
        <circle class="st tw" cx="740.8" cy="904.4" r="0.81" fill="#ffffff" opacity="0.40" style="animation-delay:-1.80s"/>
        <circle class="st" cx="439.9" cy="251.9" r="1.20" fill="#ffffff" opacity="0.30"/>
        <circle class="st big" cx="10.7" cy="573.3" r="2.33" fill="#c4b5fd" opacity="0.81"/>
        <circle class="st" cx="304.7" cy="197.3" r="0.93" fill="#ffffff" opacity="0.45"/>
        <circle class="st" cx="412.3" cy="690.8" r="0.61" fill="#ffffff" opacity="0.41"/>
        <circle class="st" cx="408.2" cy="966.4" r="1.24" fill="#a5f3fc" opacity="0.41"/>
        <circle class="st" cx="588.6" cy="922.5" r="0.47" fill="#a5f3fc" opacity="0.77"/>
        <circle class="st big" cx="137.0" cy="754.2" r="2.03" fill="#ffffff" opacity="0.51"/>
        <circle class="st" cx="523.8" cy="178.8" r="1.09" fill="#ffffff" opacity="0.35"/>
        <circle class="st tw" cx="246.9" cy="740.8" r="0.79" fill="#ffffff" opacity="0.68" style="animation-delay:-0.54s"/>
        <circle class="st" cx="852.2" cy="629.5" r="0.86" fill="#ffffff" opacity="0.60"/>
        <circle class="st" cx="594.3" cy="670.3" r="0.46" fill="#a5f3fc" opacity="0.69"/>
        <circle class="st" cx="313.2" cy="679.5" r="0.55" fill="#ffffff" opacity="0.68"/>
        <circle class="st" cx="86.5" cy="955.8" r="1.02" fill="#ffffff" opacity="0.78"/>
        <circle class="st" cx="266.4" cy="929.2" r="0.46" fill="#ffffff" opacity="0.28"/>
        <circle class="st" cx="118.9" cy="442.8" r="0.72" fill="#c4b5fd" opacity="0.27"/>
        <circle class="st tw" cx="506.2" cy="714.5" r="0.77" fill="#ffffff" opacity="0.29" style="animation-delay:-0.44s"/>
        <circle class="st tw" cx="811.6" cy="211.7" r="0.64" fill="#ffffff" opacity="0.63" style="animation-delay:-0.40s"/>
        <circle class="st tw" cx="589.1" cy="470.6" r="0.91" fill="#ffffff" opacity="0.46" style="animation-delay:-0.91s"/>
        <circle class="st" cx="2.4" cy="232.7" r="1.08" fill="#ffffff" opacity="0.26"/>
        <circle class="st" cx="979.9" cy="513.7" r="0.54" fill="#ffffff" opacity="0.32"/>
        <circle class="st" cx="50.1" cy="477.2" r="1.16" fill="#ffffff" opacity="0.50"/>
        <circle class="st" cx="385.8" cy="635.7" r="0.77" fill="#ffffff" opacity="0.63"/>
        <circle class="st" cx="658.1" cy="646.5" r="0.58" fill="#ffffff" opacity="0.41"/>
        <circle class="st" cx="629.5" cy="668.2" r="0.76" fill="#c4b5fd" opacity="0.35"/>
        <circle class="st tw" cx="12.5" cy="908.1" r="0.49" fill="#ffffff" opacity="0.52" style="animation-delay:-2.61s"/>
        <circle class="st" cx="247.8" cy="810.6" r="1.16" fill="#ffffff" opacity="0.85"/>
        <circle class="st" cx="754.1" cy="709.6" r="0.96" fill="#ffffff" opacity="0.38"/>
        <circle class="st tw" cx="292.2" cy="287.3" r="0.76" fill="#ffffff" opacity="0.60" style="animation-delay:-1.83s"/>
        <circle class="st" cx="83.8" cy="366.9" r="0.46" fill="#ffffff" opacity="0.67"/>
        <circle class="st" cx="30.5" cy="419.4" r="1.24" fill="#c4b5fd" opacity="0.61"/>
        <circle class="st tw" cx="195.9" cy="17.3" r="0.61" fill="#ffffff" opacity="0.53" style="animation-delay:-2.87s"/>
        <circle class="st tw" cx="251.1" cy="489.7" r="0.62" fill="#ffffff" opacity="0.67" style="animation-delay:-1.69s"/>
        <circle class="st" cx="295.3" cy="838.4" r="0.73" fill="#a5f3fc" opacity="0.29"/>
        <circle class="st" cx="271.8" cy="949.1" r="0.43" fill="#a5f3fc" opacity="0.78"/>
        <circle class="st tw" cx="807.4" cy="352.6" r="0.64" fill="#a5f3fc" opacity="0.38" style="animation-delay:-2.88s"/>
        <circle class="st" cx="999.3" cy="856.2" r="0.72" fill="#ffffff" opacity="0.32"/>
        <circle class="st" cx="860.1" cy="149.4" r="1.26" fill="#f0abfc" opacity="0.84"/>
        <circle class="st" cx="872.1" cy="359.6" r="1.14" fill="#a5f3fc" opacity="0.29"/>
        <circle class="st" cx="403.5" cy="11.3" r="0.78" fill="#ffffff" opacity="0.32"/>
        <circle class="st" cx="613.9" cy="508.5" r="1.11" fill="#ffffff" opacity="0.71"/>
        <circle class="st" cx="655.7" cy="406.0" r="1.19" fill="#ffffff" opacity="0.30"/>
        <circle class="st tw" cx="663.7" cy="705.5" r="0.62" fill="#ffffff" opacity="0.61" style="animation-delay:-2.22s"/>
        <circle class="st" cx="852.6" cy="310.7" r="0.75" fill="#ffffff" opacity="0.29"/>
        <circle class="st" cx="853.0" cy="4.6" r="0.46" fill="#ffffff" opacity="0.45"/>
        <circle class="st tw" cx="530.3" cy="414.0" r="0.59" fill="#ffffff" opacity="0.28" style="animation-delay:-2.84s"/>
        <circle class="st" cx="912.0" cy="842.3" r="0.79" fill="#f0abfc" opacity="0.65"/>
        <circle class="st" cx="938.8" cy="778.5" r="1.23" fill="#ffffff" opacity="0.82"/>
        <circle class="st" cx="896.3" cy="524.5" r="1.29" fill="#a5f3fc" opacity="0.84"/>
        <circle class="st" cx="797.1" cy="832.2" r="1.19" fill="#ffffff" opacity="0.56"/>
        <circle class="st tw" cx="130.1" cy="9.6" r="1.08" fill="#ffffff" opacity="0.49" style="animation-delay:-1.80s"/>
        <circle class="st" cx="283.1" cy="205.7" r="0.96" fill="#ffffff" opacity="0.78"/>
        <circle class="st" cx="122.5" cy="644.9" r="0.95" fill="#ffffff" opacity="0.54"/>
        <circle class="st tw" cx="198.0" cy="947.3" r="0.40" fill="#ffffff" opacity="0.35" style="animation-delay:-0.19s"/>
        <circle class="st" cx="719.8" cy="692.2" r="0.91" fill="#ffffff" opacity="0.61"/>
        <circle class="st" cx="96.3" cy="357.8" r="0.54" fill="#ffffff" opacity="0.56"/>
        <circle class="st" cx="58.3" cy="183.6" r="1.14" fill="#f0abfc" opacity="0.47"/>
        <circle class="st" cx="25.0" cy="719.6" r="0.79" fill="#f0abfc" opacity="0.57"/>
        <circle class="st tw" cx="762.7" cy="738.2" r="0.51" fill="#ffffff" opacity="0.55" style="animation-delay:-1.88s"/>
        <circle class="st tw" cx="979.5" cy="497.8" r="0.94" fill="#ffffff" opacity="0.83" style="animation-delay:-0.51s"/>
        <circle class="st tw" cx="704.3" cy="842.3" r="0.43" fill="#c4b5fd" opacity="0.33" style="animation-delay:-0.27s"/>
        <circle class="st big" cx="95.0" cy="709.3" r="1.94" fill="#ffffff" opacity="0.27"/>
        <circle class="st" cx="968.3" cy="885.2" r="0.90" fill="#ffffff" opacity="0.48"/>
        <circle class="st" cx="494.5" cy="718.1" r="1.14" fill="#ffffff" opacity="0.37"/>
        <circle class="st tw" cx="918.4" cy="605.2" r="0.55" fill="#ffffff" opacity="0.63" style="animation-delay:-2.64s"/>
        <circle class="st" cx="791.3" cy="897.0" r="0.62" fill="#ffffff" opacity="0.50"/>
        <circle class="st" cx="323.9" cy="570.9" r="0.49" fill="#ffffff" opacity="0.32"/>
        <circle class="st" cx="526.6" cy="787.3" r="1.24" fill="#ffffff" opacity="0.26"/>
        <circle class="st tw" cx="346.4" cy="222.6" r="0.82" fill="#a5f3fc" opacity="0.66" style="animation-delay:-0.11s"/>
        <circle class="st" cx="692.9" cy="810.5" r="0.67" fill="#ffffff" opacity="0.73"/>
        <circle class="st" cx="191.8" cy="602.1" r="1.25" fill="#a5f3fc" opacity="0.49"/>
        <circle class="st tw" cx="427.1" cy="518.3" r="0.97" fill="#c4b5fd" opacity="0.77" style="animation-delay:-1.57s"/>
        <circle class="st tw" cx="860.9" cy="384.0" r="1.19" fill="#ffffff" opacity="0.52" style="animation-delay:-2.85s"/>
        <circle class="st" cx="965.4" cy="950.7" r="0.80" fill="#ffffff" opacity="0.61"/>
        <circle class="st" cx="306.9" cy="641.5" r="0.99" fill="#a5f3fc" opacity="0.63"/>
        <circle class="st" cx="580.3" cy="554.5" r="0.74" fill="#ffffff" opacity="0.40"/>
        <circle class="st" cx="768.8" cy="69.7" r="0.76" fill="#a5f3fc" opacity="0.78"/>
        <circle class="st" cx="911.2" cy="879.9" r="0.91" fill="#ffffff" opacity="0.35"/>
        <circle class="st big" cx="911.3" cy="341.4" r="1.80" fill="#ffffff" opacity="0.45"/>
        <circle class="st big" cx="900.2" cy="857.6" r="2.05" fill="#ffffff" opacity="0.27"/>
        <circle class="st big" cx="540.9" cy="637.0" r="1.66" fill="#c4b5fd" opacity="0.84"/>
        <circle class="st" cx="887.1" cy="395.0" r="1.19" fill="#ffffff" opacity="0.31"/>
        <circle class="st tw" cx="174.7" cy="148.8" r="0.94" fill="#ffffff" opacity="0.78" style="animation-delay:-2.14s"/>
        <circle class="st" cx="913.5" cy="46.1" r="0.91" fill="#ffffff" opacity="0.56"/>
        <circle class="st tw" cx="433.2" cy="318.1" r="0.71" fill="#ffffff" opacity="0.39" style="animation-delay:-1.86s"/>
        <circle class="st tw" cx="355.0" cy="901.9" r="1.17" fill="#ffffff" opacity="0.43" style="animation-delay:-1.72s"/>
        <circle class="st" cx="512.9" cy="777.1" r="0.57" fill="#ffffff" opacity="0.30"/>
        <circle class="st tw" cx="453.3" cy="555.6" r="0.86" fill="#ffffff" opacity="0.77" style="animation-delay:-1.55s"/>
        <circle class="st tw" cx="696.1" cy="485.2" r="1.18" fill="#c4b5fd" opacity="0.47" style="animation-delay:-1.73s"/>
        <circle class="st" cx="412.6" cy="408.0" r="0.58" fill="#ffffff" opacity="0.54"/>
        <circle class="st" cx="732.6" cy="805.8" r="0.98" fill="#ffffff" opacity="0.61"/>
        <circle class="st" cx="809.4" cy="96.2" r="0.96" fill="#ffffff" opacity="0.52"/>
        <circle class="st" cx="83.1" cy="822.1" r="1.19" fill="#ffffff" opacity="0.50"/>
        <circle class="st" cx="946.9" cy="163.9" r="1.23" fill="#c4b5fd" opacity="0.58"/>
        <circle class="st tw" cx="35.6" cy="796.2" r="0.95" fill="#ffffff" opacity="0.69" style="animation-delay:-0.17s"/>
        <circle class="st" cx="418.2" cy="3.1" r="1.28" fill="#ffffff" opacity="0.27"/>
        <circle class="st tw" cx="510.1" cy="882.7" r="0.86" fill="#a5f3fc" opacity="0.61" style="animation-delay:-2.59s"/>
        <circle class="st big" cx="361.1" cy="395.4" r="2.47" fill="#a5f3fc" opacity="0.35"/>
        <circle class="st" cx="119.8" cy="108.7" r="0.77" fill="#f0abfc" opacity="0.46"/>
        <circle class="st tw" cx="751.2" cy="932.2" r="1.20" fill="#a5f3fc" opacity="0.53" style="animation-delay:-0.20s"/>
        <circle class="st" cx="833.9" cy="702.8" r="1.05" fill="#a5f3fc" opacity="0.43"/>
        <circle class="st" cx="899.8" cy="857.3" r="1.18" fill="#ffffff" opacity="0.30"/>
        <circle class="st" cx="740.9" cy="716.2" r="1.30" fill="#c4b5fd" opacity="0.77"/>
        <circle class="st" cx="346.7" cy="976.9" r="0.54" fill="#ffffff" opacity="0.28"/>
        <circle class="st" cx="611.9" cy="271.2" r="1.23" fill="#ffffff" opacity="0.40"/>
        <circle class="st" cx="358.5" cy="149.9" r="0.79" fill="#ffffff" opacity="0.55"/>
        <circle class="st tw" cx="911.4" cy="123.9" r="0.53" fill="#ffffff" opacity="0.55" style="animation-delay:-0.79s"/>
        <circle class="st tw" cx="767.2" cy="235.5" r="0.96" fill="#ffffff" opacity="0.63" style="animation-delay:-1.49s"/>
        <circle class="st" cx="496.0" cy="593.2" r="1.16" fill="#ffffff" opacity="0.73"/>
        <circle class="st" cx="882.9" cy="655.9" r="0.71" fill="#ffffff" opacity="0.30"/>
        <circle class="st" cx="827.6" cy="125.8" r="0.87" fill="#ffffff" opacity="0.52"/>
        <circle class="st" cx="227.0" cy="232.2" r="1.26" fill="#ffffff" opacity="0.39"/>
        <circle class="st" cx="586.2" cy="760.0" r="0.94" fill="#a5f3fc" opacity="0.61"/>
        <circle class="st" cx="44.0" cy="992.5" r="0.92" fill="#c4b5fd" opacity="0.38"/>
        <circle class="st tw" cx="632.4" cy="506.1" r="1.11" fill="#ffffff" opacity="0.40" style="animation-delay:-1.08s"/>
        <circle class="st" cx="407.8" cy="196.4" r="0.69" fill="#a5f3fc" opacity="0.61"/>
        <circle class="st tw" cx="314.8" cy="102.0" r="1.12" fill="#ffffff" opacity="0.50" style="animation-delay:-1.05s"/>
        <circle class="st" cx="85.5" cy="926.0" r="1.25" fill="#ffffff" opacity="0.76"/>
        <circle class="st" cx="75.5" cy="812.6" r="0.65" fill="#f0abfc" opacity="0.36"/>
        <circle class="st tw" cx="145.7" cy="463.9" r="0.62" fill="#ffffff" opacity="0.50" style="animation-delay:-0.51s"/>
        <circle class="st" cx="214.0" cy="614.6" r="0.98" fill="#ffffff" opacity="0.71"/>
        <circle class="st" cx="953.1" cy="2.8" r="1.21" fill="#ffffff" opacity="0.72"/>
        <circle class="st tw" cx="207.3" cy="793.9" r="0.59" fill="#ffffff" opacity="0.47" style="animation-delay:-2.57s"/>
        <circle class="st" cx="137.1" cy="438.2" r="0.72" fill="#a5f3fc" opacity="0.30"/>
    </svg>
  </div>
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
    <Background bgColor="transparent" patternColor="transparent" gap={26} size={1} />
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
    /* FUNDO DE ESPAÇO PROFUNDO: gradiente do cosmos (toques de violeta/azul/magenta
       sobre quase-preto) — a nebulosa e as estrelas vêm por cima (.graph-space). */
    background:
      radial-gradient(ellipse 120% 85% at 50% -10%, #1b1242 0%, transparent 55%),
      radial-gradient(ellipse 110% 80% at 85% 105%, #0c1f4a 0%, transparent 55%),
      radial-gradient(ellipse 80% 70% at 18% 88%, #2a103c 0%, transparent 52%),
      #050310;
    /* animação de ENTRADA da tela do grafo: o "cérebro" desperta (fade + leve
       zoom). Roda ao abrir/montar a view. Respeita "reduzir animações". */
    animation: graph-wake 0.62s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
  }
  /* ===== FUNDO DE ESPAÇO: nebulosa + campo de estrelas (atrás da rede, z-0) ===== */
  .graph-space {
    position: absolute;
    inset: -8%;
    z-index: 0;
    pointer-events: none;
  }
  /* zonas de cor da nebulosa (magenta/violeta/azul/cyan) — respiram bem devagar.
     O ruído Perlin (.nebnoise) por cima é que dá a textura de gás. */
  .nebcolor {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 44% 38% at 28% 30%, rgba(217, 70, 239, 0.5), transparent 70%),
      radial-gradient(ellipse 48% 42% at 72% 58%, rgba(56, 189, 248, 0.38), transparent 72%),
      radial-gradient(ellipse 38% 34% at 54% 82%, rgba(129, 140, 248, 0.44), transparent 70%),
      radial-gradient(ellipse 32% 30% at 84% 22%, rgba(103, 232, 249, 0.32), transparent 72%),
      radial-gradient(ellipse 36% 32% at 12% 64%, rgba(168, 85, 247, 0.36), transparent 72%);
    animation: nebula-drift 48s ease-in-out infinite;
  }
  /* nuvem Perlin grayscale, blend overlay/screen -> textura de gás real */
  .nebnoise {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: overlay;
    opacity: 0.82;
  }
  .nebnoise2 {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: screen;
    opacity: 0.2;
  }
  @keyframes nebula-drift {
    0%, 100% { transform: scale(1) translate3d(0, 0, 0); opacity: 0.9; }
    50% { transform: scale(1.06) translate3d(1%, -0.8%, 0); opacity: 1; }
  }
  .starfield {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    animation: stars-drift 60s linear infinite;
  }
  @keyframes stars-drift {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-2%, -1.5%, 0); }
  }
  .starfield .big {
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8));
  }
  .starfield .tw {
    animation: twinkle 3.2s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
  }
  :global(html.no-anim) .nebcolor,
  :global(html.no-anim) .starfield,
  :global(html.no-anim) .starfield .tw {
    animation: none;
  }
  /* modo leve (vault grande): congela o twinkle/drift do espaço pra rolar liso */
  .graph-wrap--lite .nebcolor,
  .graph-wrap--lite .starfield,
  .graph-wrap--lite .starfield .tw {
    animation: none;
  }
  .graph-wrap :global(.svelte-flow) {
    position: relative;
    z-index: 1;
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
  /* modo leve (vault grande): neurônio rosa branco-quente com glow ESTÁTICO (sem
     animação/halo pulsante), pra manter a cor da logo sem custar no pan/zoom. */
  .graph-wrap--lite :global(.neuron) {
    background: radial-gradient(circle at 50% 40%, #ffffff 0%, #fde9ff 20%, #f4abfc 52%, #b41fc9 78%, #2a0f33 100%) !important;
    box-shadow: 0 0 5px rgba(232, 121, 249, 0.62), inset 0 0 2px rgba(255, 255, 255, 0.6) !important;
    transition: none !important;
  }
  .graph-wrap--lite :global(.gnode.hovered .neuron),
  .graph-wrap--lite :global(.gnode.focused .neuron) {
    box-shadow: 0 0 11px rgba(240, 171, 252, 0.95), 0 0 22px rgba(217, 70, 239, 0.5),
      inset 0 0 3px rgba(255, 255, 255, 0.5) !important;
  }
  .graph-wrap--lite :global(.gnode) {
    animation: none !important;
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
  /* atmosfera neural suave: bloom rosa no centro (rede acesa) + um toque cyan no
     topo. SÓ glows radiais — sem linhas/facetas. pointer-events:none, na GPU. */
  .graph-wrap::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background:
      radial-gradient(ellipse 70% 55% at 50% 32%, rgba(103, 232, 249, 0.06), transparent 60%),
      radial-gradient(ellipse 55% 50% at 50% 52%, rgba(217, 70, 239, 0.07), transparent 64%);
  }
  /* leve vinheta + facetas: bordas escurecem (sensação de estar dentro da pedra) */
  .graph-wrap::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
    background: radial-gradient(ellipse 96% 96% at 50% 50%, transparent 64%, rgba(5, 8, 16, 0.55) 100%);
  }
  :global(html.no-anim) .graph-wrap::after {
    background:
      radial-gradient(ellipse 70% 55% at 50% 30%, rgba(103, 232, 249, 0.06), transparent 60%);
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
    background-color: transparent; /* deixa as facetas do cristal aparecerem atrás */
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
    filter: drop-shadow(0 0 1.5px rgba(232, 121, 249, 0.42));
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
