<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
  import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
  import {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    forceCollide,
  } from "d3-force-3d";
  import { settings } from "$lib/stores/settings";
  import type { RawGraphNode, RawGraphEdge } from "$lib/stores/graph";

  let {
    rawNodes = [],
    rawEdges = [],
    search = "",
    folder = null,
    onOpenNote,
    onNodePick,
  }: {
    rawNodes?: RawGraphNode[];
    rawEdges?: RawGraphEdge[];
    search?: string;
    folder?: string | null;
    onOpenNote?: (path: string) => void;
    onNodePick?: (path: string | null, x: number, y: number) => void;
  } = $props();

  let host: HTMLDivElement;
  let raf = 0;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let composer: EffectComposer;
  let ro: ResizeObserver;
  let disposed = false;

  // Paleta por pasta (família do cristal/galáxia) — cada pasta = "domínio".
  const PALETTE = [
    0x67e8f9, 0xa5f3fc, 0x22d3ee, 0x38bdf8, 0x818cf8, 0xa78bfa, 0xc4b5fd, 0x60a5fa,
    0x5eead4, 0xe879f9, 0xf0abfc, 0xf472b6,
  ];
  const groupColor = new Map<string, THREE.Color>();

  type NSim = { id: string; path: string; label: string; group: string; deg: number; x?: number; y?: number; z?: number };
  let nodeSprites: THREE.Sprite[] = [];
  let nodeById = new Map<string, { sprite: THREE.Sprite; sim: NSim; base: number }>();
  let edgeLines: THREE.LineSegments | null = null;
  let neighbors = new Map<string, Set<string>>();
  let glowTex: THREE.Texture;
  let downXY = { x: 0, y: 0 };
  let hovered: THREE.Sprite | null = null; // nó sob o cursor
  let downSprite: THREE.Sprite | null = null; // nó pressionado (pra clique = abrir)
  let lastSig = ""; // assinatura dos dados — evita reconstruir o WebGL à toa

  // assinatura barata do grafo (ids dos nós + pares das arestas). Se não mudou,
  // não reconstruímos (reindex do watcher com dados idênticos não pisca/reseta).
  function graphSig(): string {
    let s = rawNodes.length + "|" + rawEdges.length + "#";
    for (const n of rawNodes) s += n.id + ",";
    s += "#";
    for (const e of rawEdges) s += e.source + ">" + e.target + ";";
    return s;
  }

  // textura de glow (radial branco -> transparente) p/ os nós-neurônio (aditivo = bloom)
  function makeGlowTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.2, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // textura de nuvem (nebulosa) — radial suave colorível
  function makeCloudTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,255,255,0.5)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.18)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function colorFor(group: string): THREE.Color {
    return groupColor.get(group) ?? new THREE.Color(0x8ba6d8);
  }

  function buildGraph() {
    // limpa anterior
    for (const s of nodeSprites) {
      scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    nodeSprites = [];
    nodeById = new Map();
    hovered = null;
    downSprite = null;
    if (edgeLines) {
      scene.remove(edgeLines);
      edgeLines.geometry.dispose();
      (edgeLines.material as THREE.Material).dispose();
      edgeLines = null;
    }

    // cores por pasta
    groupColor.clear();
    const groups = [...new Set(rawNodes.map((n) => n.group))].sort();
    groups.forEach((g, i) => groupColor.set(g, new THREE.Color(PALETTE[i % PALETTE.length])));

    // grau + vizinhos
    const deg = new Map<string, number>();
    neighbors = new Map();
    for (const n of rawNodes) {
      deg.set(n.id, 0);
      neighbors.set(n.id, new Set());
    }
    const valid = rawEdges.filter((e) => deg.has(e.source) && deg.has(e.target));
    for (const e of valid) {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
      neighbors.get(e.source)!.add(e.target);
      neighbors.get(e.target)!.add(e.source);
    }

    // ---- LAYOUT 3D CONGELADO (roda N ticks e PARA — sem física ao vivo) ----
    const nodes: NSim[] = rawNodes.map((n) => ({
      id: n.id,
      path: n.path,
      label: n.label,
      group: n.group,
      deg: deg.get(n.id) ?? 0,
    }));
    const links = valid.map((e) => ({ source: e.source, target: e.target }));
    const sim = forceSimulation(nodes, 3)
      .force("charge", forceManyBody().strength(-90).distanceMax(420))
      .force("link", forceLink(links).id((d: any) => d.id).distance(34).strength(0.6))
      .force("center", forceCenter(0, 0, 0))
      .force("collide", forceCollide(6))
      .stop();
    const ticks = nodes.length > 800 ? 180 : nodes.length > 300 ? 260 : 360;
    for (let i = 0; i < ticks; i++) sim.tick();

    // ---- NÓS = sprites brilhantes (aditivo -> bloom) ----
    const idToSim = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
      const col = colorFor(n.group);
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color: col,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
      const sp = new THREE.Sprite(mat);
      const size = 3.6 + Math.min(n.deg, 12) * 1.0; // tamanho por grau
      sp.scale.set(size, size, 1);
      sp.position.set(n.x ?? 0, n.y ?? 0, n.z ?? 0);
      sp.userData = { id: n.id, path: n.path, base: size };
      scene.add(sp);
      nodeSprites.push(sp);
      nodeById.set(n.id, { sprite: sp, sim: n, base: col.getHex() });
    }

    // ---- ARESTAS = linhas (sinapses) aditivas, com leve gradiente p/ cor da pasta ----
    const positions: number[] = [];
    const colors: number[] = [];
    const cEdge = new THREE.Color(0xe879f9); // rosa sinapse
    for (const e of valid) {
      const a = idToSim.get(e.source)!;
      const b = idToSim.get(e.target)!;
      positions.push(a.x ?? 0, a.y ?? 0, a.z ?? 0, b.x ?? 0, b.y ?? 0, b.z ?? 0);
      colors.push(cEdge.r, cEdge.g, cEdge.b, cEdge.r, cEdge.g, cEdge.b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const lmat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    edgeLines = new THREE.LineSegments(geom, lmat);
    scene.add(edgeLines);

    fitCamera();
    applyFilter();
  }

  function fitCamera() {
    const box = new THREE.Box3();
    for (const s of nodeSprites) box.expandByPoint(s.position);
    if (nodeSprites.length === 0) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 40);
    const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
    controls.target.copy(sphere.center);
    camera.position.set(sphere.center.x, sphere.center.y, sphere.center.z + dist);
    camera.near = Math.max(dist / 100, 0.5);
    camera.far = dist * 6 + r * 4;
    camera.updateProjectionMatrix();
    controls.update();
  }

  // busca/filtro -> acende os que casam, apaga o resto
  function applyFilter() {
    const q = search.trim().toLowerCase();
    const f = folder;
    const has = q.length > 0 || !!f;
    const matched = new Set<string>();
    if (has) {
      for (const n of rawNodes) {
        const okQ = !q || n.label.toLowerCase().includes(q);
        const okF = !f || n.group === f;
        if (okQ && okF) matched.add(n.id);
      }
    }
    for (const [id, rec] of nodeById) {
      const on = !has || matched.has(id);
      const m = rec.sprite.material as THREE.SpriteMaterial;
      m.opacity = on ? 1 : 0.08;
    }
    if (edgeLines) (edgeLines.material as THREE.LineBasicMaterial).opacity = has ? 0.05 : 0.22;
  }

  function onResize() {
    if (!host || !renderer) return;
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // PICKING EM ESPAÇO DE TELA: projeta cada nó pra 2D e pega o mais próximo do
  // cursor dentro de um raio generoso. O raycaster de Sprite ignora threshold,
  // então com nós pequenos + auto-rotate o acerto virava pixel-perfect; isto
  // resolve (área de acerto fixa em px, independe do tamanho/rotação do nó).
  const _proj = new THREE.Vector3();
  function pickSprite(e: PointerEvent | MouseEvent): THREE.Sprite | null {
    const rect = host.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const HIT = 38; // raio de acerto em px (generoso: fácil acertar a bolinha)
    let best: THREE.Sprite | null = null;
    let bestD = HIT * HIT;
    for (const s of nodeSprites) {
      const m = s.material as THREE.SpriteMaterial;
      if (m.opacity < 0.12) continue; // ignora nós apagados pelo filtro
      _proj.copy(s.position).project(camera);
      if (_proj.z > 1) continue; // atrás da câmera
      const sx = (_proj.x * 0.5 + 0.5) * rect.width;
      const sy = (-_proj.y * 0.5 + 0.5) * rect.height;
      const dx = sx - px;
      const dy = sy - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }
  function pathOf(s: THREE.Sprite | null): string | null {
    return s ? (((s.userData as any)?.path as string) ?? null) : null;
  }

  let autoRotateWanted = true;
  function setHover(s: THREE.Sprite | null) {
    if (s === hovered) return;
    // restaura o nó anterior
    if (hovered) {
      const m = hovered.material as THREE.SpriteMaterial;
      m.opacity = 0.8;
      const b = (hovered.userData as any)?.base as number;
      hovered.scale.set(b, b, 1);
    }
    hovered = s;
    if (s) {
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = 1; // acende
      const b = (s.userData as any)?.base as number;
      s.scale.set(b * 1.35, b * 1.35, 1); // cresce de leve
    }
    if (renderer) renderer.domElement.style.cursor = s ? "pointer" : "grab";
    // pausa o giro automático enquanto o cursor está sobre um nó (não foge do clique)
    if (controls) controls.autoRotate = autoRotateWanted && !s;
  }

  function onPointerMove(e: PointerEvent) {
    if (e.buttons) return; // arrastando (órbita) -> ignora hover
    setHover(pickSprite(e));
  }
  function onPointerLeave() {
    setHover(null);
  }
  function onPointerDown(e: PointerEvent) {
    downXY = { x: e.clientX, y: e.clientY };
    downSprite = pickSprite(e);
    // o usuário assumiu o controle -> para o giro automático de vez (nó não "foge"
    // do clique). Fica parado até ele recarregar/reabrir o grafo.
    autoRotateWanted = false;
    if (controls) controls.autoRotate = false;
    // pressionou EM CIMA de um nó -> não orbita (o gesto é "clicar")
    if (downSprite && controls) controls.enableRotate = false;
  }
  function onPointerUp(e: PointerEvent) {
    if (controls) controls.enableRotate = true;
    // só conta como clique se não arrastou
    const moved = Math.abs(e.clientX - downXY.x) > 5 || Math.abs(e.clientY - downXY.y) > 5;
    if (moved) {
      downSprite = null;
      return;
    }
    // o nó pressionado vale; se soltou ainda em cima de algum, usa esse
    const s = downSprite ?? pickSprite(e);
    downSprite = null;
    // CLIQUE num neurônio -> abre a miniatura INTERATIVA da nota (popover);
    // clique no vazio -> fecha.
    onNodePick?.(pathOf(s), e.clientX, e.clientY);
  }
  function onDblClick(e: MouseEvent) {
    // DUPLO-CLIQUE -> abre a nota de fato (cascata útil)
    const path = pathOf(pickSprite(e));
    if (path) onOpenNote?.(path);
  }

  onMount(() => {
    glowTex = makeGlowTexture();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05030f);
    scene.fog = new THREE.FogExp2(0x05030f, 0.0016);

    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    camera = new THREE.PerspectiveCamera(60, w / h, 0.5, 6000);
    camera.position.set(0, 0, 320);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    host.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.9;
    const reduce =
      typeof document !== "undefined" && document.documentElement.classList.contains("no-anim");
    autoRotateWanted = !reduce;
    controls.autoRotate = autoRotateWanted;
    controls.autoRotateSpeed = 0.35;

    // ---- NEBULOSA: nuvens coloridas (sprites grandes, aditivos, ao fundo) ----
    const cloudTex = makeCloudTexture();
    const nebColors = [0xd946ef, 0x38bdf8, 0x8b5cf6, 0x67e8f9, 0xa855f7];
    const nebPos = [
      [-380, 120, -520], [420, -80, -560], [80, 260, -640],
      [-220, -260, -480], [320, 200, -700],
    ];
    for (let i = 0; i < nebPos.length; i++) {
      const m = new THREE.SpriteMaterial({
        map: cloudTex,
        color: nebColors[i],
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(900, 900, 1);
      s.position.set(nebPos[i][0], nebPos[i][1], nebPos[i][2]);
      s.renderOrder = -10;
      scene.add(s);
    }

    // ---- CAMPO DE ESTRELAS (Points) ----
    const starN = 1400;
    const sp = new Float32Array(starN * 3);
    const sc = new Float32Array(starN * 3);
    const pal = [new THREE.Color(0xffffff), new THREE.Color(0xa5f3fc), new THREE.Color(0xf0abfc), new THREE.Color(0xc4b5fd)];
    for (let i = 0; i < starN; i++) {
      // distribui numa casca esférica grande
      const r = 900 + Math.random() * 1600;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      sp[i * 3 + 2] = r * Math.cos(ph);
      const col = pal[(Math.random() * (Math.random() < 0.85 ? 1 : pal.length)) | 0];
      sc[i * 3] = col.r; sc[i * 3 + 1] = col.g; sc[i * 3 + 2] = col.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
    const sm = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: glowTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(sg, sm);
    stars.renderOrder = -5;
    scene.add(stars);

    // ---- BLOOM (o brilho dos plugins de galáxia) ----
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // bloom CONTIDO: só os núcleos mais brilhantes "estouram" (threshold alto),
    // intensidade baixa -> nós elegantes, cor da pasta preservada (não lava em branco)
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 0.25);
    bloom.threshold = 0.25;
    bloom.strength = 0.45;
    bloom.radius = 0.5;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    buildGraph();
    lastSig = graphSig(); // marca o estado atual p/ o $effect não reconstruir de novo

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("dblclick", onDblClick);
    ro = new ResizeObserver(onResize);
    ro.observe(host);

    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      controls.update();
      composer.render();
    };
    loop();
  });

  // reage a busca/filtro
  $effect(() => {
    search;
    folder;
    if (renderer) applyFilter();
  });

  // reage a recarga de dados — mas só reconstrói se a assinatura mudou
  $effect(() => {
    rawNodes;
    rawEdges;
    if (!renderer || !scene) return;
    const sig = graphSig();
    if (sig === lastSig) return; // dados idênticos -> nada a fazer (sem piscar)
    lastSig = sig;
    buildGraph();
  });

  onDestroy(() => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer?.domElement.removeEventListener("pointerup", onPointerUp);
    renderer?.domElement.removeEventListener("pointermove", onPointerMove);
    renderer?.domElement.removeEventListener("pointerleave", onPointerLeave);
    renderer?.domElement.removeEventListener("dblclick", onDblClick);
    controls?.dispose();
    renderer?.dispose();
    glowTex?.dispose();
  });
</script>

<div class="g3d-wrap" bind:this={host}></div>

<style>
  .g3d-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #05030f;
    cursor: grab;
  }
  .g3d-wrap:active {
    cursor: grabbing;
  }
  .g3d-wrap :global(canvas) {
    display: block;
  }
</style>
