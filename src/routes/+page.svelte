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
  import QuickSave from "$lib/components/layout/QuickSave.svelte";
  import WelcomeScreen from "$lib/components/layout/WelcomeScreen.svelte";
  import Toast from "$lib/components/ui/Toast.svelte";
  import CommandPalette, { type Command } from "$lib/components/ui/CommandPalette.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";
  import PromptDialog from "$lib/components/ui/PromptDialog.svelte";
  import HoverPreview from "$lib/components/ui/HoverPreview.svelte";
  import PrismaPicker from "$lib/components/ui/PrismaPicker.svelte";
  import VaultManager from "$lib/components/ui/VaultManager.svelte";
  import RelinkModal from "$lib/components/ui/RelinkModal.svelte";
  import DuplicatesModal from "$lib/components/ui/DuplicatesModal.svelte";
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
    prismaPickerOpen,
    relinkOpen,
    quickSaveOpen,
    duplicatesOpen,
    rightPane,
  } from "$lib/stores/ui";
  import { refreshGitSync } from "$lib/stores/gitsync";
  import { settings, applySettings, getLastVault, formatCombo } from "$lib/stores/settings";
  import { syncAutoSnapshot } from "$lib/git-auto";
  import { recordNav, navBack, navForward, loadBookmarks, toggleBookmark, loadPinned } from "$lib/stores/nav";
  import { COMMAND_DEFS } from "$lib/commands";
  import { graphData } from "$lib/stores/graph";
  import { loadQueryIndex } from "$lib/query";
  import { loadAliasIndex } from "$lib/stores/aliases";
  import { clearBacklinkCache } from "$lib/backlink-cache";
  import { saveTabs } from "$lib/tab-persist";
  import { openNote, setVault, refreshTree, flatFiles, openDailyNote, createNamedNote, createNoteIn, createFolderIn, newNoteDir, resolveWikilink } from "$lib/vault-actions";
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

  // Histórico de navegação: registra cada troca de nota ativa.
  $effect(() => {
    const p = $activeTabPath;
    if (p) untrack(() => recordNav(p));
  });

  // Favoritos + fixadas: (re)carrega ao abrir/trocar de vault.
  $effect(() => {
    $currentVaultPath;
    untrack(loadBookmarks);
    untrack(loadPinned);
  });

  // Índice de aliases (front-matter) — (re)carrega ao abrir/trocar de vault.
  $effect(() => {
    const v = $currentVaultPath;
    untrack(() => loadAliasIndex(v));
  });

  // Status de sincronização (badge da nuvem) — relê ao abrir/trocar de vault.
  $effect(() => {
    $currentVaultPath;
    untrack(refreshGitSync);
  });

  // Snapshot automático do Git: reagenda quando o toggle/intervalo muda.
  $effect(() => {
    $settings.gitAutoSnapshot;
    $settings.gitAutoSnapshotMinutes;
    untrack(syncAutoSnapshot);
  });

  // File watcher: refaz árvore (e invalida grafo) quando o vault muda no disco.
  $effect(() => {
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    listen("deeplink:open-note", (e) => {
      const rel = String((e as { payload?: unknown }).payload ?? "");
      if (!rel) return;
      const hit = resolveWikilink(rel);
      if (hit) {
        openNote(hit);
        return;
      }
      const vault = get(currentVaultPath);
      if (vault) {
        // SEGURANÇA: remove segmentos "" / "." / ".." pra impedir path traversal
        // (ex.: quartzo://note/..%2f..%2f.ssh) — o alvo fica SEMPRE dentro do vault.
        const cleanRel = rel
          .replace(/\\/g, "/")
          .split("/")
          .filter((p) => p && p !== "." && p !== "..")
          .join("/");
        if (!cleanRel) return;
        let abs = `${vault.replace(/[\\/]+$/, "")}/${cleanRel}`;
        if (!/\.md$/i.test(abs)) abs += ".md";
        openNote(abs);
      }
    });
    listen("vault-changed", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshTree();
        graphData.set(null); // força reindexar o grafo
        loadQueryIndex(get(currentVaultPath), true); // atualiza as views ```query
        loadAliasIndex(get(currentVaultPath)); // atualiza aliases (front-matter)
        clearBacklinkCache(); // invalida cache de backlinks (arquivos mudaram)
        refreshGitSync(); // atualiza o badge "Salvar na nuvem"
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

  // Copia um link quartzo://note/<caminho-relativo> da nota ativa (pra colar no PRISMA etc.).
  function copyQuartzoLink() {
    const vault = get(currentVaultPath);
    const active = get(activeTabPath);
    if (!vault || !active) {
      showToast(tr("toast.openVaultFirst"), "info");
      return;
    }
    const v = vault.replace(/\\/g, "/").replace(/\/+$/, "");
    let rel = active.replace(/\\/g, "/");
    if (rel.toLowerCase().startsWith(v.toLowerCase() + "/")) rel = rel.slice(v.length + 1);
    rel = rel.replace(/\.md$/i, "");
    const link = `quartzo://note/${encodeURI(rel)}`;
    navigator.clipboard
      .writeText(link)
      .then(() => showToast(tr("toast.linkCopied"), "success"))
      .catch(() => showToast(tr("toast.copyFail"), "error"));
  }

  // Registro único: id -> ação. Alimenta a Paleta de comandos E os atalhos.
  const actionMap: Record<string, () => void> = {
    palette: () => (paletteOpen = true),
    "quick-switch": () => (quickOpen = true),
    "global-search": () => { searchInitial = ""; searchOpen = true; },
    "open-vault": openVault,
    "new-note": () => {
      if (get(currentVaultPath)) createNoteIn(newNoteDir());
      else showToast(tr("toast.openVaultFirst"), "info");
    },
    "new-typed": openTypePicker,
    "new-folder": () => {
      const v = get(currentVaultPath);
      if (v) createFolderIn(v);
      else showToast(tr("toast.openVaultFirst"), "info");
    },
    "daily-note": openDailyNote,
    "new-memory": () => memoryOpen.update((v) => !v),
    "close-tab": () => closeActiveTab(),
    "toggle-graph": () => showGraph.update((v) => !v),
    "toggle-canvas": () => showCanvas.update((v) => !v),
    "toggle-sketch": () => showSketch.update((v) => !v),
    "toggle-backlinks": () => backlinksOpen.update((v) => !v),
    "toggle-outline": () => outlineOpen.update((v) => !v),
    "toggle-git": () => gitOpen.update((v) => !v),
    "cloud-save": () => {
      if (get(currentVaultPath)) quickSaveOpen.update((v) => !v);
      else showToast(tr("toast.openVaultFirst"), "info");
    },
    "toggle-sidebar": () => sidebarCollapsed.update((v) => !v),
    "pick-color": pickColorCmd,
    "extract-palette": extractPaletteCmd,
    "print-pdf": printNote,
    "export-html": () => exportNoteHtml(get(activeTabPath)?.split(/[\\/]/).pop() ?? "nota"),
    settings: () => settingsOpen.update((v) => !v),
    "prisma-attach": () => prismaPickerOpen.set(true),
    "copy-quartzo-link": copyQuartzoLink,
    "nav-back": () => navBack(openNote),
    "nav-forward": () => navForward(openNote),
    "toggle-bookmark": () => {
      const p = get(activeTabPath);
      if (p) toggleBookmark(p);
    },
    "fix-broken-links": () => relinkOpen.set(true),
    "find-duplicates": () => {
      if (get(currentVaultPath)) duplicatesOpen.set(true);
      else showToast(tr("toast.openVaultFirst"), "info");
    },
  };

  const commands = $derived<Command[]>([
    ...COMMAND_DEFS.filter((d) => actionMap[d.id]).map((d) => ({
      id: d.id,
      label: $t(`cmd.${d.id}`),
      hint: $settings.shortcuts[d.id]
        ? formatCombo($settings.shortcuts[d.id])
        : d.hint
          ? $t(`cmdhint.${d.id}`)
          : undefined,
      action: actionMap[d.id],
    })),
    ...$openTabs.map((tab) => ({
      id: `tab:${tab.path}`,
      label: $t("palette.goTo", { name: tab.name }),
      action: () => activeTabPath.set(tab.path),
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

  // Ações disparáveis por atalho = o mesmo registro da paleta.
  const shortcutActions = actionMap;
  function comboFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    parts.push(e.key.toLowerCase());
    return parts.join("+");
  }
  function onGlobalKeydown(e: KeyboardEvent) {
    // Navegação voltar/avançar (Alt+←/→) — fora do sistema de atalhos (não exige Ctrl).
    if (e.altKey && !e.ctrlKey && !e.metaKey && !get(settingsOpen)) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navBack(openNote);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navForward(openNote);
        return;
      }
    }
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
  createLabel={tr("palette.createNote")}
  placeholder={tr("palette.quickPlaceholder")}
/>
<CommandPalette
  bind:open={typedOpen}
  commands={typeCommands}
  placeholder={tr("palette.typePlaceholder")}
/>
<SearchModal bind:open={searchOpen} initial={searchInitial} />
<ContextMenu />
<SettingsModal bind:open={$settingsOpen} />
<SnippetInjector />
<MemoryModal bind:open={$memoryOpen} />
<ConfirmDialog />
<PromptDialog />
<HoverPreview />
<PrismaPicker />
<VaultManager />
<RelinkModal />
<DuplicatesModal />
<QuickSave />
