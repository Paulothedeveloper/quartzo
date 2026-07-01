<script lang="ts">
  import { X, XCircle, ListX, Columns2 } from "@lucide/svelte";
  import { flip } from "svelte/animate";
  import { expoOut, quintOut } from "svelte/easing";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { ctxMenu, rightPane } from "$lib/stores/ui";
  import { t, tr } from "$lib/i18n";

  // Transição premium das abas: em vez de "pipocar" (fade seco), a aba DESLIZA —
  // largura/padding animam (vizinhas reflowam suave) + leve sobe/escala com expo.
  function tabMotion(node: HTMLElement, { duration = 240 }: { duration?: number } = {}) {
    const w = node.offsetWidth;
    const cs = getComputedStyle(node);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    return {
      duration,
      easing: expoOut,
      css: (t: number) =>
        `opacity:${t};` +
        `max-width:${t * w}px; min-width:0;` +
        `padding-left:${t * pl}px; padding-right:${t * pr}px;` +
        `transform:translateY(${(1 - t) * -5}px) scale(${0.965 + t * 0.035});` +
        `overflow:hidden; white-space:nowrap;`,
    };
  }

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
      class="group relative flex min-w-[140px] max-w-[220px] items-center gap-2 border-r border-t-2 border-border px-4 py-2 text-sm transition-[background-color,color,border-color,box-shadow] duration-200 ease-out {$activeTabPath ===
      tab.path
        ? 'border-t-accent bg-bg text-text-primary shadow-[0_3px_16px_-10px_var(--color-accent)]'
        : 'border-t-transparent text-text-secondary hover:bg-elevated hover:text-text-primary'}"
      onclick={() => switchTo(tab.path)}
      oncontextmenu={(e) => tabMenu(e, tab.path)}
      title={tab.name}
      transition:tabMotion={{ duration: 240 }}
      animate:flip={{ duration: 280, easing: quintOut }}
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
