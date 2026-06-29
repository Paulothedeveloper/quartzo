<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { X, FolderOpen, Trash2, Check, FolderPlus } from "@lucide/svelte";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { vaultManagerOpen } from "$lib/stores/ui";
  import { currentVaultPath } from "$lib/stores/vault";
  import { getRecentVaults, removeRecentVault, getVaultLabels, setVaultLabel } from "$lib/stores/settings";
  import { setVault } from "$lib/vault-actions";
  import { showToast } from "$lib/stores/toast";
  import MobileScreen from "$lib/mobile/MobileScreen.svelte";
  import { isMobile } from "$lib/platform";
  import { t, tr } from "$lib/i18n";

  let vaults = $state<string[]>([]);
  let labels = $state<Record<string, string>>({});

  function reload() {
    vaults = getRecentVaults();
    labels = getVaultLabels();
  }

  $effect(() => {
    if ($vaultManagerOpen) reload();
  });

  function folderName(p: string): string {
    return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
  }

  function onRename(path: string, value: string) {
    setVaultLabel(path, value);
    labels = getVaultLabels();
    showToast(tr("vault.renamed"), "success");
  }

  function onRemove(path: string) {
    removeRecentVault(path);
    reload();
    showToast(tr("vault.removed"), "info");
  }

  async function onOpen(path: string) {
    if (path !== $currentVaultPath) {
      await setVault(path).then(() => showToast(tr("sidebar.vaultOpened"), "success"));
    }
    vaultManagerOpen.set(false);
  }

  async function openOther() {
    const sel = await openDialog({ directory: true, multiple: false, title: tr("dialog.openVault") });
    if (typeof sel !== "string") return;
    await setVault(sel);
    vaultManagerOpen.set(false);
  }
</script>

{#snippet body()}
  <p class="text-xs leading-relaxed text-text-secondary">{$t("vault.manageHint")}</p>

  <div class="mt-3 space-y-2">
    {#each vaults as v (v)}
      <div
        class="rounded-xl border border-border bg-bg/30 p-2.5 {v === $currentVaultPath
          ? 'ring-1 ring-accent/40'
          : ''}"
      >
        <div class="flex items-center gap-2">
          <input
            class="min-w-0 flex-1 rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none transition-colors focus:bg-bg placeholder:text-text-secondary"
            value={labels[v] ?? ""}
            placeholder={folderName(v)}
            onchange={(e) => onRename(v, e.currentTarget.value)}
          />
          {#if v === $currentVaultPath}
            <span class="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent-light">
              <Check size={12} /> {$t("vault.active")}
            </span>
          {:else}
            <button
              class="shrink-0 rounded-lg bg-elevated px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-bg active:scale-[0.97]"
              onclick={() => onOpen(v)}
              title={$t("vault.open")}
            >
              <FolderOpen size={14} />
            </button>
          {/if}
          <button
            class="shrink-0 rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-rose-500/15 hover:text-rose-400 active:scale-[0.97]"
            onclick={() => onRemove(v)}
            title={$t("vault.removeFromList")}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div class="mt-1 truncate px-1 font-mono text-[11px] text-text-muted">{v}</div>
      </div>
    {:else}
      <div class="px-4 py-8 text-center text-sm text-text-secondary">{$t("vault.none")}</div>
    {/each}
  </div>
{/snippet}

{#snippet footerBtns()}
  <button
    class="flex w-full items-center justify-center gap-2 rounded-lg bg-elevated px-3 py-2 text-sm font-medium transition-all hover:bg-accent/15 hover:text-accent-light active:scale-[0.98]"
    onclick={openOther}
  >
    <FolderPlus size={15} /> {$t("vault.openOther")}
  </button>
{/snippet}

{#if $vaultManagerOpen}
  {#if isMobile}
    <MobileScreen
      title={$t("vault.manageTitle")}
      icon={FolderOpen}
      onClose={() => vaultManagerOpen.set(false)}
      footer={footerBtns}
    >
      {@render body()}
    </MobileScreen>
  {:else}
    <div
      class="fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[12vh] backdrop-blur-sm"
      transition:fade={{ duration: 150 }}
      onclick={() => vaultManagerOpen.set(false)}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="flex max-h-[72vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
        transition:fly={{ y: -18, duration: 230 }}
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={$t("vault.manageTitle")}
        tabindex="-1"
      >
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <span class="text-sm font-semibold">{$t("vault.manageTitle")}</span>
          <button
            class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
            onclick={() => vaultManagerOpen.set(false)}
          >
            <X size={15} />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-auto p-3 pt-3">{@render body()}</div>

        <div class="border-t border-border p-3">
          {@render footerBtns()}
        </div>
      </div>
    </div>
  {/if}
{/if}
