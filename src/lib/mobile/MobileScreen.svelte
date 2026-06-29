<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { ChevronLeft } from "@lucide/svelte";
  import { t } from "$lib/i18n";

  let {
    title,
    onClose,
    icon,
    actions,
    subbar,
    footer,
    pad = true,
    children,
  }: {
    title: string;
    onClose: () => void;
    /** Ícone opcional à esquerda do título (componente lucide). */
    icon?: any;
    /** Botões/controles à direita do header. */
    actions?: Snippet;
    /** Faixa logo abaixo do header (ex.: tira de abas). */
    subbar?: Snippet;
    /** Barra fixa inferior (ex.: ações de salvar). */
    footer?: Snippet;
    /** Padding no corpo (desligue para telas full-bleed, ex.: grafo). */
    pad?: boolean;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<div class="msc" transition:fly={{ x: 28, duration: 220, easing: cubicOut }}>
  <header class="msc-top">
    <button class="msc-back" onclick={onClose} aria-label={$t("titlebar.navBack")}>
      <ChevronLeft size={24} />
    </button>
    {#if Icon}<Icon size={17} class="msc-ic" />{/if}
    <h1 class="msc-title">{title}</h1>
    {#if actions}
      <div class="msc-actions">{@render actions()}</div>
    {/if}
  </header>

  {#if subbar}
    <div class="msc-subbar">{@render subbar()}</div>
  {/if}

  <div class="msc-body" class:pad>
    {@render children()}
  </div>

  {#if footer}
    <div class="msc-footer">{@render footer()}</div>
  {/if}
</div>

<style>
  .msc {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }
  .msc-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    min-height: 50px;
    padding: calc(env(safe-area-inset-top) + 6px) 12px 6px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .msc-back {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    margin-left: -4px;
    border-radius: 10px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .msc-back:active {
    background: var(--color-elevated);
  }
  .msc-top :global(.msc-ic) {
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .msc-title {
    flex: 1;
    min-width: 0;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .msc-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .msc-subbar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .msc-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .msc-body.pad {
    padding: 16px;
    gap: 16px;
  }
  .msc-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px calc(env(safe-area-inset-bottom) + 12px);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
  }
</style>
