<script lang="ts">
  import { untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { X, Compass, Loader2, Clock, Unlink, FileText, Star, Pin } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { insightsOpen } from "$lib/stores/ui";
  import { currentVaultPath } from "$lib/stores/vault";
  import { openNote } from "$lib/vault-actions";
  import { pinned, togglePin, bookmarks, toggleBookmark } from "$lib/stores/nav";
  import { showToast } from "$lib/stores/toast";
  import { t, tr } from "$lib/i18n";

  interface NoteInfo {
    path: string;
    name: string;
    rel: string;
    modified: number;
  }
  interface VaultInsights {
    orphans: NoteInfo[];
    recents: NoteInfo[];
    total: number;
  }

  let data = $state<VaultInsights | null>(null);
  let loading = $state(false);
  let tab = $state<"recents" | "orphans">("recents");

  async function load() {
    const vault = $currentVaultPath;
    if (!vault) {
      data = null;
      return;
    }
    loading = true;
    try {
      data = await invoke<VaultInsights>("vault_insights", { vault, recentLimit: 30 });
    } catch (e) {
      showToast(String(e), "error");
      data = null;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if ($insightsOpen) untrack(load);
  });

  function open(p: string) {
    openNote(p);
    insightsOpen.set(false);
  }
  function close() {
    insightsOpen.set(false);
  }
  function noteName(n: NoteInfo): string {
    return n.name.replace(/\.md$/i, "");
  }
  function folder(n: NoteInfo): string {
    const parts = n.rel.split("/");
    parts.pop();
    return parts.join("/");
  }
  function fmtDate(secs: number): string {
    if (!secs) return "";
    try {
      return new Date(secs * 1000).toLocaleString();
    } catch {
      return "";
    }
  }

  const list = $derived(tab === "recents" ? (data?.recents ?? []) : (data?.orphans ?? []));
</script>

{#if $insightsOpen}
  <div
    class="fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[10vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={close}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[78vh] w-full max-w-[580px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      transition:fly={{ y: -18, duration: 230 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={$t("insights.title")}
      tabindex="-1"
    >
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Compass size={16} class="text-accent" />
        <span class="text-sm font-semibold">{$t("insights.title")}</span>
        {#if data}<span class="text-[11px] text-text-muted">{$t("insights.total", { n: data.total })}</span>{/if}
        <button
          class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          onclick={close}
          aria-label={$t("save.close")}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Abas -->
      <div class="flex gap-1 border-b border-border px-3 pt-2">
        <button
          class="flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors {tab === 'recents'
            ? 'border-b-2 border-accent text-text-primary'
            : 'text-text-secondary hover:text-text-primary'}"
          onclick={() => (tab = "recents")}
        >
          <Clock size={14} /> {$t("insights.recents")}
        </button>
        <button
          class="flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors {tab === 'orphans'
            ? 'border-b-2 border-accent text-text-primary'
            : 'text-text-secondary hover:text-text-primary'}"
          onclick={() => (tab = "orphans")}
        >
          <Unlink size={14} /> {$t("insights.orphans")}
          {#if data}<span class="rounded-full bg-elevated px-1.5 text-[11px] text-text-muted">{data.orphans.length}</span>{/if}
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto p-2">
        {#if loading}
          <div class="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
            <Loader2 size={16} class="animate-spin" /> {$t("insights.loading")}
          </div>
        {:else if list.length === 0}
          <div class="px-4 py-12 text-center">
            <div class="text-sm font-medium">{tab === "orphans" ? $t("insights.noOrphans") : $t("insights.empty")}</div>
            {#if tab === "orphans"}<div class="mt-1 text-xs text-text-muted">{$t("insights.noOrphansSub")}</div>{/if}
          </div>
        {:else}
          {#each list as n, i (n.path)}
            <div
              class="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated"
              in:fly={{ y: 4, duration: 130, delay: Math.min(i * 12, 180) }}
            >
              <FileText size={14} class="shrink-0 text-text-muted" />
              <button class="min-w-0 flex-1 text-left" onclick={() => open(n.path)}>
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm text-text-primary">{noteName(n)}</span>
                  {#if $pinned.includes(n.path)}<Pin size={11} class="shrink-0 text-accent-light" fill="currentColor" />{/if}
                  {#if $bookmarks.includes(n.path)}<Star size={11} class="shrink-0 text-accent-light" fill="currentColor" />{/if}
                </span>
                <span class="block truncate text-[11px] text-text-muted">
                  {folder(n) ? folder(n) + " · " : ""}{tab === "recents" ? fmtDate(n.modified) : $t("insights.orphanTag")}
                </span>
              </button>
              <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  class="rounded p-1 text-text-muted hover:bg-bg hover:text-accent-light"
                  title={$pinned.includes(n.path) ? $t("tree.unpin") : $t("tree.pin")}
                  onclick={() => togglePin(n.path)}
                >
                  <Pin size={13} />
                </button>
                <button
                  class="rounded p-1 text-text-muted hover:bg-bg hover:text-accent-light"
                  title={$bookmarks.includes(n.path) ? $t("tree.unfavorite") : $t("tree.favorite")}
                  onclick={() => toggleBookmark(n.path)}
                >
                  <Star size={13} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
