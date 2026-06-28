<script lang="ts">
  import { X, XCircle, ListX, Columns2 } from "@lucide/svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { ctxMenu, rightPane } from "$lib/stores/ui";
  import { t, tr } from "$lib/i18n";

  function switchTo(path: string) {
    activeTabPath.set(path);
  }

  function closeTab(path: string) {
    const remaining = $openTabs.filter((t) => t.path !== path);
    openTabs.set(remaining);
    if ($activeTabPath === path) {
      activeTabPath.set(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }
  function close(path: string, e: MouseEvent) {
    e.stopPropagation();
    closeTab(path);
  }
  function tabMenu(e: MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    ctxMenu.set({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: tr("tabs.openBeside"), icon: Columns2, action: () => rightPane.set(path) },
        { separator: true },
        { label: tr("common.close"), icon: X, action: () => closeTab(path) },
        {
          label: tr("tabs.closeOthers"),
          icon: XCircle,
          action: () => {
            openTabs.set($openTabs.filter((t) => t.path === path));
            activeTabPath.set(path);
          },
        },
        {
          label: tr("tabs.closeAll"),
          icon: ListX,
          danger: true,
          action: () => {
            openTabs.set([]);
            activeTabPath.set(null);
          },
        },
      ],
    });
  }
</script>

<div class="q-editor-tabs flex overflow-x-auto border-b border-border bg-surface">
  {#each $openTabs as tab (tab.path)}
    <button
      class="group flex min-w-[140px] max-w-[220px] items-center gap-2 border-r border-t-2 border-border px-4 py-2 text-sm transition-all duration-150 ease-out {$activeTabPath ===
      tab.path
        ? 'border-t-accent bg-bg text-text-primary'
        : 'border-t-transparent text-text-secondary hover:bg-elevated'}"
      onclick={() => switchTo(tab.path)}
      oncontextmenu={(e) => tabMenu(e, tab.path)}
      transition:fade={{ duration: 130 }}
      animate:flip={{ duration: 200 }}
    >
      <span class="truncate">{tab.name}</span>
      {#if tab.dirty}
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title={$t("editor.unsaved")}></span>
      {/if}
      <span
        class="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-md text-text-muted opacity-70 transition-all hover:bg-border hover:text-text-primary hover:opacity-100"
        onclick={(e) => close(tab.path, e)}
        role="button"
        tabindex="-1"
        title={$t("tabs.closeTip")}
        onkeydown={() => {}}
      >
        <X size={13} />
      </span>
    </button>
  {/each}
</div>
