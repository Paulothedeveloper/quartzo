<script lang="ts">
  import { fly } from "svelte/transition";
  import { ctxMenu } from "$lib/stores/ui";

  function close() {
    ctxMenu.set(null);
  }

  let menuEl = $state<HTMLDivElement | null>(null);
  let pos = $state<{ x: number; y: number } | null>(null);
  let ready = $state(false); // só mostra depois de medir/ajustar (sem flash cortado)

  // Reposiciona SEMPRE dentro da janela: mede o tamanho real e, se passar da borda,
  // puxa pra dentro / abre pra cima. Resolve o menu "comido" pela janela.
  $effect(() => {
    const m = $ctxMenu;
    if (!m || typeof window === "undefined") {
      pos = null;
      ready = false;
      return;
    }
    pos = { x: m.x, y: m.y };
    ready = false;
    queueMicrotask(() => {
      const el = menuEl;
      if (!el) {
        ready = true;
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = m.x;
      let y = m.y;
      // horizontal: se estoura à direita, encosta na borda
      if (x + r.width > vw - pad) x = vw - r.width - pad;
      // vertical: se estoura embaixo, tenta abrir pra cima do cursor; senão encosta
      if (y + r.height > vh - pad) {
        const above = m.y - r.height;
        y = above >= pad ? above : vh - r.height - pad;
      }
      pos = { x: Math.max(pad, x), y: Math.max(pad, y) };
      ready = true;
    });
  });
</script>

<svelte:window
  onclick={close}
  onresize={close}
  onkeydown={(e) => e.key === "Escape" && close()}
/>

{#if $ctxMenu && pos}
  <div
    bind:this={menuEl}
    class="ctxmenu"
    style="left:{pos.x}px; top:{pos.y}px; visibility:{ready ? 'visible' : 'hidden'}"
    transition:fly={{ y: -4, duration: 110 }}
    role="menu"
    tabindex="-1"
  >
    {#each $ctxMenu.items as it, i (i)}
      {#if it.separator}
        <div class="ctx-sep"></div>
      {:else if it.actions && it.actions.length}
        {@const Icon = it.icon}
        <div class="ctx-row">
          <button
            class="ctx-item ctx-item--grow"
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
          {#each it.actions as a (a.title)}
            {@const AIcon = a.icon}
            <button
              class="ctx-act"
              class:danger={a.danger}
              title={a.title}
              aria-label={a.title}
              onclick={(e) => {
                e.stopPropagation();
                a.action();
                close();
              }}
            >
              <AIcon size={14} />
            </button>
          {/each}
        </div>
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
    max-height: calc(100vh - 16px);
    overflow-y: auto;
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
  /* Linha com botões de ação no fim (renomear / remover) */
  .ctx-row {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: 8px;
  }
  .ctx-item--grow {
    flex: 1;
    min-width: 0;
    width: auto;
  }
  .ctx-item--grow span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ctx-act {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    color: var(--color-text-muted);
    opacity: 0;
    transition:
      background 0.12s var(--ease-out, ease),
      color 0.12s var(--ease-out, ease),
      opacity 0.12s var(--ease-out, ease);
  }
  .ctx-row:hover .ctx-act {
    opacity: 1;
  }
  .ctx-act:hover {
    background: var(--color-accent);
    color: #06121a;
  }
  .ctx-act.danger:hover {
    background: var(--color-danger);
    color: #fff;
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
