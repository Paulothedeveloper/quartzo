<script lang="ts">
  import { fly } from "svelte/transition";
  import {
    Files,
    Search,
    Share2,
    Menu as MenuIcon,
    Plus,
    Settings as SettingsIcon,
    FolderPlus,
    FolderOpen,
    Settings2,
    Table2,
    Compass,
    CopyX,
    CalendarDays,
    Sparkles,
    Frame,
    Pencil,
    GitBranch,
    BookOpen,
  } from "@lucide/svelte";
  import { currentVaultPath } from "$lib/stores/vault";
  import { activeTabPath } from "$lib/stores/tabs";
  import {
    showGraph,
    showCanvas,
    showSketch,
    settingsOpen,
    memoryOpen,
    vaultManagerOpen,
    basesOpen,
    insightsOpen,
    duplicatesOpen,
    tutorialOpen,
  } from "$lib/stores/ui";
  import { createNoteIn, newNoteDir, openDailyNote, openNote } from "$lib/vault-actions";
  import WelcomeScreen from "./WelcomeScreen.svelte";
  import MobileEditor from "$lib/mobile/MobileEditor.svelte";
  import MobileNoteList from "$lib/mobile/MobileNoteList.svelte";
  import MobileSearch from "$lib/mobile/MobileSearch.svelte";
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import CanvasView from "$lib/components/canvas/CanvasView.svelte";
  import Sketch from "$lib/components/sketch/Sketch.svelte";
  import { t, tr } from "$lib/i18n";

  let { onOpenVault, onCreateVault }: { onOpenVault?: () => void; onCreateVault?: () => void } = $props();

  type Tab = "notes" | "search" | "graph" | "more";
  let tab = $state<Tab>("notes");
  let viewingNote = $state(false); // notas: lista vs editor em tela cheia

  // Abrir nota -> entra no editor full-screen (na aba Notas).
  $effect(() => {
    if ($activeTabPath) {
      viewingNote = true;
    }
  });


  function newNote() {
    if (!$currentVaultPath) return;
    createNoteIn(newNoteDir());
    // createNoteIn abre a nota -> activeTabPath muda -> viewingNote = true (effect)
  }

  function go(t: Tab) {
    tab = t;
    if (t !== "notes") viewingNote = false;
    // grafo/canvas são telas próprias do app
    showGraph.set(t === "graph");
    if (t !== "graph") {
      showCanvas.set(false);
      showSketch.set(false);
    }
    // a aba "Buscar" tem tela nativa própria (MobileSearch) — não abre o modal.
  }

  function backToList() {
    viewingNote = false;
  }

  interface MoreItem {
    label: string;
    icon: any;
    action: () => void;
    show?: boolean;
  }
  const moreItems = $derived<MoreItem[]>([
    { label: tr("titlebar.dailyNote"), icon: CalendarDays, action: openDailyNote, show: !!$currentVaultPath },
    { label: tr("sidebar.newMemory"), icon: Sparkles, action: () => memoryOpen.set(true), show: !!$currentVaultPath },
    { label: "Canvas", icon: Frame, action: () => { showCanvas.set(true); tab = "graph"; }, show: !!$currentVaultPath },
    { label: tr("sidebar.sketch"), icon: Pencil, action: () => { showSketch.set(true); tab = "graph"; }, show: !!$currentVaultPath },
    { label: tr("bases.menu"), icon: Table2, action: () => basesOpen.set(true), show: !!$currentVaultPath },
    { label: tr("insights.menu"), icon: Compass, action: () => insightsOpen.set(true), show: !!$currentVaultPath },
    { label: tr("dup.menu"), icon: CopyX, action: () => duplicatesOpen.set(true), show: !!$currentVaultPath },
    { label: tr("vault.create"), icon: FolderPlus, action: () => onCreateVault?.() },
    { label: tr("welcome.openVault"), icon: FolderOpen, action: () => onOpenVault?.() },
    { label: tr("vault.manage"), icon: Settings2, action: () => vaultManagerOpen.set(true) },
    { label: tr("cmd.show-tutorial"), icon: BookOpen, action: () => tutorialOpen.set(true) },
    { label: tr("common.settings"), icon: SettingsIcon, action: () => settingsOpen.set(true) },
  ]);

  const NAV: { id: Tab; icon: any; label: string }[] = [
    { id: "notes", icon: Files, label: tr("mobile.notes") },
    { id: "search", icon: Search, label: tr("mobile.search") },
    { id: "graph", icon: Share2, label: tr("graph.title") },
    { id: "more", icon: MenuIcon, label: tr("mobile.more") },
  ];
