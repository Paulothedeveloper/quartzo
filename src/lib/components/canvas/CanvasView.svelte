<script lang="ts">
  import { setContext, untrack } from "svelte";
  import { get } from "svelte/store";
  import { SvelteFlow, Background, Controls, addEdge, type Node, type Edge } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { Plus, X, Frame, Image as ImageIcon, Pipette, LayoutGrid } from "@lucide/svelte";
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { currentVaultPath } from "$lib/stores/vault";
  import { showToast } from "$lib/stores/toast";
  import { pickColor, eyedropperSupported } from "$lib/color";
  import { debounce } from "$lib/utils/debounce";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import CardNode from "./CardNode.svelte";
  import ImageNode from "./ImageNode.svelte";
  import SwatchNode from "./SwatchNode.svelte";

  let { onClose }: { onClose?: () => void } = $props();

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let loaded = $state(false);
  let seq = 0;

  const nodeTypes = { card: CardNode, image: ImageNode, swatch: SwatchNode };

  // ---- helpers de imagem ----
  function fit(w: number, h: number, max = 280): { w: number; h: number } {
    if (w <= max && h <= max) return { w, h };
    const r = w > h ? max / w : max / h;
    return { w: Math.round(w * r), h: Math.round(h * r) };
  }
  function getImageSize(url: string): Promise<{ w: number; h: number }> {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth || 240, h: im.naturalHeight || 180 });
      im.onerror = () => rej(new Error("load"));
      im.src = url;
    });
  }
  function blobToB64(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        const i = s.indexOf(",");
        res(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  function canvasPath(): string | null {
    const v = get(currentVaultPath);
    return v ? `${v}/.quartzo-canvas.json` : null;
  }

  const save = debounce(async () => {
    const path = canvasPath();
    if (!path) return;
    const data = {
      version: 2,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        width: n.width,
        height: n.height,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    try {
      await invoke("write_file", { path, content: JSON.stringify(data, null, 2) });
    } catch {
      /* ignora */
    }
  }, 600);

  setContext("qcanvas", {
    update(id: string, text: string) {
      nodes = nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n));
      save();
    },
    remove(id: string) {
      nodes = nodes.filter((n) => n.id !== id);
      edges = edges.filter((e) => e.source !== id && e.target !== id);
      save();
    },
    src: (p: string) => convertFileSrc(p),
    saveNow: () => save(),
    copy: (t: string) => {
      navigator.clipboard.writeText(t).then(() => showToast("Copiado", "success")).catch(() => {});
    },
  });

  const EDGE_STYLE = "stroke:#67e8f9;stroke-width:2";

  function onconnect(conn: any) {
    edges = addEdge({ ...conn, type: "bezier", style: EDGE_STYLE }, edges);
    save();
  }

  function addCard() {
    seq++;
    const id = `card-${Date.now()}-${seq}`;
    nodes = [
      ...nodes,
      { id, type: "card", position: { x: 60 + (seq % 5) * 36, y: 60 + (seq % 5) * 36 }, data: { text: "" } },
    ];
    save();
  }

  async function pushImageNode(srcPath: string) {
    const url = convertFileSrc(srcPath);
    const { w, h } = await getImageSize(url).catch(() => ({ w: 240, h: 180 }));
    const sz = fit(w, h);
    seq++;
    nodes = [
      ...nodes,
      {
        id: `img-${Date.now()}-${seq}`,
        type: "image",
        position: { x: 100 + (seq % 6) * 28, y: 100 + (seq % 6) * 28 },
        data: { src: srcPath },
        width: sz.w,
        height: sz.h,
      },
    ];
    save();
  }

  async function addImage() {
    const sel = await openDialog({
      multiple: false,
      title: "Escolher imagem",
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"] }],
    });
    if (typeof sel !== "string") return;
    await pushImageNode(sel);
  }

  // Colar (Ctrl+V) ou arrastar imagens -> salva no vault e adiciona ao moodboard.
  async function addImageFromBlob(blob: Blob) {
    const vault = get(currentVaultPath);
    if (!vault) return;
    try {
      const b64 = await blobToB64(blob);
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const path = await invoke<string>("save_canvas_image", { vault, b64, ext });
      await pushImageNode(path);
      showToast("Imagem adicionada", "success");
    } catch (e) {
      showToast(`Erro ao colar imagem: ${e}`, "error");
    }
  }

  async function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          await addImageFromBlob(f);
        }
      }
    }
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }
  async function onDrop(e: DragEvent) {
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    e.preventDefault();
    for (const f of Array.from(files)) if (f.type.startsWith("image/")) await addImageFromBlob(f);
  }

  // Swatch de cor (conta-gotas) pro moodboard.
  async function addSwatch() {
    if (!eyedropperSupported()) {
      showToast("Conta-gotas não suportado neste sistema", "info");
      return;
    }
    const hex = await pickColor();
    if (!hex) return;
    seq++;
    nodes = [
      ...nodes,
      {
        id: `sw-${Date.now()}-${seq}`,
        type: "swatch",
        position: { x: 100 + (seq % 6) * 30, y: 100 + (seq % 6) * 30 },
        data: { color: hex },
      },
    ];
    save();
  }

  // Auto-organizar em grade.
  function autoArrange() {
    if (!nodes.length) return;
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const cellW = 300;
    const cellH = 260;
    nodes = nodes.map((n, i) => ({
      ...n,
      position: { x: (i % cols) * cellW + 40, y: Math.floor(i / cols) * cellH + 40 },
    }));
    save();
  }

  $effect(() => {
    untrack(async () => {
      const path = canvasPath();
      if (!path) {
        loaded = true;
        return;
      }
      try {
        const txt = await invoke<string>("read_file", { path });
        const parsed = JSON.parse(txt);
        nodes = (parsed.nodes ?? []).map((n: any) => {
          const base: Node = {
            id: n.id,
            type: n.type ?? "card",
            position: n.position,
            data: n.data ?? { text: "" },
          };
          if (n.width) base.width = n.width;
          if (n.height) base.height = n.height;
          if (n.type === "image" && !n.width) {
            base.width = 240;
            base.height = 180;
          }
          return base;
        });
        edges = (parsed.edges ?? []).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: "bezier",
          style: EDGE_STYLE,
        }));
        seq = nodes.length;
      } catch {
        nodes = [];
        edges = [];
      }
      loaded = true;
    });
  });
