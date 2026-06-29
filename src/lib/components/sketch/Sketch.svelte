<script lang="ts">
  import { untrack } from "svelte";
  import { get } from "svelte/store";
  import getStroke from "perfect-freehand";
  import { save } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import { Pencil, Eraser, Undo2, Trash2, Download, X, Minus, Plus } from "@lucide/svelte";
  import { currentVaultPath } from "$lib/stores/vault";
  import { showToast } from "$lib/stores/toast";
  import { debounce } from "$lib/utils/debounce";

  let { onClose }: { onClose?: () => void } = $props();

  interface Stroke {
    points: number[][]; // [x, y, pressure]
    color: string;
    size: number;
  }

  const COLORS = ["#67E8F9", "#A5F3FC", "#818CF8", "#F472B6", "#FBBF24", "#34D399", "#F1F5F9", "#0F172A"];
  let color = $state(COLORS[0]);
  let size = $state(6);
  let tool = $state<"pen" | "eraser">("pen");

  let strokes = $state<Stroke[]>([]);
  let current = $state<Stroke | null>(null);
  let drawing = false;
  let loaded = $state(false);

  const BG = "#0a0f1c";
  function sketchPath(): string | null {
    const v = get(currentVaultPath);
    return v ? `${v}/.quartzo/sketch.json` : null;
  }

  const persist = debounce(async () => {
    const path = sketchPath();
    if (!path) return;
    try {
      await invoke("write_file", { path, content: JSON.stringify({ version: 1, strokes }) });
    } catch {
      /* ignora */
    }
  }, 600);

  $effect(() => {
    untrack(async () => {
      const path = sketchPath();
      if (path) {
        try {
          const raw = await invoke<string>("read_file", { path });
          strokes = JSON.parse(raw).strokes ?? [];
        } catch {
          strokes = [];
        }
      }
      loaded = true;
    });
  });

  // ---- Geometria do traço (perfect-freehand) ----
  function toPath(points: number[][], strokeSize: number): string {
    const outline = getStroke(points, {
      size: strokeSize,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
    });
    if (!outline.length) return "";
    const d = outline.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ["M", ...outline[0], "Q"] as (string | number)[]
    );
    d.push("Z");
    return d.join(" ");
  }

  function pos(e: PointerEvent): number[] {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
  }

  function eraseAt(x: number, y: number) {
    const r = size * 2 + 8;
    const before = strokes.length;
    strokes = strokes.filter(
      (s) => !s.points.some((p) => Math.hypot(p[0] - x, p[1] - y) < r)
    );
    if (strokes.length !== before) persist();
  }

  function onDown(e: PointerEvent) {
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    drawing = true;
    const p = pos(e);
    if (tool === "eraser") {
      eraseAt(p[0], p[1]);
      return;
    }
    current = { points: [p], color, size };
  }
  function onMove(e: PointerEvent) {
    if (!drawing) return;
    const p = pos(e);
    if (tool === "eraser") {
      eraseAt(p[0], p[1]);
      return;
    }
    if (current) current = { ...current, points: [...current.points, p] };
  }
  function onUp() {
    drawing = false;
    if (current && current.points.length) {
      strokes = [...strokes, current];
      persist();
    }
    current = null;
  }

  function undo() {
    strokes = strokes.slice(0, -1);
    persist();
  }
  function clear() {
    strokes = [];
    current = null;
    persist();
  }

  async function exportSvg() {
    if (!strokes.length) {
      showToast("Desenhe algo primeiro", "info");
      return;
    }
    const xs = strokes.flatMap((s) => s.points.map((p) => p[0]));
    const ys = strokes.flatMap((s) => s.points.map((p) => p[1]));
    const pad = 24;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad;
    const h = Math.max(...ys) - minY + pad;
    const paths = strokes
      .map((s) => `<path d="${toPath(s.points, s.size)}" fill="${s.color}"/>`)
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${BG}"/>${paths}</svg>`;
    try {
      const path = await save({
        defaultPath: "desenho.svg",
        filters: [{ name: "SVG", extensions: ["svg"] }],
      });
      if (!path) return;
      await invoke("write_file", { path, content: svg });
      showToast("Desenho exportado (SVG)", "success");
    } catch (e) {
      showToast(`Erro ao exportar: ${e}`, "error");
    }
  }