</script>

<div class="msh">
  <!-- ===== CONTEÚDO ===== -->
  <div class="msh-body">
    {#if !$currentVaultPath}
      <WelcomeScreen {onOpenVault} {onCreateVault} />
    {:else if tab === "notes"}
      {#if viewingNote && $activeTabPath}
        <!-- Editor nativo (casca própria + barra de formatação acima do teclado) -->
        <MobileEditor onBack={backToList} />
      {:else}
        <!-- Lista de notas nativa (drill-down + long-press) -->
        <MobileNoteList onOpen={(p) => openNote(p)} />
      {/if}
    {:else if tab === "search"}
      <!-- Busca nativa em tela cheia -->
      <MobileSearch onOpen={(p) => { openNote(p); tab = "notes"; }} />
    {:else if tab === "graph"}
      <div class="msh-fill">
        {#if $showCanvas}
          <CanvasView onClose={() => { showCanvas.set(false); go("notes"); }} />
        {:else if $showSketch}
          <Sketch onClose={() => { showSketch.set(false); go("notes"); }} />
        {:else}
          <GraphView onOpenNote={(p) => { openNote(p); go("notes"); }} onClose={() => go("notes")} />
        {/if}
      </div>
    {:else if tab === "more"}
      <div class="msh-topbar"><span class="msh-vault">{$t("mobile.more")}</span></div>
      <div class="msh-more">
        {#each moreItems.filter((m) => m.show !== false) as m (m.label)}
          {@const Icon = m.icon}
          <button class="msh-more-item" onclick={m.action}>
            <Icon size={18} /> <span>{m.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- FAB nova nota (só na lista de notas) -->
  {#if $currentVaultPath && tab === "notes" && !viewingNote}
    <button class="msh-fab" onclick={newNote} aria-label={$t("titlebar.newNote")} transition:fly={{ y: 12, duration: 180 }}>
      <Plus size={24} />
    </button>
  {/if}

  <!-- ===== BARRA DE ABAS ===== -->
  <nav class="msh-nav">
    {#each NAV as n (n.id)}
      {@const Icon = n.icon}
      <button class="msh-tab" class:on={tab === n.id && !(n.id === "notes" && viewingNote)} onclick={() => go(n.id)}>
        <Icon size={21} />
        <span>{n.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .msh {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    width: 100%;
    background: var(--color-bg);
    overflow: hidden;
  }
  .msh-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .msh-topbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: auto;
    min-height: 50px;
    padding: calc(env(safe-area-inset-top) + 8px) 14px 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .msh-vault {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }
  .msh-back {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    margin-left: -6px;
    border-radius: 9px;
    color: var(--color-text-secondary);
  }
  .msh-back:active { background: var(--color-elevated); }
  .msh-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .msh-editor { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .msh-fill { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .msh-searchbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 12px 6px;
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--color-elevated);
    color: var(--color-text-secondary);
  }
  .msh-searchbar input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.95rem;
    color: var(--color-text-primary);
  }
  .msh-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 8px 12px;
  }
  .msh-more {
    flex: 1;
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .msh-more-item {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 14px 14px;
    border-radius: 12px;
    text-align: left;
    font-size: 0.98rem;
    color: var(--color-text-primary);
  }
  .msh-more-item:active { background: var(--color-elevated); }
  .msh-more-item :global(svg) { color: var(--color-accent-light); flex-shrink: 0; }

  /* FAB */
  .msh-fab {
    position: absolute;
    right: 16px;
    /* acima da barra de abas (≈58px) + safe-area, pra não cobrir "Mais" */
    bottom: calc(env(safe-area-inset-bottom) + 74px);
    z-index: 30;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: var(--color-accent);
    color: #06121a;
    box-shadow: 0 8px 24px rgba(103, 232, 249, 0.36);
  }
  .msh-fab:active { transform: scale(0.95); }

  /* Barra de abas inferior */
  .msh-nav {
    display: flex;
    flex-shrink: 0;
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .msh-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 9px 0 7px;
    color: var(--color-text-muted);
    transition: color 0.14s ease;
  }
  .msh-tab span {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .msh-tab.on {
    color: var(--color-accent-light);
  }
  .msh-tab:active { background: var(--color-elevated); }
</style>
