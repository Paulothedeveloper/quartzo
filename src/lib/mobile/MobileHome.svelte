<script lang="ts">
  import { untrack } from "svelte";
  import { FilePlus2, Search, CalendarDays, FileText, Clock } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath } from "$lib/stores/vault";
  import { vaultLabel } from "$lib/stores/settings";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t } from "$lib/i18n";

  let {
    onNewNote,
    onSearch,
    onDailyNote,
    onOpen,
  }: {
    onNewNote?: () => void;
    onSearch?: () => void;
    onDailyNote?: () => void;
    onOpen?: (path: string) => void;
  } = $props();

  const vault = $derived($currentVaultPath ? vaultLabel($currentVaultPath) : "");

  // Recentes: reaproveita o mesmo backend do Insights (notas por modificação).
  interface NoteInfo { path: string; modified: number }
  let recent = $state<NoteInfo[]>([]);
  $effect(() => {
    const v = $currentVaultPath;
    if (!v) { recent = []; return; }
    untrack(async () => {
      try {
        const data = await invoke<{ recents: NoteInfo[] }>("vault_insights", { vault: v, recentLimit: 6 });
        recent = (data.recents ?? []).slice(0, 6);
      } catch {
        recent = [];
      }
    });
  });

  const noteName = (p: string) => (p.split(/[\\/]/).pop() ?? "").replace(/\.md$/i, "");
</script>

<div class="mh">
  <div class="mh-hero">
    <CrystalIllustration size={92} glow={0.6} />
    <div class="mh-vault">{vault}</div>
    <div class="mh-tag">{$t("mobile.tagline")}</div>
  </div>

  <div class="mh-actions">
    <button class="mh-btn primary m-press" onclick={() => onNewNote?.()}>
      <FilePlus2 size={19} />
      {$t("titlebar.newNote")}
    </button>
    <button class="mh-btn m-press" onclick={() => onSearch?.()}>
      <Search size={18} />
      {$t("mobile.search")}
    </button>
    <button class="mh-btn m-press" onclick={() => onDailyNote?.()}>
      <CalendarDays size={18} />
      {$t("titlebar.dailyNote")}
    </button>
  </div>

  {#if recent.length}
    <div class="mh-recent">
      <div class="mh-rhead"><Clock size={13} /> {$t("insights.recents")}</div>
      {#each recent as n, i (n.path)}
        <button
          class="mh-row m-press m-row-in"
          style="animation-delay: {Math.min(i * 45, 250)}ms"
          onclick={() => onOpen?.(n.path)}
        >
          <FileText size={16} />
          <span class="mh-rname">{noteName(n.path)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mh {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    padding: 16px 18px calc(env(safe-area-inset-bottom) + 120px);
  }
  .mh-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    padding: 8vh 0 5vh;
  }
  .mh-vault {
    margin-top: 8px;
    font-size: 1.45rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }
  .mh-tag {
    max-width: 18rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--color-text-muted);
  }
  .mh-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 54px;
    border-radius: var(--m-radius-lg);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary);
    background: var(--color-elevated);
    border: 1px solid color-mix(in srgb, #ffffff 6%, transparent);
  }
  .mh-btn.primary {
    color: #06121a;
    background: linear-gradient(
      135deg,
      var(--color-accent-light, #a5f3fc) 0%,
      var(--color-accent) 100%
    );
    border: none;
    box-shadow: var(--m-glow);
  }
  .mh-recent {
    margin-top: 26px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mh-rhead {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 8px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .mh-row {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 46px;
    padding: 0 12px;
    border-radius: var(--m-radius);
    text-align: left;
    color: var(--color-text-secondary);
  }
  .mh-row:active {
    background: var(--color-elevated);
  }
  .mh-rname {
    flex: 1;
    min-width: 0;
    font-size: 0.95rem;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
