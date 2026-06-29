<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Settings as SettingsIcon, FolderOpen, ChevronsUpDown, Plus } from "@lucide/svelte";
  import { currentVaultPath, fileTree } from "$lib/stores/vault";
  import { vaultLabel } from "$lib/stores/settings";
  import { flatFiles } from "$lib/vault-actions";
  import MobileNoteList from "./MobileNoteList.svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t } from "$lib/i18n";

  let {
    open = $bindable(false),
    onOpenNote,
    onSettings,
    onSwitchVault,
    onNewNote,
  }: {
    open?: boolean;
    onOpenNote?: (p: string) => void;
    onSettings?: () => void;
    onSwitchVault?: () => void;
    onNewNote?: () => void;
  } = $props();

  const vault = $derived($currentVaultPath ? vaultLabel($currentVaultPath) : "");
  const counts = $derived.by(() => {
    const all = flatFiles($fileTree);
    return {
      files: all.filter((n) => !n.is_dir).length,
      dirs: all.filter((n) => n.is_dir).length,
    };
  });

  function close() {
    open = false;
  }
  function pick(p: string) {
    onOpenNote?.(p);
    close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="md-back" transition:fade={{ duration: 160 }} onclick={close} role="presentation"></div>
  <aside class="md-panel" transition:fly={{ x: -320, duration: 240, easing: cubicOut }}>
    <!-- topo: vault -->
    <button class="md-vault m-press" onclick={() => onSwitchVault?.()}>
      <CrystalIllustration size={30} glow={0.5} float={false} />
      <span class="md-vname">
        <span class="md-vlabel">{vault}</span>
        <span class="md-vmeta">{counts.files} {$t("mobile.notes")}</span>
      </span>
      <ChevronsUpDown size={16} class="md-vchev" />
    </button>

    <!-- árvore de pastas (reusa a lista nativa) -->
    <div class="md-tree">
      <MobileNoteList onOpen={pick} />
    </div>

    <!-- rodapé: nova nota + configurações -->
    <div class="md-foot">
      <button class="md-fbtn primary m-press" onclick={() => { onNewNote?.(); close(); }}>
        <Plus size={18} /> {$t("titlebar.newNote")}
      </button>
      <button class="md-icon m-press" onclick={() => { onSwitchVault?.(); }} aria-label={$t("welcome.openVault")}>
        <FolderOpen size={18} />
      </button>
      <button class="md-icon m-press" onclick={() => { onSettings?.(); close(); }} aria-label={$t("common.settings")}>
        <SettingsIcon size={18} />
      </button>
    </div>
  </aside>
{/if}

<style>
  .md-back {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.5);
  }
  .md-panel {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 91;
    width: min(86vw, 360px);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-right: 1px solid color-mix(in srgb, #ffffff 8%, transparent);
    box-shadow: 0 0 48px rgba(0, 0, 0, 0.55);
  }
  .md-vault {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: calc(env(safe-area-inset-top) + 12px) 14px 12px;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
  }
  .md-vname {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .md-vlabel {
    font-size: 1.02rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .md-vmeta {
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }
  .md-vault :global(.md-vchev) {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .md-tree {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* a MobileNoteList tem seu próprio cabeçalho com safe-area; aqui já temos o
     header do vault, então neutralizamos o padding-top de status bar dela. */
  .md-tree :global(.ml-head) {
    display: none;
  }
  .md-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px calc(env(safe-area-inset-bottom) + 12px);
    border-top: 1px solid var(--color-border);
  }
  .md-fbtn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    border-radius: var(--m-radius);
    font-size: 0.95rem;
    font-weight: 700;
  }
  .md-fbtn.primary {
    color: #06121a;
    background: linear-gradient(135deg, var(--color-accent-light, #a5f3fc), var(--color-accent));
    box-shadow: var(--m-glow);
  }
  .md-icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: var(--m-radius);
    background: var(--color-elevated);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
</style>
