<script lang="ts">
  import { Search as SearchIcon, FileText, Loader2, X } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath } from "$lib/stores/vault";
  import { t } from "$lib/i18n";

  interface SearchHit { path: string; name: string; line: number; snippet: string; }

  let { onOpen }: { onOpen?: (path: string) => void } = $props();

  let q = $state("");
  let hits = $state<SearchHit[]>([]);
  let loading = $state(false);
  let ran = $state(false); // já buscou ao menos uma vez (pra mostrar "sem resultados")
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reqId = 0;

  async function run(query: string) {
    const vault = $currentVaultPath;
    if (!vault || query.trim().length < 2) {
      hits = [];
      ran = false;
      return;
    }
    const id = ++reqId;
    loading = true;
    try {
      const r = await invoke<SearchHit[]>("search_notes", { vaultPath: vault, query: query.trim() });
      if (id !== reqId) return; // resultado antigo, descarta (race)
      hits = r;
      ran = true;
    } catch {
      if (id === reqId) hits = [];
    } finally {
      if (id === reqId) loading = false;
    }
  }

  function onInput() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => run(q), 220);
  }
  function clear() {
    q = "";
    hits = [];
    ran = false;
  }
  function fileTitle(name: string) {
    return name.replace(/\.md$/i, "");
  }
</script>

<div class="ms">
  <div class="ms-head">
    <div class="ms-bar">
      <SearchIcon size={17} />
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={q}
        oninput={onInput}
        placeholder={$t("search.placeholder")}
        autofocus
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label={$t("search.ariaLabel")}
      />
      {#if loading}
        <Loader2 size={16} class="ms-spin" />
      {:else if q}
        <button class="ms-clear" onclick={clear} aria-label="X"><X size={16} /></button>
      {/if}
    </div>
  </div>

  <div class="ms-results">
    {#if q.trim().length < 2}
      <div class="ms-hint">{$t("search.minChars")}</div>
    {:else if ran && hits.length === 0 && !loading}
      <div class="ms-hint">{$t("search.noResults", { query: q.trim() })}</div>
    {:else if hits.length}
      <div class="ms-count">{$t("search.resultsCount", { count: hits.length })}</div>
      {#each hits as h, i (h.path + ":" + h.line + ":" + i)}
        <button class="ms-hit" onclick={() => onOpen?.(h.path)}>
          <span class="ms-hit-top">
            <FileText size={14} />
            <span class="ms-hit-name">{fileTitle(h.name)}</span>
            <span class="ms-hit-line">L{h.line}</span>
          </span>
          <span class="ms-hit-snip">{h.snippet}</span>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .ms {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .ms-head {
    padding: calc(env(safe-area-inset-top) + 10px) 12px 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .ms-bar {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 12px;
    border-radius: 12px;
    background: var(--color-elevated);
    color: var(--color-text-secondary);
  }
  .ms-bar input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 1rem;
    color: var(--color-text-primary);
  }
  .ms-clear {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    color: var(--color-text-muted);
  }
  .ms-clear:active {
    background: var(--color-surface);
  }
  .ms-bar :global(.ms-spin) {
    animation: ms-spin 0.9s linear infinite;
    color: var(--color-text-muted);
  }
  @keyframes ms-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .ms-results {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 6px 8px 16px;
  }
  .ms-hint {
    padding: 40px 18px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .ms-count {
    padding: 8px 10px 4px;
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }
  .ms-hit {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    padding: 11px 12px;
    border-radius: 11px;
    text-align: left;
  }
  .ms-hit:active {
    background: var(--color-elevated);
  }
  .ms-hit-top {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--color-text-primary);
  }
  .ms-hit-top :global(svg) {
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .ms-hit-name {
    font-size: 0.94rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ms-hit-line {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .ms-hit-snip {
    padding-left: 21px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
