<script lang="ts">
  import { fly } from "svelte/transition";
  import { ctxMenu } from "$lib/stores/ui";

  function close() {
    ctxMenu.set(null);
  }

  const pos = $derived.by(() => {
    const m = $ctxMenu;
    if (!m || typeof window === "undefined") return null;
    const mw = 220;
    const mh = m.items.reduce((h, it) => h + (it.separator ? 9 : 32), 10);
    let x = m.x;
    let y = m.y;
    if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
    if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
    return { x: Math.max(6, x), y: Math.max(6, y) };
  });
</script>

<svelte:window
  onclick={close}
  onresize={close}
  onkeydown={(e) => e.key === "Escape" && close()}
/>

{#if $ctxMenu && pos}
  <div
    class="ctxmenu"
    style="left:{pos.x}px; top:{pos.y}px"
    transition:fly={{ y: -4, duration: 110 }}
    role="menu"
    tabindex="-1"
  >
    {#each $ctxMenu.items as it, i (i)}
      {#if it.separator}
        <div class="ctx-sep"></div>
      {:else}
        {@const Icon = it.icon}
        <button
          class="ctx-item"
          class:danger={it.danger}
          role="menuitem"
          onclick={() => {
            it.action?.();
            close();
          }}
        >
          {#if Icon}<Icon size={15} />{/if}
          <span>{it.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ctxmenu {
    position: fixed;
    z-index: 300;
    min-width: 210px;
    padding: 5px;
    border-radius: 12px;
    background: rgba(28, 37, 54, 0.97);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-border);
    box-shadow:
      0 12px 36px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(103, 232, 249, 0.06);
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 13.5px;
    text-align: left;
    color: var(--color-text-primary);
    transition:
      background 0.12s var(--ease-out, ease),
      color 0.12s var(--ease-out, ease);
  }
  .ctx-item :global(svg) {
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .ctx-item:hover {
    background: var(--color-accent);
    color: #06121a;
  }
  .ctx-item:hover :global(svg) {
    color: #06121a;
  }
  .ctx-item.danger {
    color: #fca5a5;
  }
  .ctx-item.danger :global(svg) {
    color: #fca5a5;
  }
  .ctx-item.danger:hover {
    background: var(--color-danger);
    color: #fff;
  }
  .ctx-item.danger:hover :global(svg) {
    color: #fff;
  }
  .ctx-sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--color-border);
    opacity: 0.6;
  }
</style>
