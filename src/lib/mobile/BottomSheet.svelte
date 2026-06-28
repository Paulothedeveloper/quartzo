<script lang="ts">
  import { fly, fade } from "svelte/transition";

  export interface SheetItem {
    label: string;
    icon: any;
    action: () => void;
    danger?: boolean;
    show?: boolean;
  }

  let {
    open = $bindable(false),
    title = "",
    subtitle = "",
    items = [],
  }: {
    open?: boolean;
    title?: string;
    subtitle?: string;
    items?: SheetItem[];
  } = $props();

  function close() {
    open = false;
  }
  function pick(it: SheetItem) {
    close();
    // espera o sheet fechar pra ação (ex.: abrir diálogo) não competir com a animação
    setTimeout(() => it.action(), 0);
  }
</script>

{#if open}
  <!-- backdrop -->
  <button
    class="bs-backdrop"
    aria-label="Fechar"
    onclick={close}
    transition:fade={{ duration: 160 }}
  ></button>

  <div class="bs-sheet" transition:fly={{ y: 280, duration: 220, opacity: 1 }} role="dialog" aria-modal="true">
    <div class="bs-grip"></div>
    {#if title}
      <div class="bs-head">
        <span class="bs-title">{title}</span>
        {#if subtitle}<span class="bs-sub">{subtitle}</span>{/if}
      </div>
    {/if}
    <div class="bs-items">
      {#each items.filter((i) => i.show !== false) as it (it.label)}
        {@const Icon = it.icon}
        <button class="bs-item" class:danger={it.danger} onclick={() => pick(it)}>
          <Icon size={19} />
          <span>{it.label}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .bs-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(3, 7, 14, 0.55);
    backdrop-filter: blur(2px);
    border: none;
  }
  .bs-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 81;
    background: var(--color-surface);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    border-top: 1px solid var(--color-border);
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5);
    padding: 8px 10px calc(env(safe-area-inset-bottom) + 12px);
    max-height: 75vh;
    overflow-y: auto;
  }
  .bs-grip {
    width: 38px;
    height: 4px;
    border-radius: 999px;
    background: var(--color-border);
    margin: 4px auto 8px;
  }
  .bs-head {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 14px 10px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 6px;
  }
  .bs-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bs-sub {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bs-items {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .bs-item {
    display: flex;
    align-items: center;
    gap: 15px;
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 12px;
    text-align: left;
    font-size: 1rem;
    color: var(--color-text-primary);
  }
  .bs-item:active {
    background: var(--color-elevated);
  }
  .bs-item :global(svg) {
    color: var(--color-accent-light);
    flex-shrink: 0;
  }
  .bs-item.danger {
    color: #f87171;
  }
  .bs-item.danger :global(svg) {
    color: #f87171;
  }
</style>
