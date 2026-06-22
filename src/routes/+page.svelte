<script lang="ts">
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import TitleBar from "$lib/components/layout/TitleBar.svelte";
  import Sidebar from "$lib/components/layout/Sidebar.svelte";
  import EditorTabs from "$lib/components/editor/EditorTabs.svelte";
  import MarkdownEditor from "$lib/components/editor/MarkdownEditor.svelte";
  import PaneEditor from "$lib/components/editor/PaneEditor.svelte";
  import BacklinksPane from "$lib/components/layout/BacklinksPane.svelte";
  import OutlinePane from "$lib/components/layout/OutlinePane.svelte";
  import GitPane from "$lib/components/layout/GitPane.svelte";
  import WelcomeScreen from "$lib/components/layout/WelcomeScreen.svelte";
  import Toast from "$lib/components/ui/Toast.svelte";
  import CommandPalette, { type Command } from "$lib/components/ui/CommandPalette.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import SearchModal from "$lib/components/ui/SearchModal.svelte";
  import GraphView from "$lib/components/graph/GraphView.svelte";
  import CanvasView from "$lib/components/canvas/CanvasView.svelte";
  import Sketch from "$lib/components/sketch/Sketch.svelte";
  import SettingsModal from "$lib/components/settings/SettingsModal.svelte";
  import SnippetInjector from "$lib/components/settings/SnippetInjector.svelte";
  import MemoryModal from "$lib/components/memory/MemoryModal.svelte";
  import { currentVaultPath, fileTree } from "$lib/stores/vault";
  import { selectedFile } from "$lib/stores/vault";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { showToast } from "$lib/stores/toast";
  import {
    showGraph,
    showCanvas,
    showSketch,
    settingsOpen,
    sidebarCollapsed,
    memoryOpen,
    backlinksOpen,
    outlineOpen,
    gitOpen,
    searchRequest,
    typePickerRequest,
    rightPane,
  } from "$lib/stores/ui";
  import { settings, applySettings, getLastVault } from "$lib/stores/settings";
  import { graphData } from "$lib/stores/graph";
  import { loadQueryIndex } from "$lib/query";
  import { clearBacklinkCache } from "$lib/backlink-cache";
  import { saveTabs } from "$lib/tab-persist";
  import { openNote, setVault, refreshTree, flatFiles, openDailyNote, createNamedNote } from "$lib/vault-actions";
  import { insertAtCursor } from "$lib/stores/editor";
  import { pickColor, extractPalette, paletteToMarkdown, eyedropperSupported } from "$lib/color";
  import { printNote, exportNoteHtml } from "$lib/export";
  import { createTypedNote, loadNoteTypes, type NoteType } from "$lib/types-notes";
  import { sfx } from "$lib/sfx";
  import { t, tr } from "$lib/i18n";
  import { untrack } from "svelte";
  import { get } from "svelte/store";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  // ---- Redimensionar barra lateral (arrastar a borda) ----
  let dragWidth = $state<number | null>(null);
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 480;
  const sidebarW = $derived(
    $sidebarCollapsed ? 64 : (dragWidth ?? $settings.sidebarWidth)
  );
  function startResize(e: PointerEvent) {
    e.preventDefault();
    dragWidth = $settings.sidebarWidth;
    window.addEventListener("pointermove", onResize);
    window.addEventListener("pointerup", endResize, { once: true });
  }
  function onResize(e: PointerEvent) {
    dragWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
  }
  function endResize() {
    window.removeEventListener("pointermove", onResize);
    if (dragWidth != null) settings.update((s) => ({ ...s, sidebarWidth: dragWidth as number }));
    dragWidth = null;
  }

  let paletteOpen = $state(false);
  let searchOpen = $state(false);
  let searchInitial = $state("");
  let quickOpen = $state(false);
  let typedOpen = $state(false);
  let noteTypes = $state<NoteType[]>([]);

  async function openTypePicker() {
    const v = get(currentVaultPath);
    if (!v) {
      showToast(tr("toast.openVaultFirst"), "info");
      return;
    }
    noteTypes = await loadNoteTypes(v);
    typedOpen = true;
  }
  const typeCommands = $derived<Command[]>(
    noteTypes.map((t) => ({
      id: t.id,
      label: `${t.emoji} ${t.name}`,
      hint: t.folder,
      action: () => createTypedNote(t),
    }))
  );

  // Disparado pelo botão "+ Adicionar > Nova de tipo…".
  $effect(() => {
    if ($typePickerRequest) {
      typePickerRequest.set(false);
      untrack(openTypePicker);
    }
  });

  // Busca pré-preenchida (ex.: clicar numa tag na sidebar).
  $effect(() => {
    const r = $searchRequest;
    if (r !== null) {
      searchInitial = r;
      searchOpen = true;
      searchRequest.set(null);
    }
  });

  function closeActiveTab() {
    const a = get(activeTabPath);
    if (!a) return;
    const rem = get(openTabs).filter((t) => t.path !== a);
    openTabs.set(rem);
    activeTabPath.set(rem.length ? rem[rem.length - 1].path : null);
  }

  // Quick switcher: todas as notas como comandos (abrir por nome).
  const quickCommands = $derived<Command[]>(
    flatFiles($fileTree).map((f) => ({
      id: f.path,
      label: f.name,
      hint: (f.path.split(/[\\/]/).slice(-2, -1)[0] ?? ""),
      action: () => openNote(f.path),
    }))
  );

  // Densidade/animações + abrir último vault ao iniciar.
  $effect(() => {
    untrack(async () => {
      applySettings(get(settings));
      const s = get(settings);
      const last = getLastVault();
      if (s.autoOpenVault && last && !get(currentVaultPath)) {
        try {
          await setVault(last);
        } catch {
          /* vault sumiu */
        }
      }
    });
  });

  // File watcher: refaz árvore (e invalida grafo) quando o vault muda no disco.
  $effect(() => {
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    listen("vault-changed", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshTree();
        graphData.set(null); // força reindexar o grafo
        loadQueryIndex(get(currentVaultPath), true); // atualiza as views ```query
        clearBacklinkCache(); // invalida cache de backlinks (arquivos mudaram)
      }, 300);
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  });

  // Clique no explorer abre a nota.
  $effect(() => {
    const path = $selectedFile;
    if (path) {
      openNote(path);
      selectedFile.set(null);
    }
  });

  // Salva as abas abertas (caminhos + ativa) por vault, p/ restaurar a sessão.
  $effect(() => {
    const v = $currentVaultPath;
    const tabs = $openTabs;
    const active = $activeTabPath;
    if (v) saveTabs(v, tabs.map((t) => t.path), active);
  });

  // Grafo, Canvas e Rascunho são mutuamente exclusivos (abrir um fecha os outros).
  $effect(() => {
    if ($showGraph) {
      showCanvas.set(false);
      showSketch.set(false);
    }
  });
  $effect(() => {
    if ($showCanvas) {
      showGraph.set(false);
      showSketch.set(false);
    }
  });
  $effect(() => {
    if ($showSketch) {
      showGraph.set(false);
      showCanvas.set(false);
    }
  });

  async function openVault() {
    const sel = await openDialog({ directory: true, multiple: false, title: tr("dialog.openVault") });
    if (typeof sel !== "string") return;
    await setVault(sel);
    showToast(tr("toast.vaultOpened"), "success");
  }

  function openFromGraph(path: string) {
    openNote(path);
    showGraph.set(false);
  }

  // ---- Cor (designer): conta-gotas + extração de paleta ----
  async function pickColorCmd() {
    if (!eyedropperSupported()) {
      showToast(tr("toast.eyedropperUnsupported"), "info");
      return;
    }
    const hex = await pickColor();
    if (!hex) return;
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      /* ignora */
    }
    if (!insertAtCursor(hex)) showToast(tr("toast.colorCopied", { hex }), "success");
    else showToast(tr("toast.colorInserted", { hex }), "success");
  }

  async function extractPaletteCmd() {
    const sel = await openDialog({
      multiple: false,
      title: "Escolher imagem para extrair a paleta",
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"] }],
    });
    if (typeof sel !== "string") return;
    try {
      const colors = await extractPalette(sel, get(settings).paletteColors);
      if (!colors.length) {
        showToast("Não consegui extrair cores dessa imagem", "info");
        return;
      }
      const md = paletteToMarkdown(colors);
      if (!insertAtCursor(md)) {
        await navigator.clipboard.writeText(colors.join(" "));
        showToast(`Paleta copiada (${colors.length} cores)`, "success");
      } else {
        showToast(`Paleta extraída (${colors.length} cores)`, "success");
      }
    } catch (e) {
      showToast(`Erro ao extrair paleta: ${e}`, "error");
    }
  }

  const commands = $derived<Command[]>([
    { id: "open-vault", label: "Abrir vault…", hint: "pasta", action: openVault },
    { id: "global-search", label: "Buscar nas notas…", hint: "Ctrl+Shift+F", action: () => { searchInitial = ""; searchOpen = true; } },
    { id: "quick-switch", label: "Ir para nota…", hint: "Ctrl+O", action: () => (quickOpen = true) },
    { id: "daily-note", label: "Nota do dia", hint: "Diário", action: openDailyNote },
    { id: "new-typed", label: "Nova nota de tipo…", hint: "schema", action: openTypePicker },
    { id: "pick-color", label: "Conta-gotas (pegar cor da tela)", hint: "cor", action: pickColorCmd },
    { id: "extract-palette", label: "Extrair paleta de imagem…", hint: "cor", action: extractPaletteCmd },
    { id: "print-pdf", label: "Imprimir / Salvar como PDF", hint: "exportar", action: printNote },
    { id: "export-html", label: "Exportar nota como HTML…", hint: "exportar", action: () => exportNoteHtml(get(activeTabPath)?.split(/[\\/]/).pop() ?? "nota") },
    { id: "toggle-graph", label: "Abrir grafo", hint: "Ctrl+G", action: () => showGraph.set(true) },
    { id: "toggle-canvas", label: "Abrir Canvas", hint: "Ctrl+Shift+C", action: () => showCanvas.set(true) },
    { id: "toggle-sketch", label: "Abrir Rascunho (desenho)", hint: "Ctrl+Shift+D", action: () => showSketch.set(true) },
    { id: "toggle-backlinks", label: "Backlinks", hint: "Ctrl+Shift+B", action: () => backlinksOpen.update((v) => !v) },
    { id: "toggle-outline", label: "Outline (cabeçalhos)", hint: "Ctrl+Shift+O", action: () => outlineOpen.update((v) => !v) },
    { id: "toggle-git", label: "Versões (Git)", hint: "Ctrl+Shift+G", action: () => gitOpen.update((v) => !v) },
    { id: "settings", label: "Configurações", hint: "Ctrl+,", action: () => settingsOpen.set(true) },
    { id: "new-memory", label: "Nova Memória do Claude", hint: "Ctrl+Shift+M", action: () => memoryOpen.set(true) },
    { id: "toggle-sidebar", label: "Recolher/expandir sidebar", action: () => sidebarCollapsed.update((v) => !v) },
    ...$openTabs.map((t) => ({
      id: `tab:${t.path}`,
      label: `Ir para: ${t.name}`,
      action: () => activeTabPath.set(t.path),
    })),
  ]);

  // ---- SFX global: som em TODA interação (click/toggle/hover) ----
  const SFX_SEL = "button, a, [role='button'], [role='menuitem'], summary, .ctx-item, label";
  function onGlobalPointerDown(e: PointerEvent) {
    sfx.unlock(); // garante o áudio no 1º gesto
    const el = (e.target as HTMLElement)?.closest(SFX_SEL);
    if (!el) return;
    if (el.getAttribute("role") === "switch") {
      el.getAttribute("aria-checked") === "true" ? sfx.toggleOff() : sfx.toggleOn();
    } else {
      sfx.click();
    }
  }
  function onGlobalPointerOver(e: PointerEvent) {
    const el = (e.target as HTMLElement)?.closest(SFX_SEL);
    if (el) sfx.hover();
  }

  // Mata o menu de contexto do navegador na UI (cara de "app web"),
  // mas mantém o nativo em áreas de texto (editor, preview, inputs) p/ copiar/colar.
  function onGlobalContextMenu(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, .cm-editor, .q-prose")) return;
    e.preventDefault();
  }

  // Ações disparáveis por atalho (combos configuráveis em Configurações › Atalhos).
  const shortcutActions: Record<string, () => void> = {
    palette: () => (paletteOpen = true),
    quickSwitch: () => (quickOpen = true),
    search: () => { searchInitial = ""; searchOpen = true; },
    graph: () => showGraph.update((v) => !v),
    canvas: () => showCanvas.update((v) => !v),
    sketch: () => showSketch.update((v) => !v),
    outline: () => outlineOpen.update((v) => !v),
    backlinks: () => backlinksOpen.update((v) => !v),
    git: () => gitOpen.update((v) => !v),
    memory: () => memoryOpen.update((v) => !v),
    settings: () => settingsOpen.update((v) => !v),
    sidebar: () => sidebarCollapsed.update((v) => !v),
    closeTab: () => closeActiveTab(),
  };
  function comboFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    parts.push(e.key.toLowerCase());
    return parts.join("+");
  }
  function onGlobalKeydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (get(settingsOpen)) return; // não dispara enquanto edita atalhos nas Configurações
    const combo = comboFromEvent(e);
    const map = get(settings).shortcuts;
    for (const id of Object.keys(map)) {
      if (map[id] === combo && shortcutActions[id]) {
        e.preventDefault();
        shortcutActions[id]();
        return;
      }
    }
  }
