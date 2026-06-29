<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { isMobile } from "$lib/platform";
  import {
    PanelLeft,
    Search,
    Share2,
    Menu as MenuIcon,
    Plus,
    Home,
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
    BookOpen,
    FilePlus2,
    NotebookPen,
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
  import { vaultLabel } from "$lib/stores/settings";
  import WelcomeScreen from "./WelcomeScreen.svelte";
  import MobileEditor from "$lib/mobile/MobileEditor.svelte";
  import MobileHome from "$lib/mobile/MobileHome.svelte";
  import MobileDrawer from "$lib/mobile/MobileDrawer.svelte";
  import MobileSearch from "$lib/mobile/MobileSearch.svelte";
  import BottomSheet, { type SheetItem } from "$lib/mobile/BottomSheet.svelte";
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import CanvasView from "$lib/components/canvas/CanvasView.svelte";
  import Sketch from "$lib/components/sketch/Sketch.svelte";
  import { t, tr } from "$lib/i18n";

  let { onOpenVault, onCreateVault }: { onOpenVault?: () => void; onCreateVault?: () => void } = $props();

  type Tab = "home" | "search" | "graph" | "more";
  let tab = $state<Tab>("home");
  let viewingNote = $state(false); // home: editor em tela cheia vs tela inicial
  let drawerOpen = $state(false);
  let newSheetOpen = $state(false);

  // Abrir nota -> entra no editor full-screen (na aba Início).
  $effect(() => {
    if ($activeTabPath) viewingNote = true;
  });

  const vault = $derived($currentVaultPath ? vaultLabel($currentVaultPath) : "");

  function newNote() {
    if (!$currentVaultPath) return;
    createNoteIn(newNoteDir());
  }

  function go(t: Tab) {
    tab = t;
    if (t !== "home") viewingNote = false;
    showGraph.set(t === "graph");
    if (t !== "graph") {
      showCanvas.set(false);
      showSketch.set(false);
    }
  }

  function backToHome() {
    viewingNote = false;
    tab = "home";
  }

  // ----- ações rápidas (sheet do +) -----
  const newSheetItems = $derived<SheetItem[]>([
    { label: tr("titlebar.newNote"), icon: FilePlus2, action: () => newNote() },
    { label: tr("titlebar.dailyNote"), icon: CalendarDays, action: () => openDailyNote() },
    { label: tr("sidebar.newMemory"), icon: Sparkles, action: () => memoryOpen.set(true) },
    { label: "Canvas", icon: Frame, action: () => { showCanvas.set(true); tab = "graph"; } },
    { label: tr("sidebar.sketch"), icon: Pencil, action: () => { showSketch.set(true); tab = "graph"; } },
  ]);

  // ----- "Mais" -----
  interface MoreItem { label: string; icon: any; action: () => void; show?: boolean; }
  const moreItems = $derived<MoreItem[]>([
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
    { id: "home", icon: Home, label: tr("mobile.home") },
    { id: "search", icon: Search, label: tr("mobile.search") },
    { id: "graph", icon: Share2, label: tr("graph.title") },
    { id: "more", icon: MenuIcon, label: tr("mobile.more") },
  ];

  // ----- swipe da borda esquerda abre a gaveta -----
  let edgeX = 0;
  let edgeActive = false;
  function edgeDown(e: PointerEvent) {
    edgeActive = true;
    edgeX = e.clientX;
  }
  function edgeMove(e: PointerEvent) {
    if (edgeActive && e.clientX - edgeX > 44) {
      edgeActive = false;
      drawerOpen = true;
    }
  }
  function edgeUp() {
    edgeActive = false;
  }

  // ----- Botão "voltar" do Android: fecha camadas em ordem antes de sair do app.
  // Sem isso, o back saía direto do app de qualquer tela. Usa o truque de history:
  // mantém 1 entrada-sentinela; cada back vira um popstate que fechamos e re-armamos.
  function handleBack(): boolean {
    if (newSheetOpen) { newSheetOpen = false; return true; }
    if ($settingsOpen) { settingsOpen.set(false); return true; }
    if ($basesOpen) { basesOpen.set(false); return true; }
    if ($insightsOpen) { insightsOpen.set(false); return true; }
    if ($duplicatesOpen) { duplicatesOpen.set(false); return true; }
    if ($memoryOpen) { memoryOpen.set(false); return true; }
    if ($vaultManagerOpen) { vaultManagerOpen.set(false); return true; }
    if ($tutorialOpen) { tutorialOpen.set(false); return true; }
    if (drawerOpen) { drawerOpen = false; return true; }
    if ($showCanvas) { showCanvas.set(false); go("home"); return true; }
    if ($showSketch) { showSketch.set(false); go("home"); return true; }
    if (viewingNote) { backToHome(); return true; }
    if (tab !== "home") { go("home"); return true; }
    return false; // nada pra fechar -> deixa sair do app
  }

  onMount(() => {
    if (!isMobile) return;
    history.pushState({ qz: 1 }, "");
    const onPop = () => {
      if (handleBack()) {
        history.pushState({ qz: 1 }, ""); // re-arma pro próximo back
      } else {
        // nada pra fechar (tela inicial) -> sai do app num toque só.
        // window.history.back() vira no-op na entrada inicial do WebView, então
        // fechamos a janela/activity via Tauri.
        import("@tauri-apps/api/window")
          .then(({ getCurrentWindow }) => getCurrentWindow().close())
          .catch(() => {
            window.removeEventListener("popstate", onPop);
            history.back();
          });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });
</script>

<div class="msh">
  <div class="msh-body">
    {#if !$currentVaultPath}
      <WelcomeScreen {onOpenVault} {onCreateVault} />
    {:else if tab === "home"}
      {#if viewingNote && $activeTabPath}
        <MobileEditor onBack={backToHome} />
      {:else}
        <!-- topo enxuto: abrir gaveta + título do vault -->
        <div class="msh-top">
          <button class="msh-iconbtn m-press" onclick={() => (drawerOpen = true)} aria-label={$t("mobile.notes")}>
            <PanelLeft size={20} />
          </button>
          <span class="msh-title">{vault}</span>
          <button class="msh-iconbtn m-press" onclick={() => (newSheetOpen = true)} aria-label={$t("titlebar.newNote")}>
            <NotebookPen size={19} />
          </button>
        </div>
        <MobileHome
          onNewNote={() => (newSheetOpen = true)}
          onSearch={() => go("search")}
          onDailyNote={() => openDailyNote()}
          onOpen={(p) => openNote(p)}
        />
      {/if}
    {:else if tab === "search"}
      <MobileSearch onOpen={(p) => { openNote(p); go("home"); }} />
    {:else if tab === "graph"}
      <div class="msh-fill">
        {#if $showCanvas}
          <CanvasView onClose={() => { showCanvas.set(false); go("home"); }} />
        {:else if $showSketch}
          <Sketch onClose={() => { showSketch.set(false); go("home"); }} />
        {:else}
          <GraphView onOpenNote={(p) => { openNote(p); go("home"); }} onClose={() => go("home")} />
        {/if}
      </div>
    {:else if tab === "more"}
      <div class="msh-top"><span class="msh-title">{$t("mobile.more")}</span></div>
      <div class="msh-more">
        {#each moreItems.filter((m) => m.show !== false) as m, i (m.label)}
          {@const Icon = m.icon}
          <button class="msh-more-item m-press m-row-in" style="animation-delay: {Math.min(i * 35, 220)}ms" onclick={m.action}>
            <span class="msh-more-ic"><Icon size={18} /></span>
            <span>{m.label}</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- captura de swipe na borda esquerda (abre a gaveta de qualquer tela) -->
    {#if $currentVaultPath && !drawerOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="msh-edge"
        onpointerdown={edgeDown}
        onpointermove={edgeMove}
        onpointerup={edgeUp}
        onpointercancel={edgeUp}
      ></div>
    {/if}
  </div>

  <!-- FAB nova nota (na aba Início, fora do editor) -->
  {#if $currentVaultPath && tab === "home" && !viewingNote}
    <button class="msh-fab m-press" onclick={() => (newSheetOpen = true)} aria-label={$t("titlebar.newNote")} transition:fly={{ y: 12, duration: 180 }}>
      <Plus size={24} />
    </button>
  {/if}

  <!-- ===== Pílula flutuante (glass + bolha ativa) ===== -->
  {#if !viewingNote || tab !== "home"}
    <nav class="msh-pill m-glass">
      {#each NAV as n (n.id)}
        {@const Icon = n.icon}
        <button class="msh-tab m-press" class:on={tab === n.id} onclick={() => go(n.id)}>
          <span class="msh-bubble"><Icon size={20} /></span>
          <span class="msh-tlabel">{n.label}</span>
        </button>
      {/each}
    </nav>
  {/if}
</div>

<!-- Gaveta de pastas -->
<MobileDrawer
  bind:open={drawerOpen}
  onOpenNote={(p) => { openNote(p); go("home"); }}
  onNewNote={() => (newSheetOpen = true)}
  onSettings={() => settingsOpen.set(true)}
  onSwitchVault={() => vaultManagerOpen.set(true)}
/>

<!-- Sheet de ações rápidas (+) -->
<BottomSheet bind:open={newSheetOpen} title={$t("titlebar.newNote")} items={newSheetItems} />

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
  .msh-top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 50px;
    padding: calc(env(safe-area-inset-top) + 8px) 12px 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .msh-iconbtn {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    color: var(--color-text-secondary);
    background: var(--color-elevated);
    flex-shrink: 0;
  }
  .msh-title {
    flex: 1;
    min-width: 0;
    font-size: 1.02rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .msh-fill { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .msh-more {
    flex: 1;
    overflow: auto;
    padding: 12px 12px calc(env(safe-area-inset-bottom) + 120px);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .msh-more-item {
    display: flex;
    align-items: center;
    gap: 13px;
    width: 100%;
    padding: 13px 12px;
    border-radius: var(--m-radius);
    text-align: left;
    font-size: 0.98rem;
    color: var(--color-text-primary);
  }
  .msh-more-ic {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--color-elevated);
    color: var(--color-accent-light);
    flex-shrink: 0;
  }

  .msh-edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 18px;
    z-index: 25;
  }

  /* FAB */
  .msh-fab {
    position: absolute;
    right: 18px;
    bottom: calc(env(safe-area-inset-bottom) + 96px);
    z-index: 30;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 20px;
    color: #06121a;
    background: linear-gradient(135deg, var(--color-accent-light, #a5f3fc), var(--color-accent));
    box-shadow: var(--m-glow);
  }

  /* Pílula flutuante */
  .msh-pill {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom) + 12px);
    z-index: 35;
    display: flex;
    gap: 2px;
    padding: 7px;
    border-radius: var(--m-radius-pill);
  }
  .msh-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 70px;
    padding: 4px 0 2px;
    color: var(--color-text-muted);
    border-radius: 18px;
  }
  .msh-bubble {
    display: grid;
    place-items: center;
    width: 46px;
    height: 32px;
    border-radius: var(--m-radius-pill);
    transition: background 0.22s var(--m-ease), color 0.18s ease;
  }
  .msh-tab.on {
    color: #06121a;
  }
  .msh-tab.on .msh-bubble {
    color: #06121a;
    background: linear-gradient(135deg, var(--color-accent-light, #a5f3fc), var(--color-accent));
    box-shadow: var(--m-glow);
  }
  .msh-tlabel {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: var(--color-text-muted);
  }
  .msh-tab.on .msh-tlabel {
    color: var(--color-accent-light);
  }
</style>
