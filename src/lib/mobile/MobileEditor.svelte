<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    ChevronLeft, PenLine, BookOpen, Check, Loader2,
    Bold, Italic, Heading2, List, ListChecks, Quote, Code, Link as LinkIcon, Image as ImageIcon,
  } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { settings } from "$lib/stores/settings";
  import { showToast } from "$lib/stores/toast";
  import { wrapSelection, toggleLinePrefix, insertAtCursor } from "$lib/stores/editor";
  import { openWikilink, openNote } from "$lib/vault-actions";
  import { t, tr } from "$lib/i18n";
  import CodeMirror from "$lib/components/editor/CodeMirror.svelte";
  import MarkdownPreview from "$lib/components/editor/MarkdownPreview.svelte";

  let { onBack }: { onBack?: () => void } = $props();

  const activeTab = $derived($openTabs.find((t) => t.path === $activeTabPath) ?? null);
  const noteName = $derived(activeTab ? activeTab.name.replace(/\.md$/i, "") : "");

  type Mode = "edit" | "read";
  let mode = $state<Mode>("edit");
  let saving = $state(false);

  // ---- salvar (mesma lógica do desktop, glue local) ----
  function markContent(path: string, content: string, dirty: boolean) {
    openTabs.update((tabs) => tabs.map((tb) => (tb.path === path ? { ...tb, content, dirty } : tb)));
  }
  async function save(path: string, content: string) {
    saving = true;
    try {
      await invoke("write_file", { path, content });
      markContent(path, content, false);
    } catch (e) {
      showToast(tr("editor.saveError", { error: String(e) }), "error");
    } finally {
      saving = false;
    }
  }
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function onChange(value: string) {
    const path = activeTab?.path;
    if (!path) return;
    markContent(path, value, true);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(path, value), $settings.autoSaveDelay);
  }

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });

  // Ações da barra (reusam os helpers do store do editor).
  const fmt = [
    { icon: Heading2, label: "H", run: () => toggleLinePrefix("## ") },
    { icon: Bold, label: "B", run: () => wrapSelection("**") },
    { icon: Italic, label: "I", run: () => wrapSelection("*") },
    { icon: List, label: "•", run: () => toggleLinePrefix("- ") },
    { icon: ListChecks, label: "[]", run: () => toggleLinePrefix("- [ ] ") },
    { icon: Quote, label: ">", run: () => toggleLinePrefix("> ") },
    { icon: Code, label: "`", run: () => wrapSelection("`") },
    { icon: LinkIcon, label: "link", run: () => wrapSelection("[", "]()") },
  ];
  // mexer na seleção/cursor não pode roubar o foco do editor (senão fecha o teclado)
  function apply(e: Event, run: () => void) {
    e.preventDefault();
    run();
  }
</script>

<div class="me">
  <!-- topbar nativa -->
  <div class="me-top">
    <button class="me-back" onclick={() => onBack?.()} aria-label={$t("titlebar.navBack")}>
      <ChevronLeft size={24} />
    </button>
    <span class="me-name">{noteName}</span>
    <span class="me-status" aria-hidden="true">
      {#if saving}
        <Loader2 size={14} class="spin" />
      {:else if activeTab?.dirty}
        <span class="dot"></span>
      {:else}
        <Check size={14} />
      {/if}
    </span>
    <button class="me-mode" onclick={() => (mode = mode === "edit" ? "read" : "edit")}>
      {#if mode === "edit"}
        <BookOpen size={16} /> {$t("editor.modeRead")}
      {:else}
        <PenLine size={16} /> {$t("editor.modeEdit")}
      {/if}
    </button>
  </div>

  <!-- barra de formatação (topo do editor, sempre visível — não depende do
       inset do teclado, que o edge-to-edge do Tauri não repassa ao WebView) -->
  {#if mode === "edit"}
    <div class="me-fmt">
      {#each fmt as f (f.label)}
        {@const Icon = f.icon}
        <button
          class="me-fmt-btn"
          onpointerdown={(e) => apply(e, f.run)}
          aria-label={f.label}
        >
          <Icon size={20} />
        </button>
      {/each}
    </div>
  {/if}

  <!-- conteúdo -->
  <div class="me-body">
    {#if activeTab}
      {#if mode === "edit"}
        <CodeMirror
          doc={activeTab.content}
          path={activeTab.path}
          {onChange}
          onOpenWikilink={openWikilink}
        />
      {:else}
        <div class="me-read" class:pv-readable={$settings.readableLineLength}>
          <MarkdownPreview
            content={activeTab.content}
            notePath={activeTab.path}
            onOpenWikilink={openWikilink}
            onOpenPath={openNote}
          />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .me {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-bg);
  }
  .me-top {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 50px;
    padding: calc(env(safe-area-inset-top) + 6px) 10px 6px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .me-back {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    margin-left: -4px;
    border-radius: 10px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .me-back:active {
    background: var(--color-elevated);
  }
  .me-name {
    flex: 1;
    min-width: 0;
    font-size: 0.98rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-status {
    display: grid;
    place-items: center;
    width: 22px;
    color: var(--color-text-muted);
  }
  .me-status .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-accent);
  }
  .me-status :global(.spin) {
    animation: me-spin 0.9s linear infinite;
  }
  @keyframes me-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .me-mode {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-accent-light);
    background: var(--color-elevated);
    flex-shrink: 0;
  }
  .me-mode:active {
    transform: scale(0.96);
  }
  .me-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .me-read {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--color-bg);
  }
  /* barra de formatação: estática no topo do editor (sempre visível). QUEBRA pra
     2ª linha se não couber (flex-wrap) — nunca scroll horizontal (regra do Manual:
     barra-de-controles-quebrar). Não depende do teclado. */
  .me-fmt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    min-height: 46px;
    padding: 4px 6px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }
  .me-fmt-btn {
    display: grid;
    place-items: center;
    min-width: 44px;
    height: 38px;
    border-radius: 9px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .me-fmt-btn:active {
    background: var(--color-elevated);
    color: var(--color-accent-light);
  }
</style>
