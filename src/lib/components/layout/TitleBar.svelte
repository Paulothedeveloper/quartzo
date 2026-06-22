<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import {
    Search,
    SlidersHorizontal,
    Plus,
    ChevronDown,
    Pin,
    FilePlus,
    FolderPlus,
    CalendarDays,
    Sparkles,
    Layers,
  } from "@lucide/svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { currentVaultPath } from "$lib/stores/vault";
  import { settingsOpen, searchRequest, memoryOpen, typePickerRequest, ctxMenu, type CtxMenuItem } from "$lib/stores/ui";
  import { createNoteIn, createFolderIn, openDailyNote } from "$lib/vault-actions";
  import { showToast } from "$lib/stores/toast";
  import { sfx } from "$lib/sfx";

  function appWindow() {
    try {
      return getCurrentWindow();
    } catch {
      return null; // fora do Tauri (navegador / teste)
    }
  }
  async function win(action: "close" | "minimize" | "toggleMaximize") {
    try {
      await (appWindow() as unknown as Record<string, () => Promise<void>>)?.[action]?.();
    } catch {
      /* ignora */
    }
  }

  let pinned = $state(false);
  async function togglePin() {
    pinned = !pinned;
    pinned ? sfx.toggleOn() : sfx.toggleOff();
    try {
      await appWindow()?.setAlwaysOnTop(pinned);
    } catch {
      /* ignora */
    }
    showToast(pinned ? "Janela sempre no topo" : "Sempre no topo desligado", "info");
  }

  function openAdd(e: MouseEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vault = $currentVaultPath;
    const needVault = () => showToast("Abra um vault primeiro", "info");
    const items: CtxMenuItem[] = [
      { label: "Nova nota", icon: FilePlus, action: () => (vault ? createNoteIn(vault) : needVault()) },
      { label: "Nova de tipo…", icon: Layers, action: () => (vault ? typePickerRequest.set(true) : needVault()) },
      { label: "Nova pasta", icon: FolderPlus, action: () => (vault ? createFolderIn(vault) : needVault()) },
      { label: "Nota do dia", icon: CalendarDays, action: openDailyNote },
      { separator: true },
      { label: "Memória do Claude", icon: Sparkles, action: () => memoryOpen.set(true) },
    ];
    ctxMenu.set({ x: Math.max(8, rect.right - 210), y: rect.bottom + 6, items });
  }
</script>

<div class="qtitlebar" data-tauri-drag-region>
  <!-- Semáforo (fechar / minimizar / maximizar) -->
  <div class="qtraffic">
    <button class="tl tl-close" onclick={() => win("close")} title="Fechar" aria-label="Fechar"></button>
    <button class="tl tl-min" onclick={() => win("minimize")} title="Minimizar" aria-label="Minimizar"></button>
    <button class="tl tl-max" onclick={() => win("toggleMaximize")} title="Maximizar" aria-label="Maximizar"></button>
  </div>

  <!-- Marca -->
  <div class="qbrand" data-tauri-drag-region>
    <CrystalIllustration size={22} glow={0.5} float={false} />
    <span class="q-wordmark qbrand-name">Quartzo</span>
  </div>

  <!-- Busca central -->
  <button class="qsearch" onclick={() => searchRequest.set("")} title="Buscar (Ctrl+Shift+F)">
    <Search size={15} />
    <span>Buscar…</span>
  </button>

  <!-- Ações à direita -->
  <div class="qactions">
    <button class="qicon" class:on={pinned} onclick={togglePin} title="Manter janela sempre no topo">
      <Pin size={16} />
    </button>
    <button class="qicon" onclick={() => settingsOpen.set(true)} title="Configurações (Ctrl+,)">
      <SlidersHorizontal size={16} />
    </button>
    <button class="qadd" onclick={openAdd} title="Adicionar">
      <Plus size={16} />
      <span>Adicionar</span>
      <ChevronDown size={14} class="opacity-70" />
    </button>
  </div>
</div>

<style>
  .qtitlebar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    height: 46px;
    flex-shrink: 0;
    padding: 0 12px;
    background: linear-gradient(180deg, var(--color-surface), color-mix(in srgb, var(--color-surface) 88%, #0a0f1c));
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
    animation: qtb-in 0.45s var(--ease-out, ease) both;
    z-index: 50;
  }
  @keyframes qtb-in {
    from { opacity: 0; transform: translateY(-100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  :global(html.no-anim) .qtitlebar {
    animation: none;
  }

  /* Semáforo macOS */
  .qtraffic {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 4px;
  }
  .tl {
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    position: relative;
    transition: filter 0.15s var(--ease-out, ease);
  }
  .tl-close { background: #ff5f57; }
  .tl-min { background: #febc2e; }
  .tl-max { background: #28c840; }
  .tl::after {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    color: rgba(0, 0, 0, 0.55);
    opacity: 0;
    transition: opacity 0.12s var(--ease-out, ease);
  }
  .qtraffic:hover .tl::after { opacity: 1; }
  .tl-close::after { content: "✕"; }
  .tl-min::after { content: "−"; }
  .tl-max::after { content: "+"; }
  .tl:hover { filter: brightness(1.1); }

  /* Marca */
  .qbrand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .qbrand-name {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  /* Busca central (botão estilizado como input) */
  .qsearch {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(440px, 38vw);
    padding: 6px 14px;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-elevated) 60%, transparent);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    transition: background 0.15s var(--ease-out, ease), border-color 0.15s var(--ease-out, ease);
  }
  .qsearch:hover {
    background: var(--color-elevated);
    border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  }

  /* Ações à direita */
  .qactions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .qicon {
    display: grid;
    place-items: center;
    padding: 7px;
    border-radius: 9px;
    color: var(--color-text-secondary);
    transition: background 0.15s var(--ease-out, ease), color 0.15s var(--ease-out, ease);
  }
  .qicon:hover {
    background: var(--color-elevated);
    color: var(--color-text-primary);
  }
  .qicon.on {
    background: rgba(103, 232, 249, 0.15);
    color: var(--color-accent-light);
  }
  .qadd {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 10px;
    background: var(--color-accent);
    color: #06121a;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 2px 12px rgba(103, 232, 249, 0.22);
    transition: background 0.15s var(--ease-out, ease);
  }
  .qadd:hover { background: var(--color-accent-hover); }
</style>
