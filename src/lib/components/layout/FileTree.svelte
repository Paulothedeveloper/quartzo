<script lang="ts">
  import {
    Folder,
    FolderOpen,
    FileText,
    FileCode,
    Image as ImageIcon,
    File as FileIcon,
    ChevronRight,
    FilePlus,
    FolderPlus,
    Pencil,
    Copy,
    Trash2,
    ExternalLink,
    CornerUpRight,
    Columns2,
  } from "@lucide/svelte";
  import { slide } from "svelte/transition";
  import { get } from "svelte/store";
  import { selectedFile } from "$lib/stores/vault";
  import { activeTabPath } from "$lib/stores/tabs";
  import { ctxMenu, renamingPath, rightPane, type CtxMenuItem } from "$lib/stores/ui";
  import {
    renameEntry,
    deleteEntry,
    revealEntry,
    copyPath,
    createNoteIn,
    createFolderIn,
  } from "$lib/vault-actions";
  import type { FileNode } from "$lib/types";
  import { tr } from "$lib/i18n";
  import Self from "./FileTree.svelte";

  let { nodes = [], depth = 0 }: { nodes?: FileNode[]; depth?: number } = $props();

  let expanded = $state<Set<string>>(new Set());

  function toggle(path: string) {
    const next = new Set(expanded);
    next.has(path) ? next.delete(path) : next.add(path);
    expanded = next;
  }
  function pick(node: FileNode) {
    if (node.is_dir) toggle(node.path);
    else selectedFile.set(node.path);
  }
  function iconFor(node: FileNode) {
    if (node.is_dir) return expanded.has(node.path) ? FolderOpen : Folder;
    const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
    if (["md", "markdown", "txt"].includes(ext)) return FileText;
    if (["js", "ts", "json", "svelte", "rs", "css", "html"].includes(ext)) return FileCode;
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return ImageIcon;
    return FileIcon;
  }

  function openMenu(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    const common: CtxMenuItem[] = [
      { label: tr("common.rename"), icon: Pencil, action: () => renamingPath.set(node.path) },
      { label: tr("vault.copyPath"), icon: Copy, action: () => copyPath(node.path) },
      { label: tr("vault.showInFolder"), icon: ExternalLink, action: () => revealEntry(node.path) },
      { separator: true },
      { label: tr("common.delete"), icon: Trash2, danger: true, action: () => deleteEntry(node.path) },
    ];
    const items: CtxMenuItem[] = node.is_dir
      ? [
          { label: tr("tree.newNoteHere"), icon: FilePlus, action: () => createNoteIn(node.path) },
          { label: tr("tree.newSubfolder"), icon: FolderPlus, action: () => createFolderIn(node.path) },
          { separator: true },
          ...common,
        ]
      : [
          { label: tr("common.open"), icon: CornerUpRight, action: () => selectedFile.set(node.path) },
          { label: tr("tabs.openBeside"), icon: Columns2, action: () => rightPane.set(node.path) },
          { separator: true },
          ...common,
        ];
    ctxMenu.set({ x: e.clientX, y: e.clientY, items });
  }

  function selectOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
  function commit(node: FileNode, value: string) {
    if (get(renamingPath) !== node.path) return;
    renamingPath.set(null);
    if (value.trim() && value.trim() !== node.name) renameEntry(node.path, value.trim());
  }
  function renameKey(e: KeyboardEvent, node: FileNode) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(node, (e.currentTarget as HTMLInputElement).value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      renamingPath.set(null);
    }
  }
</script>

{#each nodes as node (node.path)}
  {@const Icon = iconFor(node)}
  {#if $renamingPath === node.path}
    <div
      class="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2"
      style="padding-left: {depth * 14 + 6}px"
    >
      <span class="w-[14px] shrink-0"></span>
      <Icon size={16} class="shrink-0 {node.is_dir ? 'text-accent' : 'text-text-secondary'}" />
      <input
        class="min-w-0 flex-1 rounded border border-accent bg-bg px-1 py-0 text-sm outline-none"
        value={node.name}
        use:selectOnMount
        onkeydown={(e) => renameKey(e, node)}
        onblur={(e) => commit(node, (e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  {:else}
    <button
      class="group flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-sm transition-all duration-150 ease-out hover:bg-elevated active:scale-[0.99] {$activeTabPath ===
      node.path
        ? 'bg-accent/12 text-accent-light'
        : 'text-text-primary/90 hover:text-text-primary'}"
      style="padding-left: {depth * 14 + 6}px"
      onclick={() => pick(node)}
      oncontextmenu={(e) => openMenu(e, node)}
    >
      {#if node.is_dir}
        <ChevronRight
          size={14}
          class="shrink-0 text-text-muted transition-transform {expanded.has(node.path)
            ? 'rotate-90'
            : ''}"
        />
      {:else}
        <span class="w-[14px] shrink-0"></span>
      {/if}
      <Icon size={16} class="shrink-0 {node.is_dir ? 'text-accent' : 'text-text-secondary'}" />
      <span class="truncate">{node.name}</span>
    </button>
  {/if}

  {#if node.is_dir && expanded.has(node.path) && node.children?.length}
    <div transition:slide={{ duration: 180 }}>
      <Self nodes={node.children} depth={depth + 1} />
    </div>
  {/if}
{/each}
