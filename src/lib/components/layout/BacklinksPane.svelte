<script lang="ts">
  import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { Link2, Unlink, X, Loader2 } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeTabPath } from "$lib/stores/tabs";
  import { currentVaultPath } from "$lib/stores/vault";
  import { backlinksOpen } from "$lib/stores/ui";
  import { openNote } from "$lib/vault-actions";
  import { getBacklinkCache, setBacklinkCache } from "$lib/backlink-cache";

  interface Backlink {
    path: string;
    name: string;
    snippet: string;
  }

  let links = $state<Backlink[]>([]);
  let mentions = $state<Backlink[]>([]);
  let loading = $state(false);

  // Recarrega quando a nota ativa muda.
  $effect(() => {
    const target = $activeTabPath;
    const vault = $currentVaultPath;
    if (!target || !vault) {
      links = [];
      mentions = [];
      return;
    }
    const hit = getBacklinkCache(vault, target);
    if (hit) {
      links = hit.links;
      mentions = hit.mentions;
      loading = false;
      return;
    }
    untrack(async () => {
      loading = true;
      try {
        const [bl, um] = await Promise.all([
          invoke<Backlink[]>("get_backlinks", { vaultPath: vault, targetPath: target }),
          invoke<Backlink[]>("get_unlinked_mentions", { vaultPath: vault, targetPath: target }),
        ]);
        links = bl;
        mentions = um;
        setBacklinkCache(vault, target, { links: bl, mentions: um });
      } catch {
        links = [];
        mentions = [];
      } finally {
        loading = false;
      }
    });
  });
</script>

<div class="flex h-full flex-col">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
    <Link2 size={15} class="text-accent" />
    <span class="text-sm font-medium">Backlinks</span>
    {#if !loading}<span class="text-xs text-text-muted">{links.length}</span>{/if}
    <button
      onclick={() => backlinksOpen.set(false)}
      class="ml-auto rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
    >
      <X size={15} />
    </button>
  </div>

  <div class="flex-1 overflow-auto p-2">
    {#if loading}
      <div class="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
        <Loader2 size={15} class="animate-spin" /> Buscando…
      </div>
    {:else}
      <!-- Links explícitos -->
      {#if links.length === 0}
        <div class="px-3 py-6 text-center text-sm text-text-secondary">
          Nenhuma nota aponta para esta ainda.
        </div>
      {:else}
        {#each links as bl, i (bl.path)}
          <button
            onclick={() => openNote(bl.path)}
            in:fly={{ y: 6, duration: 180, delay: Math.min(i * 30, 240) }}
            class="mb-1.5 block w-full rounded-lg border border-border/60 bg-bg/30 p-2.5 text-left transition-all hover:border-accent/40 hover:bg-elevated active:scale-[0.99]"
          >
            <div class="truncate text-sm font-medium text-text-primary">{bl.name}</div>
            {#if bl.snippet}
              <div class="mt-0.5 line-clamp-2 text-xs text-text-secondary">{bl.snippet}</div>
            {/if}
          </button>
        {/each}
      {/if}

      <!-- Menções não-linkadas -->
      {#if mentions.length > 0}
        <div class="mb-1.5 mt-4 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-text-muted">
          <Unlink size={12} /> Menções não-linkadas
          <span class="ml-auto normal-case">{mentions.length}</span>
        </div>
        {#each mentions as m, i (m.path)}
          <button
            onclick={() => openNote(m.path)}
            in:fly={{ y: 6, duration: 180, delay: Math.min(i * 30, 240) }}
            class="mb-1.5 block w-full rounded-lg border border-dashed border-border/50 bg-bg/20 p-2.5 text-left transition-all hover:border-accent/40 hover:bg-elevated active:scale-[0.99]"
          >
            <div class="truncate text-sm font-medium text-text-primary">{m.name}</div>
            {#if m.snippet}
              <div class="mt-0.5 line-clamp-2 text-xs text-text-secondary">{m.snippet}</div>
            {/if}
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</div>
