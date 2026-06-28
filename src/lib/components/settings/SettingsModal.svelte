<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    Settings2,
    FileEdit,
    Palette,
    Keyboard,
    Info,
    X,
    FolderOpen,
    Check,
    Download,
    GraduationCap,
    ArrowUpCircle,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ExternalLink,
    Braces,
    Cloud,
    CloudUpload,
    Workflow,
    Boxes,
    Clapperboard,
    Copy,
  } from "@lucide/svelte";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
  import { untrack } from "svelte";
  import { RefreshCw, FolderInput } from "@lucide/svelte";
  import { checkForUpdate, CHANGELOG, GITHUB_REPO, type UpdateResult } from "$lib/updates";
  import { settings, SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS, formatCombo, type Settings, type EditorFont, type Density, type ViewMode } from "$lib/stores/settings";
  import { loadNoteTypes, saveNoteTypes, DEFAULT_TYPES, type NoteType } from "$lib/types-notes";
  import { Layers, Trash2, Pipette, Puzzle, Search } from "@lucide/svelte";
  import { FEATURE_PLUGINS } from "$lib/stores/settings";

  function setFeature(id: string, val: boolean) {
    settings.update((s) => ({ ...s, features: { ...s.features, [id]: val } }));
  }

  // Presets de cor de destaque (paleta cristal + complementares).
  const ACCENTS = ["#67e8f9", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#f87171"];
  import { currentVaultPath } from "$lib/stores/vault";
  import { showToast } from "$lib/stores/toast";
  import { saveAllVaultsToCloud } from "$lib/git-auto";
  import { isMobile } from "$lib/platform";
  import { prismaPickerOpen } from "$lib/stores/ui";
  import { setVault, refreshTree } from "$lib/vault-actions";
  import { loadGraph } from "$lib/stores/graph";
  import { loadQueryIndex } from "$lib/query";
  import { getVersion } from "@tauri-apps/api/app";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t, tr, locale, setLocale, LOCALES } from "$lib/i18n";

  interface CssSnippet {
    name: string;
    content: string;
  }
  let snippets = $state<CssSnippet[]>([]);

  async function loadSnippets(v: string) {
    try {
      snippets = await invoke<CssSnippet[]>("list_css_snippets", { vaultPath: v });
    } catch {
      snippets = [];
    }
  }
  function toggleSnippet(name: string) {
    settings.update((s) => {
      const on = s.enabledSnippets.includes(name);
      return {
        ...s,
        enabledSnippets: on
          ? s.enabledSnippets.filter((n) => n !== name)
          : [...s.enabledSnippets, name],
      };
    });
  }
  async function openSnippetsFolder() {
    const v = $currentVaultPath;
    if (!v) return;
    await loadSnippets(v); // garante que a pasta existe
    try {
      await revealItemInDir(`${v}/.quartzo/snippets`);
    } catch {
      showToast(tr("settings.toast.openFolderFail"), "error");
    }
  }

  // Carrega os snippets ao abrir a aba Aparência.
  $effect(() => {
    const v = $currentVaultPath;
    if (open && section === "aparencia" && v) untrack(() => loadSnippets(v));
  });

  let appVersion = $state("0.56.0");
  $effect(() => {
    try {
      getVersion()
        .then((v) => (appVersion = v))
        .catch(() => {});
    } catch {
      /* fora do Tauri (browser) */
    }
  });

  let { open = $bindable(false) }: { open?: boolean } = $props();

  type Section =
    | "geral"
    | "arquivos"
    | "editor"
    | "markdown"
    | "tipos"
    | "aparencia"
    | "plugins"
    | "nuvem"
    | "integracoes"
    | "atalhos"
    | "atualizacoes"
    | "tutorial"
    | "sobre";
  let section = $state<Section>("geral");

  const tabs: { id: Section; icon: typeof Info }[] = [
    { id: "geral", icon: Settings2 },
    { id: "arquivos", icon: FolderInput },
    { id: "editor", icon: FileEdit },
    { id: "markdown", icon: Braces },
    { id: "tipos", icon: Layers },
    { id: "aparencia", icon: Palette },
    { id: "plugins", icon: Puzzle },
    { id: "nuvem", icon: Cloud },
    { id: "integracoes", icon: Workflow },
    { id: "atalhos", icon: Keyboard },
    { id: "atualizacoes", icon: Download },
    { id: "tutorial", icon: GraduationCap },
    { id: "sobre", icon: Info },
  ];

  // ---- Integrações (PRISMA / ecossistema) ----
  let prismaOk = $state(false);
  $effect(() => {
    if (open && section === "integracoes") {
      untrack(async () => {
        try {
          prismaOk = await invoke<boolean>("prisma_installed");
        } catch {
          prismaOk = false;
        }
      });
    }
  });
  async function openPrisma() {
    try {
      await invoke("launch_prisma");
      showToast(tr("settings.toast.openingPrisma"), "success");
    } catch (e) {
      showToast(`${e}`, "error");
    }
  }
  async function copyVaultPath() {
    const v = $currentVaultPath;
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      showToast(tr("settings.toast.pathCopied"), "success");
    } catch {
      showToast(tr("settings.toast.copyFail"), "error");
    }
  }

  // ---- Editor de Tipos de nota ----
  let types = $state<NoteType[]>([]);
  let typesDirty = $state(false);
  async function loadTypesEditor() {
    const v = $currentVaultPath;
    if (!v) {
      types = [];
      return;
    }
    types = await loadNoteTypes(v);
    typesDirty = false;
  }
  function fieldsStr(t: NoteType): string {
    return Object.entries(t.frontmatter)
      .map(([k, val]) => (val ? `${k}=${val}` : k))
      .join(", ");
  }
  function setFields(t: NoteType, str: string) {
    const fm: Record<string, string> = {};
    for (const part of str.split(",")) {
      const s = part.trim();
      if (!s) continue;
      const eq = s.indexOf("=");
      if (eq >= 0) fm[s.slice(0, eq).trim()] = s.slice(eq + 1).trim();
      else fm[s] = "";
    }
    t.frontmatter = fm;
    typesDirty = true;
  }
  function addType() {
    types = [
      ...types,
      { id: `tipo-${Date.now()}`, name: tr("settings.types.newType"), emoji: "📄", folder: "", frontmatter: { tipo: "" }, body: "" },
    ];
    typesDirty = true;
  }
  function removeType(i: number) {
    types = types.filter((_, idx) => idx !== i);
    typesDirty = true;
  }
  async function saveTypes() {
    const v = $currentVaultPath;
    if (!v) return;
    try {
      await saveNoteTypes(v, types);
      typesDirty = false;
      showToast(tr("settings.toast.typesSaved"), "success");
    } catch (e) {
      showToast(tr("settings.toast.typesSaveFail", { error: `${e}` }), "error");
    }
  }
  function restoreTypes() {
    types = structuredClone(DEFAULT_TYPES);
    typesDirty = true;
  }
  $effect(() => {
    if (open && section === "tipos" && $currentVaultPath) untrack(loadTypesEditor);
  });

  // ---- Nuvem (pasta sincronizada) ----
  interface CloudFolder {
    name: string;
    path: string;
  }
  let cloudFolders = $state<CloudFolder[]>([]);
  let movingCloud = $state(false);
  // Salvar TODOS os vaults conhecidos de uma vez (commit + push em cada repo com remoto).
  let savingAll = $state(false);
  async function saveAll() {
    savingAll = true;
    try {
      const r = await saveAllVaultsToCloud();
      const msg = tr("set.saveAllResult", { pushed: r.pushed, committed: r.committed, skipped: r.skipped });
      if (r.failed.length) {
        showToast(tr("set.saveAllSomeFail", { fail: r.failed.join(", ") }), "error");
      } else {
        showToast(msg, "success");
      }
    } catch (e) {
      showToast(`${e}`, "error");
    } finally {
      savingAll = false;
    }
  }
  async function loadClouds() {
    try {
      cloudFolders = await invoke<CloudFolder[]>("detect_cloud_folders");
    } catch {
      cloudFolders = [];
    }
  }
  const vaultInCloud = $derived.by(() => {
    const v = $currentVaultPath;
    if (!v) return null;
    const norm = v.replace(/\\/g, "/").toLowerCase();
    return cloudFolders.find((f) => norm.startsWith(f.path.replace(/\\/g, "/").toLowerCase())) ?? null;
  });
  async function moveToCloud(f: CloudFolder) {
    const v = $currentVaultPath;
    if (!v) return;
    movingCloud = true;
    try {
      const dest = await invoke<string>("copy_vault_to_cloud", { vault: v, cloudParent: f.path });
      await setVault(dest);
      showToast(tr("settings.toast.movedToCloud"), "success");
    } catch (e) {
      showToast(`${e}`, "error");
    } finally {
      movingCloud = false;
    }
  }
  $effect(() => {
    if (open && section === "nuvem") untrack(loadClouds);
  });

  // ---- Buscar atualização (GitHub Releases) ----
  let checking = $state(false);
  let update = $state<UpdateResult | null>(null);
  async function runUpdateCheck() {
    checking = true;
    update = null;
    try {
      update = await checkForUpdate(appVersion);
    } finally {
      checking = false;
    }
  }
  async function openReleases(url?: string) {
    try {
      await openUrl(url ?? `https://github.com/${GITHUB_REPO}/releases`);
    } catch {
      showToast(tr("settings.toast.browserFail"), "error");
    }
  }

  // Passos do tutorial (numerados na UI).
  const tutorialSteps = $derived<{ title: string; body: string }[]>([
    { title: $t("tut.step1Title"), body: $t("tut.step1Body") },
    { title: $t("tut.step2Title"), body: $t("tut.step2Body") },
    { title: $t("tut.step3Title"), body: $t("tut.step3Body") },
    { title: $t("tut.step4Title"), body: $t("tut.step4Body") },
    { title: $t("tut.step5Title"), body: $t("tut.step5Body") },
    { title: $t("tut.step6Title"), body: $t("tut.step6Body") },
    { title: $t("tut.step7Title"), body: $t("tut.step7Body") },
    { title: $t("tut.step8Title"), body: $t("tut.step8Body") },
  ]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.update((s) => ({ ...s, [key]: value }));
  }

  const vaultName = $derived($currentVaultPath ? ($currentVaultPath.split(/[\\/]/).pop() ?? "—") : "—");

  async function pickVault() {
    const sel = await openDialog({ directory: true, multiple: false, title: tr("set.openVaultTitle") });
    if (typeof sel !== "string") return;
    await setVault(sel);
    showToast(tr("set.vaultOpened"), "success");
  }

  // Reconstruir cache do vault (reindexa grafo + views + árvore).
  let rebuilding = $state(false);
  async function rebuildCache() {
    const v = $currentVaultPath;
    if (!v || rebuilding) return;
    rebuilding = true;
    try {
      await refreshTree();
      await loadGraph(v);
      await loadQueryIndex(v, true);
      showToast(tr("set.rebuildDone"), "success");
    } catch (e) {
      showToast(tr("set.rebuildError", { error: `${e}` }), "error");
    } finally {
      rebuilding = false;
    }
  }

  const fonts: EditorFont[] = ["JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas"];
  const delays = $derived([
    { v: 500, label: $t("set.delayFast") },
    { v: 700, label: $t("set.delayDefault") },
    { v: 800, label: $t("set.delayRelaxed") },
    { v: 1500, label: $t("set.delaySlow") },
  ]);
  // ---- Atalhos editáveis ----
  let capturing = $state<string | null>(null);
  let shortcutFilter = $state("");
  const filteredShortcuts = $derived(
    shortcutFilter.trim()
      ? SHORTCUT_ACTIONS.filter((a) =>
          tr(`cmd.${a.id}`).toLowerCase().includes(shortcutFilter.trim().toLowerCase())
        )
      : SHORTCUT_ACTIONS
  );
  function startCapture(id: string) {
    capturing = id;
  }
  function onCaptureKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    if (e.key === "Escape") {
      capturing = null;
      return;
    }
    // ignora teclas modificadoras sozinhas
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    if (!(e.ctrlKey || e.metaKey)) return; // exige Ctrl/Cmd para evitar conflito
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    parts.push(e.key.toLowerCase());
    const combo = parts.join("+");
    const id = capturing;
    capturing = null;
    settings.update((s) => {
      const next = { ...s.shortcuts };
      // se outro já usa esse combo, libera o antigo
      for (const k of Object.keys(next)) if (next[k] === combo) next[k] = "";
      next[id] = combo;
      return { ...s, shortcuts: next };
    });
  }
  function resetShortcuts() {
    settings.update((s) => ({ ...s, shortcuts: { ...DEFAULT_SHORTCUTS } }));
    showToast(tr("set.shortcutsRestored"), "success");
  }
