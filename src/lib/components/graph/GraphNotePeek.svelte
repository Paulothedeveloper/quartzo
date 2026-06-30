<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { Maximize2, X, Pencil } from "@lucide/svelte";
  import MarkdownPreview from "$lib/components/editor/MarkdownPreview.svelte";
  import { t } from "$lib/i18n";

  let {
    path,
    x,
    y,
    onOpen,
    onClose,
  }: {
    path: string;
    x: number;
    y: number;
    onOpen?: (path: string) => void;
    onClose?: () => void;
  } = $props();

  let content = $state<string | null>(null);
  let loadingPath = "";

  // posição/tamanho da janelinha (arrastável + redimensionável).
  // Inicializa JÁ na posição do clique (sem gate "placed" que atrasava/escondia).
  let left = $state(typeof window !== "undefined" ? Math.min(x + 18, window.innerWidth - 460) : x + 18);
  let top = $state(typeof window !== "undefined" ? Math.min(y + 18, window.innerHeight - 400) : y + 18);
  let w = $state(440);
  let h = $state(380);

  const cache = new Map<string, string>();

  // PORTAL: move a janelinha pro <body> — assim NENHUM container do grafo
  // (com transform/overflow) quebra o position:fixed nem recorta o popover.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  $effect(() => {
    const p = path;
    if (cache.has(p)) {
      content = cache.get(p)!;
      return;
    }
    loadingPath = p;
    content = null;
    invoke<string>("read_file", { path: p })
      .then((c) => {
        cache.set(p, c);
        if (loadingPath === p) content = c;
      })
      .catch(() => {});
  });

  // reposiciona perto do clique quando o alvo muda (presa à tela)
  $effect(() => {
    const cx = x;
    const cy = y;
    if (typeof window === "undefined") return;
    let l = cx + 18;
    let tp = cy + 18;
    if (l + w > window.innerWidth - 10) l = cx - w - 18;
    if (tp + h > window.innerHeight - 10) tp = window.innerHeight - h - 10;
    left = Math.max(10, l);
    top = Math.max(10, tp);
  });

  const title = $derived(path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "");

  // arrastar pela barra de título
  let dragging = false;
  let dragDX = 0;
  let dragDY = 0;
  function onHeaderPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging = true;
    dragDX = e.clientX - left;
    dragDY = e.clientY - top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHeaderPointerMove(e: PointerEvent) {
    if (!dragging) return;
    left = Math.max(6, Math.min(e.clientX - dragDX, window.innerWidth - 120));
    top = Math.max(6, Math.min(e.clientY - dragDY, window.innerHeight - 60));
  }
  function onHeaderPointerUp(e: PointerEvent) {
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape") onClose?.();
  }}
/>

<div use:portal class="peek" style="left:{left}px; top:{top}px; width:{w}px; height:{h}px">
  <div
    class="peek-head"
    onpointerdown={onHeaderPointerDown}
    onpointermove={onHeaderPointerMove}
    onpointerup={onHeaderPointerUp}
  >
    <span class="peek-title" title={title}>{title}</span>
    <div class="peek-actions">
      <button class="peek-btn" title={$t("graph.openNote") ?? "Abrir"} onclick={() => onOpen?.(path)}>
        <Pencil size={14} />
      </button>
      <button
        class="peek-btn"
        title={$t("graph.openFull") ?? "Abrir em tela cheia"}
        onclick={() => onOpen?.(path)}
      >
        <Maximize2 size={14} />
      </button>
      <button class="peek-btn" title={$t("graph.closePeek") ?? "Fechar"} onclick={() => onClose?.()}>
        <X size={15} />
      </button>
    </div>
  </div>
  <div class="peek-body">
    {#if content !== null}
      <MarkdownPreview {content} notePath={path} />
    {:else}
      <div class="peek-loading">…</div>
    {/if}
  </div>
</div>

<style>
  .peek {
    position: fixed;
    z-index: 2000; /* acima de tudo (toasts/modais do app ficam abaixo) */
    display: flex;
    flex-direction: column;
    min-width: 300px;
    min-height: 200px;
    max-width: 92vw;
    max-height: 88vh;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
    background: var(--color-surface, #0e1525);
    box-shadow:
      0 0 0 1px rgba(103, 232, 249, 0.15),
      0 22px 60px rgba(0, 0, 0, 0.65);
    overflow: hidden;
    /* REDIMENSIONÁVEL: alça no canto inferior-direito */
    resize: both;
    animation: peek-in 0.18s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
  }
  @keyframes peek-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  :global(html.no-anim) .peek {
    animation: none;
  }
  .peek-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 14px;
    border-bottom: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.03);
    cursor: grab;
    user-select: none;
  }
  .peek-head:active {
    cursor: grabbing;
  }
  .peek-title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-accent-light, #a5f3fc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .peek-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .peek-btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--color-text-secondary, #94a3b8);
    transition: all 0.14s ease;
  }
  .peek-btn:hover {
    background: var(--color-elevated, rgba(255, 255, 255, 0.06));
    color: var(--color-text-primary, #e2e8f0);
  }
  .peek-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto; /* ROLÁVEL */
  }
  .peek-body :global(.q-prose) {
    padding: 12px 18px !important;
    font-size: 13.5px;
  }
  .peek-loading {
    padding: 20px;
    color: var(--color-text-secondary, #94a3b8);
  }
</style>
