<script lang="ts">
  import {
    FolderOpen,
    FilePlus,
    Search,
    RefreshCw,
    Share2,
    Settings as SettingsIcon,
    PanelLeftClose,
    PanelLeft,
    Sparkles,
    Frame,
    ChevronsUpDown,
    FolderPlus,
    Hash,
    CalendarDays,
    Check,
    GitBranch,
    Pencil,
    ExternalLink,
    ClipboardCopy,
  } from "@lucide/svelte";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath, fileTree } from "$lib/stores/vault";
  import { showToast } from "$lib/stores/toast";
  import { showGraph, showCanvas, showSketch, sidebarCollapsed, settingsOpen, memoryOpen, searchRequest, gitOpen, ctxMenu, type CtxMenuItem } from "$lib/stores/ui";
  import { getRecentVaults } from "$lib/stores/settings";
  import { setVault, refreshTree, createNoteIn, createFolderIn, openDailyNote } from "$lib/vault-actions";
  import type { FileNode } from "$lib/types";
  import FileTree from "./FileTree.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import QuartzIcon from "$lib/components/ui/QuartzIcon.svelte";
  import { slide, fly } from "svelte/transition";
  import { t, tr } from "$lib/i18n";

  let search = $state("");
  const vaultName = $derived(
    $currentVaultPath ? ($currentVaultPath.split(/[\\/]/).pop() ?? "VAULT") : "VAULT"
  );

  async function openVault() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: tr("sidebar.selectVaultFolder"),
    });
    if (typeof selected !== "string") return;
    await setVault(selected);
    showToast(tr("sidebar.vaultOpened"), "success");
  }

  // Menu com os vaults conhecidos (igual ao seletor do Obsidian).
  function openVaultMenu(e: MouseEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const current = $currentVaultPath;
    const items: CtxMenuItem[] = [];
    // Ações do vault atual (igual ao Obsidian: clique-direito no nome do vault)
    if (current) {
      items.push(
        {
          label: tr("vault.showInFolder"),
          icon: ExternalLink,
          action: () =>
            revealItemInDir(current).catch(() => showToast(tr("settings.toast.openFolderFail"), "error")),
        },
        {
          label: tr("vault.copyPath"),
          icon: ClipboardCopy,
          action: async () => {
            try {
              await navigator.clipboard.writeText(current);
              showToast(tr("settings.toast.pathCopied"), "success");
            } catch {
              showToast(tr("settings.toast.copyFail"), "error");
            }
          },
        },
        { separator: true },
      );
    }
    const recents = getRecentVaults();
    for (const v of recents) {
      items.push({
        label: v.split(/[\\/]/).pop() ?? v,
        icon: v === current ? Check : QuartzIcon,
        action: () => {
          if (v !== current) setVault(v).then(() => showToast(tr("sidebar.vaultOpened"), "success"));
        },
      });
    }
    if (recents.length) items.push({ separator: true });
    items.push({ label: tr("vault.openOther"), icon: FolderPlus, action: openVault });
    ctxMenu.set({ x: rect.left, y: rect.bottom + 4, items });
  }

  function newNote() {
    if (!$currentVaultPath) return showToast("Abra um vault primeiro", "info");
    createNoteIn($currentVaultPath);
  }
  function newFolder() {
    if (!$currentVaultPath) return showToast("Abra um vault primeiro", "info");
    createFolderIn($currentVaultPath);
  }

  // ---- Tags ----
  let tags = $state<{ tag: string; count: number }[]>([]);
  let tagsOpen = $state(false);
  async function loadTags() {
    if (!$currentVaultPath) return;
    try {
      tags = await invoke<{ tag: string; count: number }[]>("list_tags", {
        vaultPath: $currentVaultPath,
      });
    } catch {
      tags = [];
    }
  }
  function toggleTags() {
    tagsOpen = !tagsOpen;
    if (tagsOpen) loadTags();
  }

  function flatten(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
    for (const n of nodes) {
      if (!n.is_dir) acc.push(n);
      if (n.children) flatten(n.children, acc);
    }
    return acc;
  }

  const searchResults = $derived(
    search.trim()
      ? flatten($fileTree).filter((n) => n.name.toLowerCase().includes(search.trim().toLowerCase()))
      : []
  );
</script>

