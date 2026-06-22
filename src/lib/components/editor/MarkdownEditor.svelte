<script lang="ts">
  import {
    PenLine, Columns2, BookOpen, Check, Loader2, Link2, List, Printer,
    Bold, Italic, Strikethrough, Code, Quote, ListOrdered, ListChecks,
    Heading1, Heading2, Table, SquareCode, Image as ImageIcon, Minus, Link as LinkIcon, Lightbulb,
  } from "@lucide/svelte";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { printNote } from "$lib/export";
  import { insertAtCursor, wrapSelection, toggleLinePrefix } from "$lib/stores/editor";
  import { invoke } from "@tauri-apps/api/core";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { showToast } from "$lib/stores/toast";
  import { settings } from "$lib/stores/settings";
  import { backlinksOpen, outlineOpen } from "$lib/stores/ui";
  import { openWikilink, openNote } from "$lib/vault-actions";
  import CodeMirror from "./CodeMirror.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";

  type Mode = "edit" | "split" | "read";
  let mode = $state<Mode>($settings.defaultMode);

  const activeTab = $derived($openTabs.find((t) => t.path === $activeTabPath) ?? null);

  let saving = $state(false);

  function markContent(path: string, content: string, dirty: boolean) {
    openTabs.update((tabs) => tabs.map((t) => (t.path === path ? { ...t, content, dirty } : t)));
  }

  async function save(path: string, content: string) {
    saving = true;
    try {
      await invoke("write_file", { path, content });
      markContent(path, content, false);
    } catch (e) {
      showToast(`Erro ao salvar: ${e}`, "error");
    } finally {
      saving = false;
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave(path: string, content: string) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(path, content), $settings.autoSaveDelay);
  }

  function onChange(value: string) {
    const path = activeTab?.path;
    if (!path) return;
    markContent(path, value, true);
    scheduleSave(path, value);
  }

  async function insertImage() {
    const sel = await openDialog({
      multiple: false,
      title: "Inserir imagem",
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"] }],
    });
    if (typeof sel !== "string") return;
    const name = sel.split(/[\\/]/).pop() ?? "";
    insertAtCursor(`![[${name}]]`);
  }

  // Ferramentas de criação/formatação (atuam na seleção do editor).
  const tools = [
    { icon: Heading1, title: "Título 1", run: () => toggleLinePrefix("# ") },
    { icon: Heading2, title: "Título 2", run: () => toggleLinePrefix("## ") },
    { sep: true },
    { icon: Bold, title: "Negrito", run: () => wrapSelection("**") },
    { icon: Italic, title: "Itálico", run: () => wrapSelection("*") },
    { icon: Strikethrough, title: "Tachado", run: () => wrapSelection("~~") },
    { icon: Code, title: "Código inline", run: () => wrapSelection("`") },
    { sep: true },
    { icon: List, title: "Lista", run: () => toggleLinePrefix("- ") },
    { icon: ListOrdered, title: "Lista numerada", run: () => toggleLinePrefix("1. ") },
    { icon: ListChecks, title: "Tarefa", run: () => toggleLinePrefix("- [ ] ") },
    { icon: Quote, title: "Citação", run: () => toggleLinePrefix("> ") },
    { sep: true },
    { icon: LinkIcon, title: "Link", run: () => wrapSelection("[", "](url)") },
    { icon: ImageIcon, title: "Imagem", run: insertImage },
    { icon: Table, title: "Tabela", run: () => insertAtCursor("\n| Coluna | Coluna |\n| --- | --- |\n|  |  |\n") },
    { icon: SquareCode, title: "Bloco de código", run: () => insertAtCursor("\n```\n\n```\n") },
    { icon: Lightbulb, title: "Destaque (callout)", run: () => insertAtCursor("\n> [!note] Título\n> conteúdo\n") },
    { icon: Minus, title: "Linha divisória", run: () => insertAtCursor("\n---\n") },
  ];

  const modes: { id: Mode; icon: typeof PenLine; label: string }[] = [
    { id: "edit", icon: PenLine, label: "Editor" },
    { id: "split", icon: Columns2, label: "Dividido" },
    { id: "read", icon: BookOpen, label: "Leitura" },
  ];

  // ---- Scroll sincronizado (modo dividido) ----
  let edScroller = $state<HTMLElement>();
  let pvScroller = $state<HTMLElement>();
  let scrollLock = false;
  function syncScroll(src: HTMLElement, dst: HTMLElement) {
    if (scrollLock) return;
    scrollLock = true;
    const denom = src.scrollHeight - src.clientHeight;
    const ratio = denom > 0 ? src.scrollTop / denom : 0;
    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    requestAnimationFrame(() => (scrollLock = false));
  }
  $effect(() => {
    const a = edScroller;
    const b = pvScroller;
    if (!a || !b || mode !== "split") return;
    const onA = () => syncScroll(a, b);
    const onB = () => syncScroll(b, a);
    a.addEventListener("scroll", onA, { passive: true });
    b.addEventListener("scroll", onB, { passive: true });
    return () => {
      a.removeEventListener("scroll", onA);
      b.removeEventListener("scroll", onB);
    };
  });

  // Anima o conteúdo a cada troca de aba (sem remontar o CodeMirror).
  let bodyEl = $state<HTMLDivElement>();
  $effect(() => {
    $activeTabPath; // dependência
    const el = bodyEl;
    if (!el) return;
    el.classList.remove("tab-switch");
    void el.offsetWidth; // reflow p/ reiniciar a animação
    el.classList.add("tab-switch");
  });