</script>

<svelte:window onpaste={onPaste} />

<div class="flex h-full flex-col">
  <!-- Toolbar -->
  <div class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
    <div class="flex items-center gap-2 text-sm font-medium">
      <Frame size={16} class="text-accent" /> Canvas
    </div>
    <span class="text-xs text-text-muted">{nodes.length} itens · {edges.length} conexões</span>
    <div class="ml-auto flex items-center gap-2">
      {#if nodes.length > 1}
        <button
          onclick={autoArrange}
          title="Organizar em grade"
          class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-[0.97]"
        >
          <LayoutGrid size={15} /> Organizar
        </button>
      {/if}
      <button
        onclick={addSwatch}
        title="Adicionar cor (conta-gotas)"
        class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm font-medium text-text-primary transition-all hover:bg-elevated/70 active:scale-[0.97]"
      >
        <Pipette size={15} /> Cor
      </button>
      <button
        onclick={addImage}
        class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm font-medium text-text-primary transition-all hover:bg-elevated/70 active:scale-[0.97]"
      >
        <ImageIcon size={15} /> Imagem
      </button>
      <button
        onclick={addCard}
        class="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
      >
        <Plus size={15} /> Card de texto
      </button>
      <button
        onclick={() => onClose?.()}
        title="Fechar canvas"
        class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <X size={16} />
      </button>
    </div>
  </div>

  <!-- Canvas -->
  <div class="relative min-h-0 flex-1" role="application" ondragover={onDragOver} ondrop={onDrop}>
    {#if !$currentVaultPath}
      <EmptyState title="Nenhum vault aberto" subtitle="Abra um vault para usar o Canvas." />
    {:else if loaded && nodes.length === 0}
      <div class="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
        <div class="rounded-2xl border border-border/60 bg-surface/40 px-5 py-3 text-center backdrop-blur-sm">
          <p class="text-sm text-text-secondary">
            Um quadro infinito para suas ideias.
          </p>
          <p class="mt-0.5 text-xs text-text-muted">
            <span class="text-accent-light">Cole</span> (Ctrl+V) ou
            <span class="text-accent-light">arraste</span> imagens, adicione cards e cores —
            arraste das bordas para conectar
          </p>
        </div>
      </div>
    {/if}
    {#if $currentVaultPath}
      <SvelteFlow
        bind:nodes
        bind:edges
        {nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.1}
        maxZoom={3}
        deleteKey={null}
        nodesConnectable
        {onconnect}
        onnodedragstop={() => save()}
        onedgeclick={(e: any) => {
          const id = e?.edge?.id;
          if (!id) return;
          edges = edges.filter((x) => x.id !== id);
          save();
        }}
      >
        <Background bgColor="#0a0f1c" patternColor="#172234" gap={30} size={1} />
        <Controls showLock={false} />
      </SvelteFlow>
    {/if}
  </div>
</div>

<style>
  :global(.svelte-flow__controls) {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.45);
    margin: 14px;
  }
  :global(.svelte-flow__controls-button) {
    background: rgba(28, 37, 54, 0.72);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    color: #cbd5e1;
    width: 28px;
    height: 28px;
    transition: all 0.15s var(--ease-out, ease);
  }
  :global(.svelte-flow__controls-button:hover) {
    background: var(--color-accent);
    color: #06121a;
  }
  :global(.svelte-flow__controls-button svg) {
    fill: currentColor;
  }
</style>