{#if $sidebarCollapsed}
  <!-- ===== Rail recolhido (64px) ===== -->
  <div class="flex h-full w-full flex-col items-center py-3">
    <CrystalIllustration size={34} glow={0.5} float={false} />
    <div class="mt-4 flex flex-col gap-2">
      <button onclick={newNote} title="Nova nota" class="rounded-lg bg-accent p-2 text-bg transition-colors hover:bg-accent-hover">
        <FilePlus size={18} />
      </button>
      <button onclick={openVault} title="Abrir vault" class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary">
        <FolderOpen size={18} />
      </button>
    </div>
    <div class="mt-auto flex flex-col gap-2">
      <button
        onclick={() => memoryOpen.set(true)}
        title="Nova Memória do Claude (Ctrl+Shift+M)"
        class="rounded-lg p-2 text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-95"
      >
        <Sparkles size={18} />
      </button>
      <button
        onclick={() => showGraph.update((v) => !v)}
        title="Grafo (Ctrl+G)"
        class="rounded-lg p-2 transition-all active:scale-95 {$showGraph ? 'bg-accent text-bg' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <Share2 size={18} />
      </button>
      <button onclick={() => settingsOpen.set(true)} title="Configurações (Ctrl+,)" class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary">
        <SettingsIcon size={18} />
      </button>
      <button onclick={() => sidebarCollapsed.set(false)} title="Expandir" class="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary">
        <PanelLeft size={18} />
      </button>
    </div>
  </div>
{:else}
  <!-- ===== Sidebar completa (280px) ===== -->
  <div class="flex h-full w-full flex-col">
    <!-- Header -->
    <div class="flex items-center px-4 pb-1 pt-3">
      <span class="text-xs font-semibold uppercase tracking-wider text-text-muted">Explorador</span>
      <button
        onclick={() => sidebarCollapsed.set(true)}
        title="Recolher (Ctrl+\)"
        class="ml-auto rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <PanelLeftClose size={17} />
      </button>
    </div>

    <!-- Ações -->
    <div class="flex gap-2 px-3 pb-3">
      <button
        onclick={newNote}
        class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-bg shadow-[0_2px_12px_rgba(103,232,249,0.18)] transition-all hover:bg-accent-hover active:scale-[0.98]"
      >
        <FilePlus size={16} /> Nova nota
      </button>
      <button
        onclick={newFolder}
        title="Nova pasta"
        class="rounded-xl px-3 py-2.5 text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-[0.97]"
      >
        <FolderPlus size={18} />
      </button>
      <button
        onclick={openVault}
        title="Abrir vault"
        class="rounded-xl px-3 py-2.5 text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-[0.97]"
      >
        <FolderOpen size={18} />
      </button>
    </div>

    <!-- Busca -->
    <div class="px-3 pb-2">
      <div class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5">
        <Search size={15} class="text-text-secondary" />
        <input
          bind:value={search}
          placeholder="Buscar arquivos..."
          class="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
        />
      </div>
    </div>

    <!-- Cabeçalho da lista -->
    <div class="flex items-center gap-1 px-2.5 py-1">
      <button
        onclick={openVaultMenu}
        title="Trocar de vault"
        class="group flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-elevated"
      >
        <span
          class="truncate text-xs font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary"
          >{vaultName}</span
        >
        <ChevronsUpDown size={12} class="shrink-0 text-text-muted" />
      </button>
      {#if $currentVaultPath}
        <button
          onclick={refreshTree}
          title="Atualizar"
          class="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <RefreshCw size={13} />
        </button>
      {/if}
    </div>

    <!-- Lista / árvore -->
    <div class="flex-1 overflow-auto px-2 pb-2">
      {#if !$currentVaultPath}
        <EmptyState
          title="Nenhum vault aberto"
          subtitle="Abra uma pasta com notas em Markdown."
          crystal={false}
          compact
        >
          <button
            onclick={openVault}
            class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
          >
            Abrir vault
          </button>
        </EmptyState>
      {:else if search.trim()}
        {#if searchResults.length}
          <FileTree nodes={searchResults} />
        {:else}
          <div class="px-3 py-6 text-center text-sm text-text-secondary">Nada encontrado</div>
        {/if}
      {:else}
        <FileTree nodes={$fileTree} />
      {/if}
    </div>

    <!-- Tags -->
    {#if $currentVaultPath}
      <div class="border-t border-border px-2 pt-1">
        <button
          onclick={toggleTags}
          class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
        >
          <Hash size={13} />
          Tags
          <span class="ml-auto text-text-muted">{tagsOpen ? "▾" : "▸"}</span>
        </button>
        {#if tagsOpen}
          <div
            class="flex max-h-40 flex-wrap gap-1.5 overflow-auto px-2 pb-2 pt-1"
            transition:slide={{ duration: 180 }}
          >
            {#each tags as t, i (t.tag)}
              <button
                onclick={() => searchRequest.set("#" + t.tag)}
                in:fly={{ y: 4, duration: 160, delay: Math.min(i * 18, 220) }}
                class="flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-xs text-accent-light transition-colors hover:bg-accent hover:text-bg"
              >
                #{t.tag}<span class="opacity-60">{t.count}</span>
              </button>
            {:else}
              <span class="px-1 py-1 text-xs text-text-muted">Nenhuma tag encontrada</span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Seção inferior fixa -->
    <div class="mt-auto flex flex-col gap-1 border-t border-border p-2">
      <button
        onclick={openDailyNote}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-[0.99]"
      >
        <CalendarDays size={16} /> Nota do dia
      </button>
      <button
        onclick={() => memoryOpen.set(true)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-all hover:bg-elevated hover:text-text-primary active:scale-[0.99]"
      >
        <Sparkles size={16} class="text-accent" /> Nova Memória do Claude
      </button>
      <button
        onclick={() => showGraph.update((v) => !v)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all active:scale-[0.99] {$showGraph
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <Share2 size={16} /> Grafo
      </button>
      <button
        onclick={() => showCanvas.update((v) => !v)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all active:scale-[0.99] {$showCanvas
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <Frame size={16} /> Canvas
      </button>
      <button
        onclick={() => showSketch.update((v) => !v)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all active:scale-[0.99] {$showSketch
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <Pencil size={16} /> Rascunho
      </button>
      <button
        onclick={() => gitOpen.update((v) => !v)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all active:scale-[0.99] {$gitOpen
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <GitBranch size={16} /> Versões (Git)
      </button>
      <button
        onclick={() => settingsOpen.set(true)}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <SettingsIcon size={16} /> Configurações
      </button>
    </div>
  </div>
{/if}
