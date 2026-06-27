<script lang="ts">
  import { untrack } from "svelte";
  import { get } from "svelte/store";
  import { fly } from "svelte/transition";
  import { Link2, Unlink, X, Loader2, Link } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeTabPath, openTabs } from "$lib/stores/tabs";
  import { currentVaultPath } from "$lib/stores/vault";
  import { backlinksOpen } from "$lib/stores/ui";
  import { activeEditorView } from "$lib/stores/editor";
  import { showToast } from "$lib/stores/toast";
  import { openNote } from "$lib/vault-actions";
  import { getBacklinkCache, setBacklinkCache, clearBacklinkCache } from "$lib/backlink-cache";
  import { t, tr } from "$lib/i18n";

  interface Backlink {
    path: string;
    name: string;
    snippet: string;
  }

  let links = $state<Backlink[]>([]);
  let mentions = $state<Backlink[]>([]);
  let loading = $state(false);
  let linking = $state<string | null>(null);

  // Nome (stem) da nota ativa — alvo das menções.
  const targetName = $derived(
    $activeTabPath ? ($activeTabPath.split(/[\\/]/).pop() ?? "").replace(/\.md$/i, "") : ""
  );

  // Quebra o snippet realçando o termo mencionado.
  function highlight(snippet: string, term: string): { text: string; hit: boolean }[] {
    if (!term) return [{ text: snippet, hit: false }];
    const parts: { text: string; hit: boolean }[] = [];
    const lc = snippet.toLowerCase();
    const t = term.toLowerCase();
    let i = 0;
    while (i < snippet.length) {
      const idx = lc.indexOf(t, i);
      if (idx < 0) {
        parts.push({ text: snippet.slice(i), hit: false });
        break;
      }
      if (idx > i) parts.push({ text: snippet.slice(i, idx), hit: false });
      parts.push({ text: snippet.slice(idx, idx + term.length), hit: true });
      i = idx + term.length;
    }
    return parts;
  }

  async function refresh() {
    const target = get(activeTabPath);
    const vault = get(currentVaultPath);
    if (!target || !vault) return;
    const [bl, um] = await Promise.all([
      invoke<Backlink[]>("get_backlinks", { vaultPath: vault, targetPath: target }),
      invoke<Backlink[]>("get_unlinked_mentions", { vaultPath: vault, targetPath: target }),
    ]);
    links = bl;
    mentions = um;
    setBacklinkCache(vault, target, { links: bl, mentions: um });
  }

  // "Linkar": envolve a menção em [[ ]] na nota de origem.
  async function linkMention(m: Backlink) {
    const target = get(activeTabPath);
    const vault = get(currentVaultPath);
    if (!target || !vault || !targetName) return;
    linking = m.path;
    try {
      const n = await invoke<number>("link_mention", { path: m.path, targetName });
      if (n > 0) {
        // re-sincroniza a aba de origem se estiver aberta e não-suja
        const tab = get(openTabs).find((x) => x.path === m.path);
        if (tab && !tab.dirty) {
          try {
            const fresh = await invoke<string>("read_file", { path: m.path });
            openTabs.update((ts) => ts.map((x) => (x.path === m.path ? { ...x, content: fresh } : x)));
            if (get(activeTabPath) === m.path) {
              const v = get(activeEditorView);
              if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: fresh } });
            }
          } catch {
            /* ignora */
          }
        }
        clearBacklinkCache();
        await refresh();
        showToast(tr("backlinks.linked", { count: n }), "success");
      } else {
        showToast(tr("backlinks.linkNone"), "info");
      }
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      linking = null;
    }
  }

  // Recarrega quando a nota ativa muda.
  $effect(() => {
    const target = $activeTabPath;
    const vault = $currentVaultPath;
    if (!target || !vault) {
      links = [];
      mentions = [];
      return;
    }
    const hit = getBacklinkCache(vault, target);
    if (hit) {
      links = hit.links;
      mentions = hit.mentions;
      loading = false;
      return;
    }
    untrack(async () => {
      loading = true;
      try {
        const [bl, um] = await Promise.all([
          invoke<Backlink[]>("get_backlinks", { vaultPath: vault, targetPath: target }),
          invoke<Backlink[]>("get_unlinked_mentions", { vaultPath: vault, targetPath: target }),
        ]);
        links = bl;
        mentions = um;
        setBacklinkCache(vault, target, { links: bl, mentions: um });
      } catch {
        links = [];
        mentions = [];
      } finally {
        loading = false;
      }
    });
  });
</script>

<div class="flex h-full flex-col">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
    <Link2 size={15} class="text-accent" />
    <span class="text-sm font-medium">{$t("backlinks.title")}</span>
    {#if !loading}<span class="text-xs text-text-muted">{links.length}</span>{/if}
    <button
      onclick={() => backlinksOpen.set(false)}
      class="ml-auto rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
    >
      <X size={15} />
    </button>
  </div>

  <div class="flex-1 overflow-auto p-2">
    {#if loading}
      <div class="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
        <Loader2 size={15} class="animate-spin" /> {$t("backlinks.searching")}
      </div>
    {:else}
      <!-- Links explícitos -->
      {#if links.length === 0}
        <div class="px-3 py-6 text-center text-sm text-text-secondary">
          {$t("backlinks.none")}
        </div>
      {:else}
        {#each links as bl, i (bl.path)}
          <button
            onclick={() => openNote(bl.path)}
            in:fly={{ y: 6, duration: 180, delay: Math.min(i * 30, 240) }}
            class="mb-1.5 block w-full rounded-lg border border-border/60 bg-bg/30 p-2.5 text-left transition-all hover:border-accent/40 hover:bg-elevated active:scale-[0.99]"
          >
            <div class="truncate text-sm font-medium text-text-primary">{bl.name}</div>
            {#if bl.snippet}
              <div class="mt-0.5 line-clamp-2 text-xs text-text-secondary">{bl.snippet}</div>
            {/if}
          </button>
        {/each}
      {/if}

      <!-- Menções não-linkadas -->
      {#if mentions.length > 0}
        <div class="mb-1.5 mt-4 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-text-muted">
          <Unlink size={12} /> {$t("backlinks.unlinked")}
          <span class="ml-auto normal-case">{mentions.length}</span>
        </div>
        {#each mentions as m, i (m.path)}
          <div
            in:fly={{ y: 6, duration: 180, delay: Math.min(i * 30, 240) }}
            class="group mb-1.5 rounded-lg border border-dashed border-border/50 bg-bg/20 p-2.5 transition-all hover:border-accent/40 hover:bg-elevated"
          >
            <div class="flex items-center gap-2">
              <button
                onclick={() => openNote(m.path)}
                class="min-w-0 flex-1 truncate text-left text-sm font-medium text-text-primary hover:text-accent-light"
              >
                {m.name}
              </button>
              <button
                onclick={() => linkMention(m)}
                disabled={linking === m.path}
                title={$t("backlinks.linkAction")}
                class="flex shrink-0 items-center gap-1 rounded-md bg-elevated px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
              >
                {#if linking === m.path}<Loader2 size={12} class="animate-spin" />{:else}<Link size={12} />{/if}
                {$t("backlinks.linkAction")}
              </button>
            </div>
            {#if m.snippet}
              <div class="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                {#each highlight(m.snippet, targetName) as part}{#if part.hit}<mark class="rounded bg-accent/25 text-accent-light">{part.text}</mark>{:else}{part.text}{/if}{/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>