</script>

<svelte:window onkeydown={onCaptureKey} />

{#if open}
  <div
    class="qmodal-overlay fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={(e) => e.target === e.currentTarget && (open = false)}
    onkeydown={(e) => e.key === "Escape" && (open = false)}
    role="presentation"
  >
    <div
      class="qmodal-panel qsettings flex h-[600px] max-h-[88vh] w-full max-w-[680px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      transition:fly={{ y: 24, duration: 250, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      aria-label={$t("common.settings")}
      tabindex="-1"
    >
      <!-- Rail de seções -->
      <nav class="qsettings-nav flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-bg/40 px-3 py-3">
        <div class="px-2 pb-2 pt-1 text-sm font-semibold">{$t("common.settings")}</div>
        {#each tabs as tab (tab.id)}
          <button
            class="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors {section ===
            tab.id
              ? 'bg-accent/15 text-accent-light'
              : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
            onclick={() => (section = tab.id)}
          >
            <tab.icon size={16} />
            {$t(`settings.tab.${tab.id}`)}
          </button>
        {/each}
      </nav>

      <!-- Conteúdo -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
          <span class="text-sm font-medium">{$t(`settings.tab.${section}`)}</span>
          <button
            onclick={() => (open = false)}
            class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div class="flex-1 overflow-auto p-5">
          {#key section}
          <div in:fly={{ y: 10, duration: 220, easing: cubicOut }}>
          {#if section === "geral"}
            <div class="space-y-3">
              <div class="card">
                <div class="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {$t("set.vaultCurrent")}
                </div>
                <div class="mt-1.5 text-sm font-medium">{vaultName}</div>
                <div class="mt-0.5 truncate text-xs text-text-secondary">
                  {$currentVaultPath ?? $t("set.noVaultOpen")}
                </div>
                <button
                  onclick={pickVault}
                  class="mt-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
                >
                  <FolderOpen size={15} /> {$t("set.switchVault")}
                </button>
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.autoOpenVault"),
                  $t("set.autoOpenVaultDesc"),
                  $settings.autoOpenVault,
                  () => set("autoOpenVault", !$settings.autoOpenVault)
                )}
              </div>

              <div class="card">
                <div class="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {$t("settings.language")} · Language · Idioma
                </div>
                <div class="mt-2 flex gap-2">
                  {#each LOCALES as l (l.id)}
                    <button
                      onclick={() => setLocale(l.id)}
                      class="flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] {$locale === l.id
                        ? 'border-accent bg-accent/15 text-text-primary'
                        : 'border-border bg-elevated text-text-secondary hover:text-text-primary'}"
                    >
                      <span class="text-base leading-none">{l.flag}</span>
                      {l.label}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {:else if section === "arquivos"}
            <div class="space-y-3">
              <div class="card">
                {@render segmentRow(
                  $t("set.newNoteLocation"),
                  $settings.newNoteLocation,
                  [
                    { v: "root", label: $t("set.locRoot") },
                    { v: "current", label: $t("set.locCurrent") },
                  ],
                  (v) => set("newNoteLocation", v as "root" | "current")
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.confirmDelete"),
                  $t("set.confirmDeleteDesc"),
                  $settings.confirmBeforeDelete,
                  () => set("confirmBeforeDelete", !$settings.confirmBeforeDelete)
                )}
              </div>

              <div class="card">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-sm">{$t("set.rebuildCache")}</div>
                    <div class="text-xs text-text-secondary">
                      {$t("set.rebuildCacheDesc")}
                    </div>
                  </div>
                  <button
                    onclick={rebuildCache}
                    disabled={rebuilding || !$currentVaultPath}
                    class="inline-flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm font-medium transition-all hover:bg-accent hover:text-bg active:scale-[0.97] disabled:opacity-50"
                  >
                    <RefreshCw size={14} class={rebuilding ? "animate-spin" : ""} /> {$t("set.rebuild")}
                  </button>
                </div>
              </div>
            </div>
          {:else if section === "plugins"}
            <div class="space-y-3">
              <p class="px-1 text-xs text-text-secondary">
                {$t("set.pluginsDesc")}
              </p>
              <div class="card">
                {#each FEATURE_PLUGINS as f, i (f.id)}
                  {#if i > 0}<div class="divider"></div>{/if}
                  {@render toggleRow(
                    $t(`feat.${f.id}`),
                    $t(`featd.${f.id}`),
                    $settings.features[f.id] ?? true,
                    () => setFeature(f.id, !($settings.features[f.id] ?? true))
                  )}
                {/each}
              </div>
            </div>
          {:else if section === "editor"}
            <div class="space-y-3">
              <div class="card">
                {@render sliderRow($t("set.fontSize"), $settings.fontSize, 12, 20, 1, "px", (v) =>
                  set("fontSize", v)
                )}
                <div class="divider"></div>
                {@render sliderRow($t("set.lineHeight"), $settings.lineHeight, 1.4, 2.2, 0.05, "", (v) =>
                  set("lineHeight", v)
                )}
                <div class="divider"></div>
                {@render selectRow($t("set.editorFont"), $settings.editorFont, fonts, (v) =>
                  set("editorFont", v as EditorFont)
                )}
                <div class="divider"></div>
                {@render segmentRow(
                  $t("set.tabSize"),
                  String($settings.tabSize),
                  [
                    { v: "2", label: $t("set.tab2") },
                    { v: "4", label: $t("set.tab4") },
                  ],
                  (v) => set("tabSize", +v)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.wordWrap"),
                  "",
                  $settings.wordWrap,
                  () => set("wordWrap", !$settings.wordWrap)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.lineNumbers"),
                  "",
                  $settings.lineNumbers,
                  () => set("lineNumbers", !$settings.lineNumbers)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.vimMode"),
                  $t("set.vimModeDesc"),
                  $settings.vimMode,
                  () => set("vimMode", !$settings.vimMode)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.slashMenu"),
                  $t("set.slashMenuDesc"),
                  $settings.slashMenu,
                  () => set("slashMenu", !$settings.slashMenu)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.wikilinkAutocomplete"),
                  $t("set.wikilinkAutocompleteDesc"),
                  $settings.wikilinkAutocomplete,
                  () => set("wikilinkAutocomplete", !$settings.wikilinkAutocomplete)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.readableLineLength"),
                  $t("set.readableLineLengthDesc"),
                  $settings.readableLineLength,
                  () => set("readableLineLength", !$settings.readableLineLength)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.closeBrackets"),
                  $t("set.closeBracketsDesc"),
                  $settings.closeBrackets,
                  () => set("closeBrackets", !$settings.closeBrackets)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.spellcheck"),
                  $t("set.spellcheckDesc"),
                  $settings.spellcheck,
                  () => set("spellcheck", !$settings.spellcheck)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.rtl"),
                  $t("set.rtlDesc"),
                  $settings.rtl,
                  () => set("rtl", !$settings.rtl)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.statusBar"),
                  $t("set.statusBarDesc"),
                  $settings.statusBar,
                  () => set("statusBar", !$settings.statusBar)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.hoverPreview"),
                  $t("set.hoverPreviewDesc"),
                  $settings.hoverPreview,
                  () => set("hoverPreview", !$settings.hoverPreview)
                )}
                {#if $settings.hoverPreview}
                  <div class="divider"></div>
                  {@render toggleRow(
                    $t("set.hoverPreviewCtrl"),
                    $t("set.hoverPreviewCtrlDesc"),
                    $settings.hoverPreviewCtrl,
                    () => set("hoverPreviewCtrl", !$settings.hoverPreviewCtrl)
                  )}
                {/if}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.propertiesPanel"),
                  $t("set.propertiesPanelDesc"),
                  $settings.propertiesPanel,
                  () => set("propertiesPanel", !$settings.propertiesPanel)
                )}
              </div>

              <div class="card">
                {@render segmentRow(
                  $t("set.defaultMode"),
                  $settings.defaultMode,
                  [
                    { v: "edit", label: $t("set.modeEdit") },
                    { v: "split", label: $t("set.modeSplit") },
                    { v: "read", label: $t("set.modeRead") },
                  ],
                  (v) => set("defaultMode", v as ViewMode)
                )}
              </div>

              <div class="card">
                <div class="flex items-center justify-between gap-4">
                  <div class="text-sm">{$t("set.autoSaveDelay")}</div>
                  <select
                    value={$settings.autoSaveDelay}
                    onchange={(e) => set("autoSaveDelay", +e.currentTarget.value)}
                    aria-label={$t("set.autoSaveDelay")}
                    class="rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none"
                  >
                    {#each delays as d (d.v)}
                      <option value={d.v}>{d.label}</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>
          {:else if section === "aparencia"}
            <div class="space-y-3">
              <div class="card">
                <div class="mb-2.5 text-sm">{$t("set.theme")}</div>
                <div class="flex gap-2">
                  <button
                    onclick={() => set("theme", "dark")}
                    class="flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors {$settings.theme ===
                    'dark'
                      ? 'border-accent bg-accent/15 text-accent-light'
                      : 'border-border text-text-secondary hover:bg-elevated'}"
                  >
                    {#if $settings.theme === "dark"}<Check size={14} class="mb-0.5 inline" />{/if} {$t("set.themeDark")}
                  </button>
                  <button
                    onclick={() => set("theme", "light")}
                    class="flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors {$settings.theme ===
                    'light'
                      ? 'border-accent bg-accent/15 text-accent-light'
                      : 'border-border text-text-secondary hover:bg-elevated'}"
                  >
                    {#if $settings.theme === "light"}<Check size={14} class="mb-0.5 inline" />{/if} {$t("set.themeLight")}
                  </button>
                </div>
              </div>

              <div class="card">
                <div class="mb-2.5 flex items-center justify-between">
                  <div class="text-sm">{$t("set.accentColor")}</div>
                  {#if $settings.accentColor}
                    <button
                      onclick={() => set("accentColor", "")}
                      class="text-xs text-text-secondary hover:text-accent-light"
                    >
                      {$t("set.restore")}
                    </button>
                  {/if}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  {#each ACCENTS as a (a)}
                    <button
                      onclick={() => set("accentColor", a)}
                      aria-label={a}
                      title={a}
                      class="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 {(
                        $settings.accentColor || '').toLowerCase() === a.toLowerCase()
                        ? 'border-text-primary'
                        : 'border-transparent'}"
                      style="background:{a}"
                    ></button>
                  {/each}
                  <label
                    class="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2 text-xs text-text-secondary hover:bg-elevated"
                    title={$t("set.customColor")}
                  >
                    <Pipette size={13} />
                    <input
                      type="color"
                      value={$settings.accentColor || "#67e8f9"}
                      oninput={(e) => set("accentColor", e.currentTarget.value)}
                      class="h-0 w-0 opacity-0"
                      aria-label={$t("set.customColor")}
                    />
                  </label>
                </div>
                <div class="divider"></div>
                {@render sliderRow(
                  $t("set.appZoom"),
                  Math.round($settings.appZoom * 100),
                  80,
                  140,
                  5,
                  "%",
                  (v) => set("appZoom", v / 100)
                )}
                <div class="divider"></div>
                {@render sliderRow(
                  $t("set.uiFontScale"),
                  Math.round($settings.uiFontScale * 100),
                  85,
                  125,
                  5,
                  "%",
                  (v) => set("uiFontScale", v / 100)
                )}
              </div>

              <div class="card">
                {@render segmentRow(
                  $t("set.density"),
                  $settings.density,
                  [
                    { v: "comfortable", label: $t("set.densityComfortable") },
                    { v: "compact", label: $t("set.densityCompact") },
                  ],
                  (v) => set("density", v as Density)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.animations"),
                  $t("set.animationsDesc"),
                  $settings.animations,
                  () => set("animations", !$settings.animations)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.graphContinuous"),
                  $t("set.graphContinuousDesc"),
                  $settings.graphContinuous,
                  () => set("graphContinuous", !$settings.graphContinuous)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.sfx"),
                  $t("set.sfxDesc"),
                  $settings.sfx,
                  () => set("sfx", !$settings.sfx)
                )}
                {#if $settings.sfx}
                  <div class="divider"></div>
                  {@render sliderRow(
                    $t("set.volume"),
                    Math.round($settings.sfxVolume * 100),
                    0,
                    100,
                    5,
                    "%",
                    (v) => set("sfxVolume", v / 100)
                  )}
                {/if}
              </div>

              <div class="card">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <div class="text-sm">{$t("set.cssSnippets")}</div>
                  <div class="flex gap-1.5">
                    <button
                      onclick={() => $currentVaultPath && loadSnippets($currentVaultPath)}
                      title={$t("set.reload")}
                      class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onclick={openSnippetsFolder}
                      title={$t("set.openSnippetsFolder")}
                      class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                    >
                      <FolderInput size={14} />
                    </button>
                  </div>
                </div>
                <div class="text-xs text-text-secondary">
                  {$t("set.snippetsDescBefore")} <code class="text-accent-light">.css</code> {$t("set.snippetsDescMid")}
                  <code class="text-accent-light">.quartzo/snippets</code> {$t("set.snippetsDescAfter")}
                </div>
                <div class="mt-3 space-y-2">
                  {#if !$currentVaultPath}
                    <div class="text-xs text-text-muted">{$t("set.snippetsNoVault")}</div>
                  {:else if snippets.length === 0}
                    <div class="text-xs text-text-muted">
                      {$t("set.snippetsEmptyBefore")} <FolderInput size={12} class="inline" /> {$t("set.snippetsEmptyAfter")}
                      <code>.css</code>.
                    </div>
                  {:else}
                    {#each snippets as sn (sn.name)}
                      {@render toggleRow(
                        sn.name,
                        "",
                        $settings.enabledSnippets.includes(sn.name),
                        () => toggleSnippet(sn.name)
                      )}
                    {/each}
                  {/if}
                </div>
              </div>
            </div>
          {:else if section === "markdown"}
            <div class="space-y-3">
              <div class="card">
                {@render toggleRow(
                  $t("set.renderMermaid"),
                  $t("set.renderMermaidDesc"),
                  $settings.renderMermaid,
                  () => set("renderMermaid", !$settings.renderMermaid)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.renderQueries"),
                  $t("set.renderQueriesDesc"),
                  $settings.renderQueries,
                  () => set("renderQueries", !$settings.renderQueries)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.renderVideo"),
                  $t("set.renderVideoDesc"),
                  $settings.renderVideo,
                  () => set("renderVideo", !$settings.renderVideo)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.embedNotes"),
                  $t("set.embedNotesDesc"),
                  $settings.embedNotes,
                  () => set("embedNotes", !$settings.embedNotes)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.renderMath"),
                  $t("set.renderMathDesc"),
                  $settings.renderMath,
                  () => set("renderMath", !$settings.renderMath)
                )}
              </div>

              <div class="card">
                {@render toggleRow(
                  $t("set.inlineColors"),
                  $t("set.inlineColorsDesc"),
                  $settings.inlineColors,
                  () => set("inlineColors", !$settings.inlineColors)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.codeCopyButton"),
                  "",
                  $settings.codeCopyButton,
                  () => set("codeCopyButton", !$settings.codeCopyButton)
                )}
                <div class="divider"></div>
                {@render toggleRow(
                  $t("set.codeLineNumbers"),
                  "",
                  $settings.codeLineNumbers,
                  () => set("codeLineNumbers", !$settings.codeLineNumbers)
                )}
                <div class="divider"></div>
                {@render sliderRow(
                  $t("set.paletteColors"),
                  $settings.paletteColors,
                  2,
                  12,
                  1,
                  "",
                  (v) => set("paletteColors", v)
                )}
              </div>
            </div>
          {:else if section === "tipos"}
            <div class="space-y-3">
              <div class="card">
                <div class="text-sm font-medium">{$t("set.noteTypes")}</div>
                <div class="mt-1 text-xs leading-relaxed text-text-secondary">
                  {$t("set.noteTypesDescBefore")}
                  <strong>{$t("set.noteTypesDescStrong")}</strong>
                </div>
              </div>

              {#if !$currentVaultPath}
                <div class="card text-sm text-text-secondary">{$t("set.typesNoVault")}</div>
              {:else}
                {#each types as nt, i (nt.id)}
                  <div class="card space-y-2">
                    <div class="flex items-center gap-2">
                      <input
                        bind:value={nt.emoji}
                        oninput={() => (typesDirty = true)}
                        aria-label={$t("set.typeEmoji")}
                        class="w-10 rounded-lg bg-elevated px-2 py-1.5 text-center text-sm outline-none"
                      />
                      <input
                        bind:value={nt.name}
                        oninput={() => (typesDirty = true)}
                        placeholder={$t("set.typeNamePlaceholder")}
                        aria-label={$t("set.typeName")}
                        class="flex-1 rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none"
                      />
                      <button onclick={() => removeType(i)} title={$t("set.typeDelete")} class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <input
                      bind:value={nt.folder}
                      oninput={() => (typesDirty = true)}
                      placeholder={$t("set.typeFolderPlaceholder")}
                      aria-label={$t("set.typeFolder")}
                      class="w-full rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none"
                    />
                    <input
                      value={fieldsStr(nt)}
                      oninput={(e) => setFields(nt, e.currentTarget.value)}
                      placeholder={$t("set.typeFieldsPlaceholder")}
                      aria-label={$t("set.typeFields")}
                      class="w-full rounded-lg bg-elevated px-3 py-1.5 font-mono text-xs outline-none"
                    />
                    <textarea
                      bind:value={nt.body}
                      oninput={() => (typesDirty = true)}
                      placeholder={$t("set.typeBodyPlaceholder")}
                      rows="3"
                      aria-label={$t("set.typeBody")}
                      class="w-full resize-y rounded-lg bg-elevated px-3 py-1.5 font-mono text-xs outline-none"
                    ></textarea>
                  </div>
                {/each}

                <div class="flex items-center gap-2">
                  <button
                    onclick={addType}
                    class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm text-text-primary transition-all hover:bg-elevated/70 active:scale-[0.97]"
                  >
                    <Layers size={15} /> {$t("set.addType")}
                  </button>
                  <button
                    onclick={restoreTypes}
                    class="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                  >
                    {$t("set.restoreDefaults")}
                  </button>
                  <button
                    onclick={saveTypes}
                    disabled={!typesDirty}
                    class="ml-auto flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
                  >
                    <Check size={15} /> {$t("set.saveTypes")}
                  </button>
                </div>
              {/if}
            </div>
          {:else if section === "nuvem"}
            <div class="space-y-3">
              <div class="card">
                <div class="text-sm font-medium">{$t("set.cloudSync")}</div>
                <div class="mt-1 text-xs leading-relaxed text-text-secondary">
                  {$t("set.cloudSyncDescBefore")} <strong>Google Drive</strong> {$t("set.cloudSyncDescAfter")}
                </div>
              </div>

              {#if !isMobile}
                <div class="card flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{$t("set.saveAllTitle")}</div>
                    <div class="mt-1 text-xs leading-relaxed text-text-secondary">{$t("set.saveAllDesc")}</div>
                  </div>
                  <button
                    onclick={saveAll}
                    disabled={savingAll}
                    class="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
                  >
                    {#if savingAll}<Loader2 size={14} class="animate-spin" />{:else}<CloudUpload size={15} />{/if}
                    {$t("set.saveAllBtn")}
                  </button>
                </div>
              {/if}

              {#if vaultInCloud}
                <div class="card flex items-center gap-2.5">
                  <CheckCircle2 size={20} class="shrink-0 text-success" />
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{$t("set.cloudAlready")}</div>
                    <div class="truncate text-xs text-text-secondary">
                      {$t("set.cloudAlreadySub", { name: vaultInCloud.name })}
                    </div>
                  </div>
                </div>
              {:else if cloudFolders.length === 0}
                <div class="card">
                  <div class="flex items-start gap-2.5 text-sm text-text-secondary">
                    <AlertCircle size={18} class="mt-0.5 shrink-0 text-warning" />
                    <div>
                      {$t("set.cloudNoneBefore")}
                      <strong>Google Drive para Desktop</strong> {$t("set.cloudNoneAfter")}
                      <button
                        onclick={() => openUrl("https://www.google.com/drive/download/")}
                        class="mt-1 flex items-center gap-1 text-xs text-accent-light hover:underline"
                      >
                        {$t("set.cloudDownloadDrive")} <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                  <button
                    onclick={loadClouds}
                    class="mt-3 flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm text-text-primary transition-all hover:bg-elevated/70 active:scale-[0.97]"
                  >
                    <RefreshCw size={14} /> {$t("set.reload")}
                  </button>
                </div>
              {:else}
                <div class="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {$t("set.cloudMoveTo")}
                </div>
                {#each cloudFolders as f (f.path)}
                  <div class="card flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-medium">{f.name}</div>
                      <div class="truncate text-xs text-text-secondary">{f.path}</div>
                    </div>
                    <button
                      onclick={() => moveToCloud(f)}
                      disabled={movingCloud || !$currentVaultPath}
                      class="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
                    >
                      {#if movingCloud}
                        <Loader2 size={14} class="animate-spin" />
                      {:else}
                        <CloudUpload size={15} />
                      {/if}
                      {$t("set.cloudMove")}
                    </button>
                  </div>
                {/each}
                <div class="text-[11px] leading-relaxed text-text-muted">
                  {$t("set.cloudFootnoteBefore")}
                  <code>Quartzo/{$currentVaultPath?.split(/[\\/]/).pop() ?? ""}</code>.
                </div>
              {/if}
            </div>
          {:else if section === "integracoes"}
            <div class="space-y-3">
              <div class="card">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <Boxes size={16} class="text-accent" /> {$t("set.ecosystem")}
                </div>
                <div class="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  {@html $t("set.ecosystemDesc")}
                </div>
                <div class="mt-2.5 text-[11px] leading-relaxed text-text-muted">
                  {$t("set.ecosystemFlow")}
                </div>
              </div>

              <!-- PRISMA -->
              <div class="card">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-medium">PRISMA</div>
                    <div class="text-xs text-text-secondary">
                      {prismaOk ? $t("set.prismaInstalled") : $t("set.prismaNotFound")}
                    </div>
                  </div>
                  <button
                    onclick={openPrisma}
                    class="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
                  >
                    <Boxes size={15} /> {$t("set.openPrisma")}
                  </button>
                </div>
              </div>

              <!-- Anexar mídia do PRISMA numa nota -->
              <div class="card">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{$t("set.attachMedia")}</div>
                    <div class="text-xs text-text-secondary">
                      {$t("set.attachMediaDesc")}
                    </div>
                  </div>
                  <button
                    onclick={() => {
                      open = false;
                      prismaPickerOpen.set(true);
                    }}
                    class="flex shrink-0 items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm font-medium transition-all hover:bg-accent/15 hover:text-accent-light active:scale-[0.97]"
                  >
                    <Boxes size={15} /> {$t("set.attachMediaBtn")}
                  </button>
                </div>
              </div>

              <!-- Conectar este vault como base de conhecimento -->
              <div class="card">
                <div class="text-sm font-medium">{$t("set.useVaultInPrisma")}</div>
                <div class="mt-1 text-xs leading-relaxed text-text-secondary">
                  {@html $t("set.useVaultInPrismaDesc")}
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <code class="min-w-0 flex-1 truncate rounded-lg bg-elevated px-3 py-1.5 text-xs">
                    {$currentVaultPath ?? $t("set.openVaultFirstInline")}
                  </code>
                  <button
                    onclick={copyVaultPath}
                    disabled={!$currentVaultPath}
                    title={$t("set.copyPath")}
                    class="shrink-0 rounded-lg bg-elevated p-2 text-text-secondary transition-colors hover:bg-elevated/70 hover:text-text-primary disabled:opacity-50"
                  >
                    <Copy size={15} />
                  </button>
                </div>
                <div class="mt-2 text-[11px] leading-relaxed text-text-muted">
                  {$t("set.useVaultTip")}
                </div>
              </div>

              <!-- DaVinci -->
              <div class="card">
                <div class="flex items-center gap-2 text-sm font-medium">
                  <Clapperboard size={16} class="text-accent" /> DaVinci Resolve
                </div>
                <div class="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  {@html $t("set.davinciDesc")}
                </div>
              </div>
            </div>
          {:else if section === "atalhos"}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-text-secondary">{$t("set.shortcutsHint")}</span>
                <button onclick={resetShortcuts} class="rounded-lg px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary">
                  {$t("set.restoreDefaults")}
                </button>
              </div>
              <div class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5">
                <Search size={14} class="text-text-secondary" />
                <input
                  bind:value={shortcutFilter}
                  placeholder={$t("set.filterCommands")}
                  class="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
                />
                <span class="shrink-0 text-xs text-text-muted">{filteredShortcuts.length}</span>
              </div>
              <div class="overflow-hidden rounded-xl border border-border">
                {#each filteredShortcuts as a, i (a.id)}
                  <div class="flex items-center justify-between px-4 py-2.5 text-sm {i % 2 ? 'bg-bg/20' : ''}">
                    <span class="text-text-secondary">{$t(`cmd.${a.id}`)}</span>
                    <button
                      onclick={() => startCapture(a.id)}
                      class="min-w-[96px] rounded-md border px-2 py-0.5 text-center font-mono text-xs transition-colors {capturing ===
                      a.id
                        ? 'border-accent bg-accent/15 text-accent-light'
                        : 'border-border bg-elevated text-text-primary hover:border-accent/50'}"
                    >
                      {capturing === a.id ? $t("set.pressKeys") : $settings.shortcuts[a.id] ? formatCombo($settings.shortcuts[a.id]) : "—"}
                    </button>
                  </div>
                {/each}
              </div>
              <div class="px-1 text-[11px] text-text-muted">
                {$t("set.shortcutsFixed")} <kbd class="font-mono">Ctrl+S</kbd> {$t("set.shortcutsSave")} · <kbd class="font-mono">Ctrl/Cmd+clique</kbd> {$t("set.shortcutsFollowLink")} · <kbd class="font-mono">Esc</kbd> {$t("set.shortcutsCancelCapture")}
              </div>
            </div>
          {:else if section === "atualizacoes"}
            <div class="space-y-3">
              <div class="card">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-sm font-medium">{$t("set.installedVersion")}</div>
                    <div class="mt-0.5 text-xs text-text-secondary">Quartzo {appVersion}</div>
                  </div>
                  <button
                    onclick={runUpdateCheck}
                    disabled={checking}
                    class="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
                  >
                    {#if checking}
                      <Loader2 size={15} class="animate-spin" /> {$t("set.checking")}
                    {:else}
                      <RefreshCw size={15} /> {$t("set.checkUpdate")}
                    {/if}
                  </button>
                </div>

                {#if update}
                  <div class="divider"></div>
                  {#if update.status === "available"}
                    <div class="flex items-start gap-2.5 rounded-lg bg-accent/10 p-3">
                      <ArrowUpCircle size={18} class="mt-0.5 shrink-0 text-accent-light" />
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-accent-light">
                          {$t("set.updateAvailable", { version: update.latest ?? "" })}
                        </div>
                        <div class="text-xs text-text-secondary">
                          {$t("set.updateAvailableSub", { current: update.current ?? "" })}
                        </div>
                        <button
                          onclick={() => openReleases(update?.url)}
                          class="mt-2 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
                        >
                          <Download size={13} /> {$t("set.download", { version: update.latest ?? "" })}
                        </button>
                      </div>
                    </div>
                  {:else if update.status === "latest"}
                    <div class="flex items-center gap-2.5 text-sm text-success">
                      <CheckCircle2 size={18} /> {$t("set.upToDate")}
                    </div>
                  {:else}
                    <div class="flex items-start gap-2.5 text-sm text-text-secondary">
                      <AlertCircle size={18} class="mt-0.5 shrink-0 text-warning" />
                      <div>
                        {update.message}
                        <button
                          onclick={() => openReleases()}
                          class="mt-1 flex items-center gap-1 text-xs text-accent-light hover:underline"
                        >
                          {$t("set.seeReleases")} <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>
                  {/if}
                {/if}
                <div class="mt-2 text-[11px] text-text-muted">
                  {$t("set.checksAt", { repo: GITHUB_REPO })}
                </div>
              </div>

              <!-- Notas de atualização (changelog) -->
              <div class="text-xs font-medium uppercase tracking-wider text-text-muted">
                {$t("set.changelog")}
              </div>
              {#each CHANGELOG as entry (entry.version)}
                <div class="card">
                  <div class="flex items-baseline justify-between">
                    <div class="text-sm font-semibold text-accent-light">v{entry.version}</div>
                    <div class="text-xs text-text-muted">{entry.date}</div>
                  </div>
                  <ul class="mt-2 space-y-1">
                    {#each entry.items as item (item)}
                      <li class="flex gap-2 text-xs text-text-secondary">
                        <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent"></span>
                        <span>{item}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {:else if section === "tutorial"}
            <div class="space-y-3">
              <div class="card flex items-center gap-3">
                <CrystalIllustration size={44} glow={0.5} />
                <div>
                  <div class="text-sm font-medium">{$t("set.tutorialTitle")}</div>
                  <div class="text-xs text-text-secondary">
                    {$t("set.tutorialSub")}
                  </div>
                </div>
              </div>
              {#each tutorialSteps as step, i (step.title)}
                <div class="card flex gap-3">
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-light"
                  >
                    {i + 1}
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium">{step.title}</div>
                    <div class="mt-0.5 text-xs leading-relaxed text-text-secondary">{step.body}</div>
                  </div>
                </div>
              {/each}
              <button
                onclick={() => (section = "atalhos")}
                class="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
              >
                <Keyboard size={15} /> {$t("set.seeAllShortcuts")}
              </button>
            </div>
          {:else if section === "sobre"}
            <div class="flex h-full flex-col items-center justify-center text-center">
              <CrystalIllustration size={84} glow={0.55} />
              <div class="mt-4 text-xl font-semibold">Quartzo</div>
              <div class="mt-1 text-sm text-text-secondary">{$t("about.version", { version: appVersion })}</div>
              <div class="mt-4 max-w-xs text-xs leading-relaxed text-text-muted">
                {$t("about.tagline")}
                <br />{$t("about.credits")}
              </div>
            </div>
          {/if}
          </div>
          {/key}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ===== snippets de controles ===== -->
{#snippet toggleRow(label: string, hint: string, value: boolean, onToggle: () => void)}
  <div class="flex items-center justify-between gap-4">
    <div>
      <div class="text-sm">{label}</div>
      {#if hint}<div class="text-xs text-text-secondary">{hint}</div>{/if}
    </div>
    <button
      onclick={onToggle}
      role="switch"
      aria-checked={value}
      aria-label={label}
      class="relative h-6 w-11 shrink-0 rounded-full transition-colors {value
        ? 'bg-accent'
        : 'bg-elevated'}"
    >
      <span
        class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all {value
          ? 'left-[22px]'
          : 'left-0.5'}"
      ></span>
    </button>
  </div>
{/snippet}

{#snippet sliderRow(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  onInput: (v: number) => void
)}
  <div class="flex items-center justify-between gap-4">
    <div>
      <div class="text-sm">{label}</div>
      <div class="text-xs text-text-secondary">{value}{unit}</div>
    </div>
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      aria-label={label}
      oninput={(e) => onInput(+e.currentTarget.value)}
      class="q-range w-44"
    />
  </div>
{/snippet}

{#snippet selectRow(label: string, value: string, options: string[], onPick: (v: string) => void)}
  <div class="flex items-center justify-between gap-4">
    <div class="text-sm">{label}</div>
    <select
      {value}
      onchange={(e) => onPick(e.currentTarget.value)}
      aria-label={label}
      class="rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none"
    >
      {#each options as opt (opt)}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  </div>
{/snippet}

{#snippet segmentRow(
  label: string,
  value: string,
  options: { v: string; label: string }[],
  onPick: (v: string) => void
)}
  <div class="flex items-center justify-between gap-4">
    <div class="text-sm">{label}</div>
    <div class="flex rounded-lg bg-elevated p-0.5">
      {#each options as opt (opt.v)}
        <button
          onclick={() => onPick(opt.v)}
          class="rounded-md px-3 py-1 text-sm transition-colors {value === opt.v
            ? 'bg-accent text-bg'
            : 'text-text-secondary hover:text-text-primary'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<style>
  .card {
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: rgba(10, 15, 28, 0.35);
    padding: 14px 16px;
  }
  .divider {
    height: 1px;
    background: var(--color-border);
    opacity: 0.5;
    margin: 12px 0;
  }
  .q-range {
    appearance: none;
    height: 4px;
    border-radius: 9999px;
    background: var(--color-elevated);
    outline: none;
    cursor: pointer;
  }
  .q-range::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface);
    box-shadow: 0 0 8px rgba(103, 232, 249, 0.5);
    cursor: pointer;
    transition: transform 0.15s var(--ease-out);
  }
  .q-range::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
</style>