</script>

<svelte:window
  onkeydown={onGlobalKeydown}
  oncontextmenu={onGlobalContextMenu}
  onpointerdown={onGlobalPointerDown}
  onpointerover={onGlobalPointerOver}
/>

<div class="flex h-screen w-screen flex-col overflow-hidden">
  <TitleBar />
  <div class="flex min-h-0 flex-1">
  <aside
    class="app-sidebar shrink-0 border-r border-border bg-gradient-to-b from-surface to-[#131c2e] {dragWidth ==
    null
      ? 'transition-[width] duration-[250ms] ease-out'
      : ''}"
    style="width: {sidebarW}px"
  >
    <Sidebar />
  </aside>

  {#if !$sidebarCollapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="q-resizer"
      class:active={dragWidth != null}
      onpointerdown={startResize}
      title="Arraste para redimensionar"
      role="separator"
      aria-orientation="vertical"
    ></div>
  {/if}

  <main class="flex min-w-0 flex-1 flex-col">
    {#if $showGraph}
      <div class="q-view-in flex min-h-0 flex-1 flex-col">
        <GraphView onOpenNote={openFromGraph} onClose={() => showGraph.set(false)} />
      </div>
    {:else if $showCanvas}
      <div class="q-view-in flex min-h-0 flex-1 flex-col">
        <CanvasView onClose={() => showCanvas.set(false)} />
      </div>
    {:else if $showSketch}
      <div class="q-view-in flex min-h-0 flex-1 flex-col">
        <Sketch onClose={() => showSketch.set(false)} />
      </div>
    {:else if $openTabs.length || $rightPane || ($gitOpen && $currentVaultPath)}
      <div class="q-view-in flex min-h-0 flex-1">
        {#if $openTabs.length}
          <div class="flex min-w-0 flex-1 flex-col">
            <EditorTabs />
            <MarkdownEditor />
          </div>
        {:else}
          <div class="flex flex-1 items-center justify-center text-sm text-text-secondary">
            Painel aberto à direita →
          </div>
        {/if}
        {#if $rightPane}
          <div
            class="flex min-w-0 flex-1 flex-col border-l border-border"
            transition:fly={{ x: 30, duration: 240, easing: cubicOut }}
          >
            <PaneEditor path={$rightPane} onClose={() => rightPane.set(null)} />
          </div>
        {/if}
        {#if $outlineOpen && $openTabs.length}
          <aside
            class="w-64 shrink-0 border-l border-border bg-surface"
            transition:fly={{ x: 24, duration: 220, easing: cubicOut }}
          >
            <OutlinePane />
          </aside>
        {/if}
        {#if $backlinksOpen && $openTabs.length}
          <aside
            class="w-72 shrink-0 border-l border-border bg-surface"
            transition:fly={{ x: 24, duration: 220, easing: cubicOut }}
          >
            <BacklinksPane />
          </aside>
        {/if}
        {#if $gitOpen && $currentVaultPath}
          <aside
            class="w-72 shrink-0 border-l border-border bg-surface"
            transition:fly={{ x: 24, duration: 220, easing: cubicOut }}
          >
            <GitPane />
          </aside>
        {/if}
      </div>
    {:else}
      <div class="q-view-in min-h-0 flex-1">
        <WelcomeScreen onOpenVault={openVault} />
      </div>
    {/if}
  </main>
  </div>
</div>

<Toast />
<CommandPalette bind:open={paletteOpen} {commands} />
<CommandPalette
  bind:open={quickOpen}
  commands={quickCommands}
  onCreate={createNamedNote}
  createLabel="Criar nota"
  placeholder="Ir para nota ou digite para criar…"
/>
<CommandPalette
  bind:open={typedOpen}
  commands={typeCommands}
  placeholder="Escolha um tipo de nota…"
/>
<SearchModal bind:open={searchOpen} initial={searchInitial} />
<ContextMenu />
<SettingsModal bind:open={$settingsOpen} />
<SnippetInjector />
<MemoryModal bind:open={$memoryOpen} />
