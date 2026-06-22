<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { fade } from "svelte/transition";
  import { hoverPreviewTarget } from "$lib/stores/ui";
  import MarkdownPreview from "$lib/components/editor/MarkdownPreview.svelte";

  const W = 400;
  const H = 320;
  const cache = new Map<string, string>();

  let content = $state<string | null>(null);
  let loadingPath = "";

  // Carrega o conteúdo da nota alvo (com cache por caminho).
  $effect(() => {
    const tgt = $hoverPreviewTarget;
    if (!tgt) {
      content = null;
      return;
    }
    const path = tgt.path;
    if (cache.has(path)) {
      content = cache.get(path)!;
      return;
    }
    loadingPath = path;
    content = null;
    invoke<string>("read_file", { path })
      .then((c) => {
        cache.set(path, c);
        if (loadingPath === path) content = c;
      })
      .catch(() => {});
  });

  // Posição do card, presa à janela (não sai da tela).
  const pos = $derived.by(() => {
    const tgt = $hoverPreviewTarget;
    if (!tgt || typeof window === "undefined") return { left: 0, top: 0 };
    let left = tgt.x + 16;
    let top = tgt.y + 16;
    if (left + W > window.innerWidth - 8) left = tgt.x - W - 16;
    if (top + H > window.innerHeight - 8) top = window.innerHeight - H - 8;
    return { left: Math.max(8, left), top: Math.max(8, top) };
  });

  const title = $derived(
    $hoverPreviewTarget ? ($hoverPreviewTarget.path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "") : ""
  );
</script>

{#if $hoverPreviewTarget && content !== null}
  <div
    class="hover-preview"
    style="left:{pos.left}px; top:{pos.top}px; width:{W}px; height:{H}px"
    transition:fade={{ duration: 120 }}
  >
    <div class="hp-title">{title}</div>
    <div class="hp-body">
      <MarkdownPreview {content} notePath={$hoverPreviewTarget.path} />
    </div>
  </div>
{/if}

<style>
  .hover-preview {
    position: fixed;
    z-index: 150;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: var(--color-surface, #0e1525);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .hp-title {
    flex-shrink: 0;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-accent-light, #a5f3fc);
    border-bottom: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.02);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hp-body {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  /* o preview embutido fica menor e sem rolagem interativa */
  .hp-body :global(.q-prose) {
    padding: 10px 16px !important;
    font-size: 13px;
  }
  /* máscara de fade no rodapé pra indicar "tem mais" */
  .hp-body::after {
    content: "";
    position: absolute;
    inset: auto 0 0 0;
    height: 40px;
    background: linear-gradient(to bottom, transparent, var(--color-surface, #0e1525));
    pointer-events: none;
  }
</style>