</script>

{#if activeTab}
  <!-- Barra superior -->
  <div class="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
    <span class="truncate text-sm text-text-secondary">{activeTab.name}</span>

    <div class="flex items-center gap-4">
      <!-- Status -->
      <span class="flex items-center gap-1.5 text-xs text-text-muted">
        {#if saving}
          <Loader2 size={13} class="animate-spin" /> Salvando…
        {:else if activeTab.dirty}
          <span class="h-1.5 w-1.5 rounded-full bg-accent"></span> Não salvo
        {:else}
          <Check size={13} class="text-success" /> Salvo
        {/if}
      </span>

      <!-- Exportar / imprimir (PDF) -->
      <button
        onclick={printNote}
        title="Imprimir / Salvar como PDF"
        class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <Printer size={15} />
      </button>

      <!-- Outline -->
      <button
        onclick={() => outlineOpen.update((v) => !v)}
        title="Outline / cabeçalhos (Ctrl+Shift+O)"
        class="rounded-lg p-1.5 transition-colors {$outlineOpen
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <List size={15} />
      </button>

      <!-- Backlinks -->
      <button
        onclick={() => backlinksOpen.update((v) => !v)}
        title="Backlinks (Ctrl+Shift+B)"
        class="rounded-lg p-1.5 transition-colors {$backlinksOpen
          ? 'bg-accent/15 text-accent-light'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      >
        <Link2 size={15} />
      </button>

      <!-- Toggle de modo -->
      <div class="flex rounded-lg bg-elevated p-0.5">
        {#each modes as m (m.id)}
          <button
            class="rounded-md px-2 py-1 transition-colors {mode === m.id
              ? 'bg-accent text-bg'
              : 'text-text-secondary hover:text-text-primary'}"
            title={m.label}
            onclick={() => (mode = m.id)}
          >
            <m.icon size={15} />
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Barra de formatação (criação livre de notas) -->
  {#if mode !== "read"}
    <div class="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-3">
      {#each tools as t, i (i)}
        {#if t.sep}
          <span class="mx-1 h-4 w-px shrink-0 bg-border"></span>
        {:else}
          <button
            onclick={t.run}
            title={t.title}
            aria-label={t.title}
            class="shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary active:scale-95"
          >
            <t.icon size={15} />
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Corpo -->
  <div class="flex min-h-0 flex-1" bind:this={bodyEl}>
    {#if mode !== "read"}
      <div class="min-w-0 {mode === 'split' ? 'flex-1 border-r border-border' : 'flex-1'}">
        <CodeMirror
          doc={activeTab.content}
          path={activeTab.path}
          {onChange}
          onOpenWikilink={openWikilink}
          onScroller={(el) => (edScroller = el)}
        />
      </div>
    {/if}
    {#if mode !== "edit"}
      <div class="min-w-0 flex-1 bg-bg">
        <MarkdownPreview
          content={activeTab.content}
          notePath={activeTab.path}
          onOpenWikilink={openWikilink}
          onOpenPath={openNote}
          onScroller={(el) => (pvScroller = el)}
        />
      </div>
    {/if}
  </div>
{:else}
  <div class="flex flex-1 items-center justify-center text-text-secondary">
    <div class="text-center">
      <p class="mb-1 text-lg">Nenhum arquivo aberto</p>
      <p class="text-sm">Selecione uma nota no explorer à esquerda</p>
    </div>
  </div>
{/if}

<style>
  :global(.tab-switch) {
    animation: tab-switch 200ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
  @keyframes tab-switch {
    from {
      opacity: 0.35;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  :global(html.no-anim .tab-switch) {
    animation: none;
  }
</style>
