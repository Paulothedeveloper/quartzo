<script lang="ts">
  import { untrack } from "svelte";
  import { Search, RefreshCw, Loader2, X, Share2 } from "@lucide/svelte";
  import { graphData, graphLoading, loadGraph } from "$lib/stores/graph";
  import { currentVaultPath } from "$lib/stores/vault";
  import GraphCanvas from "./GraphCanvas.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t } from "$lib/i18n";

  let { onOpenNote, onClose }: { onOpenNote?: (p: string) => void; onClose?: () => void } =
    $props();

  let search = $state("");
  let folder = $state<string | null>(null);

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
  <!-- Toolbar -->
  <div class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
    <div class="flex items-center gap-2 text-sm font-medium">
      <Share2 size={16} class="text-accent" />
      {$t("graph.title")}
    </div>

    {#if $graphData}
      <span class="text-xs text-text-muted">
        {$t("graph.notesLinks", { notes: $graphData.nodes.length, links: $graphData.edges.length })}
      </span>
    {/if}

    <div class="ml-auto flex items-center gap-2">
      <!-- Busca -->
      <div class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5">
        <Search size={14} class="text-text-secondary" />
        <input
          bind:value={search}
          placeholder={$t("graph.highlight")}
          class="w-40 bg-transparent text-sm outline-none placeholder:text-text-secondary"
        />
      </div>

      <!-- Filtro de pasta -->
      <select
        bind:value={folder}
        class="rounded-lg bg-elevated px-2 py-1.5 text-sm text-text-primary outline-none"
      >
        <option value={null}>{$t("graph.allFolders")}</option>
        {#each folders as f (f)}
          <option value={f}>{f}</option>
        {/each}
      </select>

      <button
        onclick={reload}
        title={$t("graph.reindex")}
        class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <RefreshCw size={15} />
      </button>
      <button
        onclick={() => onClose?.()}
        title={$t("graph.closeGraph")}
        class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <X size={16} />
      </button>
    </div>
  </div>

  <!-- Canvas -->
  <div class="relative min-h-0 flex-1">
    {#if $graphLoading}
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
      <GraphCanvas
        rawNodes={$graphData.nodes}
        rawEdges={$graphData.edges}
        {search}
        {folder}
        {onOpenNote}
      />
    {/if}
  </div>
</div>
