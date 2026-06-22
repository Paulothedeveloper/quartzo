<script lang="ts">
  import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { GitBranch, X, Loader2, History, GitCommitVertical, FileDiff } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath } from "$lib/stores/vault";
  import { gitOpen } from "$lib/stores/ui";
  import { showToast } from "$lib/stores/toast";
  import { t, tr } from "$lib/i18n";

  interface GitStatus {
    is_repo: boolean;
    branch: string;
    changed: string[];
    clean: boolean;
  }
  interface GitCommit {
    hash: string;
    subject: string;
    author: string;
    when: string;
  }

  let status = $state<GitStatus | null>(null);
  let log = $state<GitCommit[]>([]);
  let loading = $state(false);
  let busy = $state(false);
  let message = $state("");

  async function refresh() {
    const vault = $currentVaultPath;
    if (!vault) {
      status = null;
      log = [];
      return;
    }
    loading = true;
    try {
      status = await invoke<GitStatus>("git_status", { vault });
      log = status.is_repo ? await invoke<GitCommit[]>("git_log", { vault, limit: 30 }) : [];
    } catch {
      status = null;
      log = [];
    } finally {
      loading = false;
    }
  }

  // Recarrega ao abrir / trocar de vault.
  $effect(() => {
    $currentVaultPath;
    untrack(refresh);
  });

  async function initRepo() {
    const vault = $currentVaultPath;
    if (!vault) return;
    busy = true;
    try {
      await invoke("git_init", { vault });
      showToast(tr("git.toastInitStarted"), "success");
      await refresh();
    } catch (e) {
      showToast(tr("git.toastInitError", { error: String(e) }), "error");
    } finally {
      busy = false;
    }
  }

  async function commit() {
    const vault = $currentVaultPath;
    if (!vault) return;
    busy = true;
    try {
      await invoke("git_commit", { vault, message });
      showToast(tr("git.toastCommitSaved"), "success");
      message = "";
      await refresh();
    } catch (e) {
      const msg = String(e);
      if (/identity|user\.name|user\.email|please tell me who you are/i.test(msg)) {
        showToast(tr("git.toastConfigIdentity"), "error");
      } else if (/nothing to commit/i.test(msg)) {
        showToast(tr("git.toastNothingNew"), "info");
      } else {
        showToast(tr("git.toastCommitError", { error: msg }), "error");
      }
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex h-full flex-col">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
    <GitBranch size={15} class="text-accent" />
    <span class="text-sm font-medium">{$t("git.title")}</span>
    {#if status?.is_repo}<span class="text-xs text-text-muted">{status.branch}</span>{/if}
    <button
      onclick={() => gitOpen.set(false)}
      class="ml-auto rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
    >
      <X size={15} />
    </button>
  </div>

  <div class="flex-1 overflow-auto p-3">
    {#if loading}
      <div class="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
        <Loader2 size={15} class="animate-spin" /> {$t("git.reading")}
      </div>
    {:else if !$currentVaultPath}
      <div class="px-2 py-8 text-center text-sm text-text-secondary">{$t("git.openVaultFirst")}</div>
    {:else if status && !status.is_repo}
      <div class="rounded-xl border border-border bg-bg/30 p-4 text-center">
        <GitBranch size={26} class="mx-auto text-text-muted" />
        <p class="mt-3 text-sm text-text-secondary">
          {$t("git.notInitialized")}
        </p>
        <button
          onclick={initRepo}
          disabled={busy}
          class="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97] disabled:opacity-60"
        >
          {#if busy}<Loader2 size={14} class="animate-spin" />{:else}<GitBranch size={14} />{/if}
          {$t("git.initButton")}
        </button>
      </div>
    {:else if status}
      <!-- Commit -->
      <div class="rounded-xl border border-border bg-bg/30 p-3">
        <div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <FileDiff size={13} />
          {status.clean ? $t("git.noChanges") : $t("git.changeCount", { count: status.changed.length })}
        </div>
        {#if !status.clean}
          <div class="mb-2 max-h-28 space-y-0.5 overflow-auto">
            {#each status.changed as c, i (c)}
              <div
                in:fly={{ y: 4, duration: 150, delay: Math.min(i * 18, 200) }}
                class="truncate font-mono text-[11px] text-text-muted"
              >
                {c}
              </div>
            {/each}
          </div>
        {/if}
        <input
          bind:value={message}
          onkeydown={(e) => e.key === "Enter" && commit()}
          placeholder={$t("git.messagePlaceholder")}
          class="mb-2 w-full rounded-lg bg-elevated px-3 py-1.5 text-sm outline-none placeholder:text-text-secondary"
        />
        <button
          onclick={commit}
          disabled={busy || status.clean}
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {#if busy}<Loader2 size={14} class="animate-spin" />{:else}<GitCommitVertical size={15} />{/if}
          {$t("git.commitButton")}
        </button>
      </div>

      <!-- Histórico -->
      <div class="mb-1.5 mt-4 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-text-muted">
        <History size={12} /> {$t("git.history")}
      </div>
      {#if log.length === 0}
        <div class="px-2 py-4 text-center text-xs text-text-muted">{$t("git.noVersions")}</div>
      {:else}
        {#each log as c, i (c.hash)}
          <div
            in:fly={{ y: 6, duration: 170, delay: Math.min(i * 22, 260) }}
            class="mb-1.5 rounded-lg border border-border/60 bg-bg/20 p-2.5"
          >
            <div class="truncate text-sm text-text-primary">{c.subject}</div>
            <div class="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
              <span class="font-mono text-accent-light">{c.hash}</span>
              <span>· {c.when}</span>
              <span class="truncate">· {c.author}</span>
            </div>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>
