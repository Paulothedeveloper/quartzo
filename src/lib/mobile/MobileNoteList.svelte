<script lang="ts">
  import {
    Folder, FileText, ChevronRight, ChevronLeft, Search as SearchIcon,
    Star, Pin, Pencil, Trash2, CornerUpRight, Copy,
  } from "@lucide/svelte";
  import { fileTree, currentVaultPath } from "$lib/stores/vault";
  import { bookmarks, toggleBookmark, pinned, togglePin } from "$lib/stores/nav";
  import { openNote, renameEntry, deleteEntry, copyPath, flatFiles } from "$lib/vault-actions";
  import { askPrompt } from "$lib/stores/ui";
  import { vaultLabel } from "$lib/stores/settings";
  import { isMobile } from "$lib/platform";
  import { t, tr } from "$lib/i18n";
  import type { FileNode } from "$lib/types";
  import BottomSheet, { type SheetItem } from "./BottomSheet.svelte";

  let { onOpen }: { onOpen?: (path: string) => void } = $props();

  // pilha de pastas pra navegação drill-down
  let stack = $state<FileNode[]>([]);
  const current = $derived(stack.length ? (stack[stack.length - 1].children ?? []) : $fileTree);

  // busca por nome (em todo o vault quando há texto)
  let search = $state("");
  const sorted = $derived(
    [...current].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
  );
  const results = $derived(
    search.trim()
      ? flatFiles($fileTree).filter((n) => n.name.toLowerCase().includes(search.trim().toLowerCase()))
      : []
  );
  const list = $derived(search.trim() ? results : sorted);

  function tapItem(n: FileNode) {
    if (n.is_dir) {
      stack = [...stack, n];
      search = "";
    } else {
      onOpen?.(n.path);
    }
  }
  function back() {
    stack = stack.slice(0, -1);
  }
  function crumbLabel(): string {
    if (stack.length) return stack[stack.length - 1].name;
    return $currentVaultPath ? vaultLabel($currentVaultPath) : "";
  }

  // ---- long-press -> bottom sheet ----
  let sheetOpen = $state(false);
  let sheetNode = $state<FileNode | null>(null);
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longFired = false;
  let pressX = 0;
  let pressY = 0;

  function pressStart(e: PointerEvent, n: FileNode) {
    longFired = false;
    pressX = e.clientX;
    pressY = e.clientY;
    pressTimer = setTimeout(() => {
      longFired = true;
      sheetNode = n;
      sheetOpen = true;
      if (navigator.vibrate) navigator.vibrate(12);
    }, 430);
  }
  function pressMove(e: PointerEvent) {
    // se o dedo se move (rolagem), cancela o long-press pra não abrir o sheet à toa
    if (pressTimer && (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10)) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }
  function pressEnd() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  }

  const sheetItems = $derived<SheetItem[]>(
    sheetNode
      ? sheetNode.is_dir
        ? [
            { label: tr("common.open"), icon: CornerUpRight, action: () => tapItem(sheetNode!) },
            { label: tr("common.rename"), icon: Pencil, action: () => doRename(sheetNode!) },
            { label: tr("vault.copyPath"), icon: Copy, action: () => copyPath(sheetNode!.path), show: !isMobile },
            { label: tr("common.delete"), icon: Trash2, danger: true, action: () => deleteEntry(sheetNode!.path) },
          ]
        : [
            { label: tr("common.open"), icon: CornerUpRight, action: () => onOpen?.(sheetNode!.path) },
            {
              label: $bookmarks.includes(sheetNode.path) ? tr("tree.unfavorite") : tr("tree.favorite"),
              icon: Star,
              action: () => toggleBookmark(sheetNode!.path),
            },
            {
              label: $pinned.includes(sheetNode.path) ? tr("tree.unpin") : tr("tree.pin"),
              icon: Pin,
              action: () => togglePin(sheetNode!.path),
            },
            { label: tr("common.rename"), icon: Pencil, action: () => doRename(sheetNode!) },
            { label: tr("vault.copyPath"), icon: Copy, action: () => copyPath(sheetNode!.path), show: !isMobile },
            { label: tr("common.delete"), icon: Trash2, danger: true, action: () => deleteEntry(sheetNode!.path) },
          ]
      : []
  );

  async function doRename(n: FileNode) {
    const base = n.name.replace(/\.md$/i, "");
    const val = await askPrompt({
      title: tr("common.rename"),
      message: n.path,
      initial: base,
      confirmLabel: tr("common.rename"),
    });
    if (val === null || !val.trim()) return;
    const newName = n.is_dir ? val.trim() : (/\.md$/i.test(val) ? val.trim() : `${val.trim()}.md`);
    await renameEntry(n.path, newName);
  }

  function isMd(n: FileNode) {
    return !n.is_dir && /\.md$/i.test(n.name);
  }
  function displayName(n: FileNode) {
    return isMd(n) ? n.name.replace(/\.md$/i, "") : n.name;
  }
