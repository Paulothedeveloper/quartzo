<script lang="ts">
  import { untrack } from "svelte";
  import { Search, RefreshCw, Loader2, X, Share2, Plus, Minus, Maximize } from "@lucide/svelte";
  import { graphData, graphLoading, loadGraph } from "$lib/stores/graph";
  import { currentVaultPath } from "$lib/stores/vault";
  import Graph3D from "./Graph3D.svelte";
  import GraphNotePeek from "./GraphNotePeek.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { isMobile } from "$lib/platform";
  import { t } from "$lib/i18n";

  let { onOpenNote, onClose }: { onOpenNote?: (p: string) => void; onClose?: () => void } =
    $props();

  let search = $state("");
  let folder = $state<string | null>(null);
  // miniatura interativa da nota ao clicar num neurônio (rolável/arrastável/redimensionável)
  let peek = $state<{ path: string; x: number; y: number } | null>(null);
  // ref do Graph3D p/ os botões de zoom (+/−/ajustar) da toolbar flutuante
  let graph3d = $state<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void } | null>(null);

  // Carrega o grafo ao abrir (se ainda não carregado).
  $effect(() => {
    const vp = $currentVaultPath;
    if (vp && !$graphData && !$graphLoading) untrack(() => loadGraph(vp));
  });

  const folders = $derived(
    $graphData ? [...new Set($graphData.nodes.map((n) => n.group))].sort() : []
  );

  async function reload() {
    if ($currentVaultPath) await loadGraph($currentVaultPath);
  }
</script>

<div class="flex h-full flex-col">
  {#if isMobile}
    <!-- Toolbar nativa mobile: cabeçalho próprio + linha de controles em largura total -->
    <div class="shrink-0 border-b border-border bg-surface">
      <div
        class="flex items-center gap-2 px-4 pb-2"
        style="padding-top: calc(env(safe-area-inset-top) + 10px)"
      >
        <Share2 size={17} class="text-accent" />
        <span class="text-base font-bold tracking-tight">{$t("graph.title")}</span>
        {#if $graphData}
          <span class="ml-auto text-xs text-text-muted">
            {$t("graph.notesLinks", {
              notes: $graphData.nodes.length,
              links: $graphData.edges.length,
            })}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2 px-3 pb-2.5">
        <div class="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-elevated px-3 py-2">
          <Search size={15} class="shrink-0 text-text-secondary" />
          <input
            bind:value={search}
            placeholder={$t("graph.highlight")}
            class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-secondary"
          />
        </div>
        <select
          bind:value={folder}
          class="max-w-[26vw] shrink-0 rounded-xl bg-elevated px-2.5 py-2 text-sm text-text-primary outline-none"
        >
          <option value={null}>{$t("graph.allFolders")}</option>
          {#each folders as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>
        <button
          onclick={reload}
          aria-label={$t("graph.reindex")}
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-elevated text-text-secondary active:scale-95"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  {:else}
    <!-- Toolbar -->
    <div class="gv-toolbar flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
      <div class="gv-title flex items-center gap-2 text-sm font-medium">
        <Share2 size={16} class="text-accent" />
        {$t("graph.title")}
      </div>

      {#if $graphData}
        <span class="gv-count text-xs text-text-muted">
          {$t("graph.notesLinks", { notes: $graphData.nodes.length, links: $graphData.edges.length })}
        </span>
      {/if}

      <div class="gv-controls ml-auto flex items-center gap-2">
        <!-- Busca -->
        <div class="gv-search flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5">
          <Search size={14} class="shrink-0 text-text-secondary" />
          <input
            bind:value={search}
            placeholder={$t("graph.highlight")}
            class="w-40 min-w-0 bg-transparent text-sm outline-none placeholder:text-text-secondary"
          />
        </div>

        <!-- Filtro de pasta -->
        <select
          bind:value={folder}
          class="gv-folder min-w-0 rounded-lg bg-elevated px-2 py-1.5 text-sm text-text-primary outline-none"
        >
          <option value={null}>{$t("graph.allFolders")}</option>
          {#each folders as f (f)}
            <option value={f}>{f}</option>
          {/each}
        </select>

        <button
          onclick={reload}
          title={$t("graph.reindex")}
          class="shrink-0 rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <RefreshCw size={15} />
        </button>
        <button
          onclick={() => onClose?.()}
          title={$t("graph.closeGraph")}
          class="gv-close shrink-0 rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  {/if}

  <!-- Canvas -->
  <div class="relative min-h-0 flex-1">
    {#if $graphLoading && !$graphData}
      <!-- overlay cheio SÓ no 1º carregamento; reindexações não desmontam/piscam o grafo -->
      <div
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-bg/50 backdrop-blur-sm"
      >
        <CrystalIllustration size={104} glow={0.6} />
        <div class="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={16} class="animate-spin" /> {$t("graph.indexing")}
        </div>
      </div>
    {:else if !$currentVaultPath}
      <EmptyState title={$t("graph.noVault")} subtitle={$t("graph.noVaultSub")} />
    {:else if $graphData && $graphData.nodes.length === 0}
      <EmptyState title={$t("graph.emptyTitle")} subtitle={$t("graph.emptySub")} />
    {:else if $graphData}
      <Graph3D
        bind:this={graph3d}
        rawNodes={$graphData.nodes}
        rawEdges={$graphData.edges}
        {search}
        {folder}
        {onOpenNote}
        onNodePick={(path, x, y) => (peek = path ? { path, x, y } : null)}
      />
      <!-- Controle de zoom flutuante (estilo Eagle): +/−/ajustar, glass no canto -->
      <div class="gv-zoom">
        <button onclick={() => graph3d?.zoomIn()} title={$t("graph.zoomIn") ?? "Aproximar"} aria-label="zoom in">
          <Plus size={16} />
        </button>
        <button onclick={() => graph3d?.zoomOut()} title={$t("graph.zoomOut") ?? "Afastar"} aria-label="zoom out">
          <Minus size={16} />
        </button>
        <button onclick={() => graph3d?.fitView()} title={$t("graph.fitView") ?? "Ajustar à tela"} aria-label="fit">
          <Maximize size={15} />
        </button>
      </div>
      {#if peek}
        <GraphNotePeek
          path={peek.path}
          x={peek.x}
          y={peek.y}
          onOpen={(p) => {
            peek = null;
            onOpenNote?.(p);
          }}
          onClose={() => (peek = null)}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Controle de zoom flutuante do grafo — pílula glass (estilo Eagle), canto inf. direito */
  .gv-zoom {
    position: absolute;
    right: 14px;
    bottom: 14px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border));
    background: color-mix(in srgb, var(--color-surface) 72%, transparent);
    backdrop-filter: blur(14px) saturate(1.2);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 8px 28px rgba(0, 0, 0, 0.42);
  }
  .gv-zoom button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 34px;
    color: var(--color-text-secondary);
    transition:
      background 0.15s var(--ease-out, ease),
      color 0.15s var(--ease-out, ease),
      transform 0.12s var(--ease-out, ease);
  }
  .gv-zoom button:not(:last-child) {
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  }
  .gv-zoom button:hover {
    background: color-mix(in srgb, var(--color-accent) 14%, transparent);
    color: var(--color-accent-light);
  }
  .gv-zoom button:active {
    transform: scale(0.9);
  }
</style>
