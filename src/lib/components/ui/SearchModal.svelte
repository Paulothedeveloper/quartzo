<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Search, FileText, Loader2 } from "@lucide/svelte";
  import { get } from "svelte/store";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath } from "$lib/stores/vault";
  import { openNote } from "$lib/vault-actions";
  import { debounce } from "$lib/utils/debounce";

  interface SearchHit {
    path: string;
    name: string;
    line: number;
    snippet: string;
  }

  let { open = $bindable(false), initial = "" }: { open?: boolean; initial?: string } = $props();
  let q = $state("");
  let hits = $state<SearchHit[]>([]);
  let loading = $state(false);
  let inputEl = $state<HTMLInputElement>();

  const run = debounce(async (query: string) => {
    const vault = get(currentVaultPath);
    if (!vault || query.trim().length < 2) {
      hits = [];
      loading = false;
      return;
    }
    try {
      hits = await invoke<SearchHit[]>("search_notes", { vaultPath: vault, query });
    } catch {
      hits = [];
    } finally {
      loading = false;
    }
  }, 200);

  $effect(() => {
    if (open) {
      q = initial ?? "";
      hits = [];
      loading = false;
      queueMicrotask(() => inputEl?.focus());
      if (q.trim().length >= 2) {
        loading = true;
        run(q);
      }
    }
  });

  function onInput() {
    loading = q.trim().length >= 2;
    run(q);
  }
  function go(path: string) {
    openNote(path);
    open = false;
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function highlight(snippet: string, query: string) {
    const esc = escapeHtml(snippet);
    const t = query.trim();
    if (!t) return esc;
    const qe = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return esc.replace(new RegExp(qe, "ig"), (m) => `<mark>${m}</mark>`);
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[12vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={(e) => e.target === e.currentTarget && (open = false)}
    onkeydown={(e) => e.key === "Escape" && (open = false)}
    role="presentation"
  >
    <div
      class="flex max-h-[70vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      transition:fly={{ y: -16, duration: 220, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
      tabindex="-1"
    >
      <div class="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search size={18} class="text-text-secondary" />
        <input
          bind:this={inputEl}
          bind:value={q}
          oninput={onInput}
          placeholder="Buscar em todas as notas…"
          class="w-full bg-transparent text-lg outline-none placeholder:text-text-secondary"
        />
        {#if loading}<Loader2 size={16} class="animate-spin text-text-muted" />{/if}
      </div>

      <div class="flex-1 overflow-auto p-2">
        {#if q.trim().length < 2}
          <div class="px-3 py-8 text-center text-sm text-text-secondary">
            Digite ao menos 2 letras para buscar dentro das notas.
          </div>
        {:else if !loading && hits.length === 0}
          <div class="px-3 py-8 text-center text-sm text-text-secondary">
            Nenhum resultado para “{q.trim()}”.
          </div>
        {:else}
          {#if hits.length}
            <div class="px-3 pb-1 pt-1 text-xs text-text-muted">{hits.length} resultados</div>
          {/if}
          {#each hits as h, i (h.path + ":" + h.line + ":" + i)}
            <button
              onclick={() => go(h.path)}
              class="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-elevated"
            >
              <span class="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <FileText size={13} class="shrink-0 text-accent" />
                <span class="truncate">{h.name}</span>
                <span class="ml-auto shrink-0 text-xs text-text-muted">L{h.line}</span>
              </span>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              <span class="line-clamp-1 pl-[19px] text-xs text-text-secondary"
                >{@html highlight(h.snippet, q)}</span
              >
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.line-clamp-1 mark) {
    background: rgba(103, 232, 249, 0.25);
    color: var(--color-accent-light);
    border-radius: 3px;
    padding: 0 1px;
  }
</style>
