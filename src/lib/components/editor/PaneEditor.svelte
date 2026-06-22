<script lang="ts">
  import { untrack } from "svelte";
  import { get } from "svelte/store";
  import { PenLine, BookOpen, X, Loader2 } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { settings } from "$lib/stores/settings";
  import { showToast } from "$lib/stores/toast";
  import { openWikilink, openNote } from "$lib/vault-actions";
  import CodeMirror from "./CodeMirror.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";

  let { path, onClose }: { path: string; onClose?: () => void } = $props();

  let content = $state("");
  let loaded = $state(false);
  let mode = $state<"edit" | "read">("edit");
  let saving = $state(false);
  const name = $derived(path.split(/[\\/]/).pop() ?? "");

  // Carrega quando o path muda.
  $effect(() => {
    path;
    untrack(async () => {
      loaded = false;
      try {
        content = await invoke<string>("read_file", { path });
      } catch {
        content = "";
      }
      loaded = true;
    });
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  function onChange(v: string) {
    content = v;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      saving = true;
      try {
        await invoke("write_file", { path, content: v });
      } catch (e) {
        showToast(`Erro ao salvar: ${e}`, "error");
      } finally {
        saving = false;
      }
    }, get(settings).autoSaveDelay);
  }
</script>

<div class="flex h-full flex-col">
  <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
    <span class="truncate text-xs text-text-secondary">{name}</span>
    {#if saving}<Loader2 size={12} class="animate-spin text-text-muted" />{/if}
    <div class="ml-auto flex items-center gap-1">
      <button
        onclick={() => (mode = mode === "edit" ? "read" : "edit")}
        title={mode === "edit" ? "Ler" : "Editar"}
        class="rounded-md p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        {#if mode === "edit"}<BookOpen size={14} />{:else}<PenLine size={14} />{/if}
      </button>
      <button
        onclick={() => onClose?.()}
        title="Fechar painel"
        class="rounded-md p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <X size={14} />
      </button>
    </div>
  </div>
  <div class="min-h-0 flex-1">
    {#if !loaded}
      <div class="flex h-full items-center justify-center text-text-muted">
        <Loader2 size={18} class="animate-spin" />
      </div>
    {:else if mode === "edit"}
      <CodeMirror doc={content} {path} {onChange} onOpenWikilink={openWikilink} />
    {:else}
      <MarkdownPreview {content} notePath={path} onOpenWikilink={openWikilink} onOpenPath={openNote} />
    {/if}
  </div>
</div>
