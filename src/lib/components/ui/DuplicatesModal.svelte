<script lang="ts">
  import { untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { X, CopyX, Loader2, Trash2, FileText, Check, CircleCheck } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { duplicatesOpen, askConfirm } from "$lib/stores/ui";
  import { currentVaultPath } from "$lib/stores/vault";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { refreshTree } from "$lib/vault-actions";
  import { showToast } from "$lib/stores/toast";
  import { sfx } from "$lib/sfx";
  import { t, tr } from "$lib/i18n";

  interface DupFile {
    path: string;
    name: string;
    rel: string;
    modified: number;
  }
  interface DupGroup {
    key: string;
    size: number;
    empty: boolean;
    files: DupFile[];
  }

  let groups = $state<DupGroup[]>([]);
  let loading = $state(false);
  let busy = $state(false);
  // Caminhos marcados para remover (default: todas as cópias menos a mais antiga).
  let selected = $state(new Set<string>());

  async function scan() {
    const vault = $currentVaultPath;
    if (!vault) {
      groups = [];
      return;
    }
    loading = true;
    try {
      groups = await invoke<DupGroup[]>("find_duplicate_notes", { vault });
      // pré-seleciona todas as cópias exceto a 1ª (mais antiga) de cada grupo
      const sel = new Set<string>();
      for (const g of groups) g.files.slice(1).forEach((f) => sel.add(f.path));
      selected = sel;
    } catch (e) {
      showToast(String(e), "error");
      groups = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if ($duplicatesOpen) untrack(scan);
  });

  function toggle(path: string) {
    const n = new Set(selected);
    n.has(path) ? n.delete(path) : n.add(path);
    selected = n;
  }

  const totalDup = $derived(groups.reduce((s, g) => s + (g.files.length - 1), 0));
  const selCount = $derived(selected.size);

  function fmtDate(secs: number): string {
    if (!secs) return "";
    try {
      return new Date(secs * 1000).toLocaleString();
    } catch {
      return "";
    }
  }

  function close() {
    duplicatesOpen.set(false);
  }

  async function removeSelected() {
    if (selCount === 0) return;
    const paths = [...selected];
    const ok = await askConfirm({
      title: tr("dup.confirmTitle"),
      message: tr("dup.confirmMsg", { n: paths.length }),
      confirmLabel: tr("dup.removeBtn"),
      danger: true,
    });
    if (!ok) return;
    busy = true;
    let done = 0;
    for (const p of paths) {
      try {
        await invoke("delete_to_trash", { path: p });
        done++;
      } catch {
        /* segue nas demais */
      }
    }
    // tira das abas abertas o que foi removido
    const removed = new Set(paths);
    openTabs.update((tabs) => tabs.filter((t) => !removed.has(t.path)));
    if (removed.has($activeTabPath ?? "")) {
      const rest = $openTabs;
      activeTabPath.set(rest.length ? rest[rest.length - 1].path : null);
    }
    sfx.remove();
    showToast(tr("dup.removed", { n: done }), "success");
    refreshTree();
    busy = false;
    await scan();
  }
</script>

{#if $duplicatesOpen}
  <div
    class="qmodal-overlay fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[10vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={close}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="qmodal-panel flex max-h-[78vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      transition:fly={{ y: -18, duration: 230 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={$t("dup.title")}
      tabindex="-1"
    >
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <CopyX size={16} class="text-accent" />
        <span class="text-sm font-semibold">{$t("dup.title")}</span>
        <button
          class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          onclick={close}
          aria-label={$t("save.close")}
        >
          <X size={15} />
        </button>
      </div>

      <p class="px-4 pt-3 text-xs leading-relaxed text-text-secondary">{$t("dup.hint")}</p>

      <div class="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {#if loading}
          <div class="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
            <Loader2 size={16} class="animate-spin" /> {$t("dup.scanning")}
          </div>
        {:else if groups.length === 0}
          <div class="flex flex-col items-center gap-2 py-12 text-center">
            <CircleCheck size={30} class="text-emerald-400" />
            <div class="text-sm font-medium">{$t("dup.none")}</div>
            <div class="text-xs text-text-muted">{$t("dup.noneSub")}</div>
          </div>
        {:else}
          {#each groups as g, gi (g.key)}
            <div class="rounded-xl border border-border bg-bg/30 p-2.5" in:fly={{ y: 6, duration: 160, delay: Math.min(gi * 30, 240) }}>
              <div class="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                <FileText size={12} />
                {$t("dup.copies", { n: g.files.length })}
                {#if g.empty}<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-400">{$t("dup.emptyTag")}</span>{/if}
              </div>
              <div class="space-y-1">
                {#each g.files as f, fi (f.path)}
                  {@const isCur = f.path === $activeTabPath}
                  <div
                    class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors {selected.has(f.path)
                      ? 'bg-rose-500/8'
                      : 'hover:bg-elevated'}"
                  >
                    <button
                      class="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onclick={() => toggle(f.path)}
                    >
                      <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {selected.has(f.path) ? 'border-rose-400 bg-rose-500/80 text-white' : 'border-border'}">
                        {#if selected.has(f.path)}<Trash2 size={10} />{/if}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-1.5">
                          <span class="truncate text-sm">{f.name}</span>
                          {#if fi === 0}<span class="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">{$t("dup.oldest")}</span>{/if}
                          {#if isCur}<span class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-light">{$t("dup.openNow")}</span>{/if}
                        </span>
                        <span class="block truncate text-[11px] text-text-muted">{f.rel} · {fmtDate(f.modified)}</span>
                      </span>
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if !loading && groups.length}
        <div class="flex items-center gap-3 border-t border-border p-3">
          <span class="text-xs text-text-muted">{$t("dup.summary", { dup: totalDup, sel: selCount })}</span>
          <button
            class="ml-auto flex items-center gap-2 rounded-lg bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:bg-rose-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            onclick={removeSelected}
            disabled={busy || selCount === 0}
          >
            {#if busy}<Loader2 size={15} class="animate-spin" />{:else}<Trash2 size={15} />{/if}
            {$t("dup.removeN", { n: selCount })}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