</script>

<div class="ml">
  <!-- cabeçalho: voltar (se em subpasta) + nome do nível -->
  <div class="ml-head">
    {#if stack.length}
      <button class="ml-back" onclick={back} aria-label={$t("titlebar.navBack")}>
        <ChevronLeft size={22} />
      </button>
    {/if}
    <span class="ml-crumb">{crumbLabel()}</span>
  </div>

  <!-- busca -->
  <div class="ml-search">
    <SearchIcon size={16} />
    <input bind:value={search} placeholder={$t("sidebar.searchFiles")} />
  </div>

  <!-- lista -->
  <div class="ml-items">
    {#if list.length === 0}
      <div class="ml-empty">{search.trim() ? $t("search.noResults") : $t("graph.emptyTitle")}</div>
    {:else}
      {#each list as n (n.path)}
        <button
          class="ml-item"
          onpointerdown={(e) => pressStart(e, n)}
          onpointermove={pressMove}
          onpointerup={pressEnd}
          onpointercancel={pressEnd}
          onpointerleave={pressEnd}
          onclick={() => { if (!longFired) tapItem(n); }}
        >
          <span class="ml-ic" class:dir={n.is_dir}>
            {#if n.is_dir}<Folder size={18} />{:else}<FileText size={17} />{/if}
          </span>
          <span class="ml-name">{displayName(n)}</span>
          {#if !n.is_dir && $pinned.includes(n.path)}<Pin size={13} class="ml-badge" />{/if}
          {#if !n.is_dir && $bookmarks.includes(n.path)}<Star size={13} class="ml-badge" />{/if}
          {#if n.is_dir}<ChevronRight size={16} class="ml-chev" />{/if}
        </button>
      {/each}
    {/if}
  </div>
</div>

<BottomSheet
  bind:open={sheetOpen}
  title={sheetNode ? displayName(sheetNode) : ""}
  subtitle={""}
  items={sheetItems}
/>

<style>
  .ml {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .ml-head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 50px;
    padding: calc(env(safe-area-inset-top) + 8px) 12px 8px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .ml-back {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    margin-left: -6px;
    border-radius: 9px;
    color: var(--color-text-secondary);
  }
  .ml-back:active {
    background: var(--color-elevated);
  }
  .ml-crumb {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ml-search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 12px 4px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--color-elevated);
    color: var(--color-text-secondary);
  }
  .ml-search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.95rem;
    color: var(--color-text-primary);
  }
  .ml-items {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 8px 16px;
  }
  .ml-empty {
    padding: 40px 16px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .ml-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 50px;
    padding: 0 10px;
    border-radius: 11px;
    text-align: left;
  }
  .ml-item:active {
    background: var(--color-elevated);
  }
  .ml-ic {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--color-elevated);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .ml-ic.dir {
    color: var(--color-accent-light);
  }
  .ml-name {
    flex: 1;
    min-width: 0;
    font-size: 0.96rem;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ml-item :global(.ml-badge) {
    color: var(--color-accent-light);
    flex-shrink: 0;
  }
  .ml-item :global(.ml-chev) {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
</style>