</script>

<div class="flex h-full flex-col">
  <!-- Toolbar -->
  <div class="q-tooltop flex min-h-12 shrink-0 flex-wrap items-center gap-y-2 gap-x-3 border-b border-border px-4 py-2">
    <div class="flex shrink-0 items-center gap-2 text-sm font-medium">
      <Pencil size={16} class="text-accent" /> Rascunho
    </div>
    <div class="ml-2 flex items-center gap-1">
      {#each COLORS as c (c)}
        <button
          onclick={() => {
            color = c;
            tool = "pen";
          }}
          title={c}
          aria-label={c}
          class="h-5 w-5 rounded-full border transition-transform hover:scale-110 {color === c &&
          tool === 'pen'
            ? 'border-white ring-2 ring-accent'
            : 'border-white/20'}"
          style="background:{c}"
        ></button>
      {/each}
    </div>

    <div class="ml-2 flex items-center gap-1">
      <button onclick={() => (size = Math.max(2, size - 2))} title="Menor" class="qtool"><Minus size={15} /></button>
      <span class="w-6 text-center text-xs text-text-secondary">{size}</span>
      <button onclick={() => (size = Math.min(40, size + 2))} title="Maior" class="qtool"><Plus size={15} /></button>
    </div>

    <button onclick={() => (tool = "pen")} title="Caneta" class="qtool {tool === 'pen' ? 'on' : ''}"><Pencil size={16} /></button>
    <button onclick={() => (tool = "eraser")} title="Borracha" class="qtool {tool === 'eraser' ? 'on' : ''}"><Eraser size={16} /></button>
    <button onclick={undo} title="Desfazer" class="qtool" disabled={!strokes.length}><Undo2 size={16} /></button>
    <button onclick={clear} title="Limpar tudo" class="qtool" disabled={!strokes.length}><Trash2 size={16} /></button>

    <div class="ml-auto flex items-center gap-2">
      <span class="text-xs text-text-muted">{strokes.length} traços</span>
      <button
        onclick={exportSvg}
        class="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
      >
        <Download size={15} /> Exportar SVG
      </button>
      <button onclick={() => onClose?.()} title="Fechar" class="qtool"><X size={16} /></button>
    </div>
  </div>

  <!-- Superfície -->
  <div class="relative min-h-0 flex-1">
    {#if loaded && strokes.length === 0 && !current}
      <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <p class="text-sm text-text-muted">Desenhe com o mouse ou caneta — perfeito pra esboços e diagramas à mão.</p>
      </div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      class="sketch-surface h-full w-full touch-none"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointerleave={onUp}
    >
      {#each strokes as s, i (i)}
        <path d={toPath(s.points, s.size)} fill={s.color} />
      {/each}
      {#if current}
        <path d={toPath(current.points, current.size)} fill={current.color} />
      {/if}
    </svg>
  </div>
</div>

<style>
  .sketch-surface {
    cursor: crosshair;
    background-color: #0a0f1c;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  :global(html.theme-light) .sketch-surface {
    background-color: #f6f8fb;
  }
  .qtool {
    display: grid;
    place-items: center;
    padding: 7px;
    border-radius: 9px;
    color: var(--color-text-secondary);
    transition: background 0.14s var(--ease-out, ease), color 0.14s var(--ease-out, ease);
  }
  .qtool:hover {
    background: var(--color-elevated);
    color: var(--color-text-primary);
  }
  .qtool:disabled {
    opacity: 0.4;
  }
  .qtool.on {
    background: rgba(103, 232, 249, 0.15);
    color: var(--color-accent-light);
  }
</style>
