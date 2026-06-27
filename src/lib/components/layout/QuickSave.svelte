<script lang="ts">
  import { untrack } from "svelte";
  import { fly, slide } from "svelte/transition";
  import {
    CloudUpload,
    X,
    Loader2,
    Check,
    CheckCheck,
    ArrowUp,
    ArrowDown,
    Download,
    GitBranch,
    CloudOff,
  } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath } from "$lib/stores/vault";
  import { quickSaveOpen, gitOpen } from "$lib/stores/ui";
  import { gitSync, refreshGitSync } from "$lib/stores/gitsync";
  import { showToast } from "$lib/stores/toast";
  import { sfx } from "$lib/sfx";
  import { t, tr } from "$lib/i18n";

  let message = $state("");
  let busy = $state(false);
  let syncing = $state(false);
  let selected = $state(new Set<string>());

  // Caminho exibido (lado novo, em renomeios). Linha = "XY caminho" ou "old -> new".
  function pathOf(line: string): string {
    const raw = line.length > 3 ? line.slice(3) : line.trim();
    const arrow = raw.indexOf(" -> ");
    return (arrow >= 0 ? raw.slice(arrow + 4) : raw).replace(/^"|"$/g, "");
  }
  // Caminhos a versionar (em renomeio inclui os dois lados, p/ stagear a remoção).
  function filesOf(line: string): string[] {
    const raw = line.length > 3 ? line.slice(3) : line.trim();
    const arrow = raw.indexOf(" -> ");
    if (arrow >= 0)
      return [raw.slice(0, arrow), raw.slice(arrow + 4)].map((p) => p.replace(/^"|"$/g, ""));
    return [raw.replace(/^"|"$/g, "")];
  }
  function baseName(p: string): string {
    return p.split(/[\\/]/).pop() ?? p;
  }
  function dirName(p: string): string {
    const parts = p.split(/[\\/]/);
    parts.pop();
    return parts.join("/");
  }
  // Etiqueta curta do estado (porcelain XY).
  function tagOf(line: string): { ch: string; cls: string } {
    const code = (line.slice(0, 2) || "").trim();
    if (code.includes("?") || code.includes("A")) return { ch: "+", cls: "tag-add" };
    if (code.includes("D")) return { ch: "−", cls: "tag-del" };
    if (code.includes("R")) return { ch: "→", cls: "tag-ren" };
    return { ch: "•", cls: "tag-mod" };
  }

  const changed = $derived($gitSync.changed);
  const allOn = $derived(changed.length > 0 && selected.size === changed.length);
  const selCount = $derived(changed.filter((l) => selected.has(l)).length);

  // Ao abrir: relê status e marca tudo. Re-sincroniza a seleção se a lista mudar.
  $effect(() => {
    if ($quickSaveOpen) untrack(refreshGitSync);
  });
  $effect(() => {
    if ($quickSaveOpen) {
      const c = $gitSync.changed;
      untrack(() => (selected = new Set(c)));
    }
  });

  function toggle(line: string) {
    const n = new Set(selected);
    n.has(line) ? n.delete(line) : n.add(line);
    selected = n;
  }
  function toggleAll() {
    selected = allOn ? new Set() : new Set(changed);
  }
  function close() {
    quickSaveOpen.set(false);
  }
  function openSetup() {
    close();
    gitOpen.set(true);
  }

  function pushErr(e: unknown): string {
    return String(e).replace(/\s+/g, " ").trim().slice(0, 140);
  }

  async function save() {
    const vault = $currentVaultPath;
    if (!vault) return;
    const s = $gitSync;
    const lines = s.changed.filter((l) => selected.has(l));
    if (!lines.length) {
      showToast(tr("save.noSelection"), "info");
      return;
    }
    const all = lines.length === s.changed.length;
    const files = all ? [] : lines.flatMap(filesOf);
    busy = true;
    try {
      await invoke("git_commit_files", { vault, message, files });
      message = "";
      if (s.hasRemote) {
        try {
          await invoke("git_push", { vault });
          showToast(tr("save.savedCloud"), "success");
        } catch (e) {
          showToast(tr("save.pushWarn", { error: pushErr(e) }), "error");
        }
      } else {
        showToast(tr("save.savedLocal"), "info");
      }
      sfx.success();
      await refreshGitSync();
      if ($gitSync.changed.length === 0) close();
    } catch (e) {
      const msg = String(e);
      if (/identity|user\.name|user\.email|who you are/i.test(msg))
        showToast(tr("git.toastConfigIdentity"), "error");
      else if (/nothing to commit/i.test(msg)) showToast(tr("git.toastNothingNew"), "info");
      else showToast(tr("git.toastCommitError", { error: msg }), "error");
      sfx.error();
    } finally {
      busy = false;
    }
  }

  async function pull() {
    const vault = $currentVaultPath;
    if (!vault) return;
    syncing = true;
    try {
      await invoke("git_pull", { vault });
      showToast(tr("git.pulled"), "success");
      await refreshGitSync();
    } catch (e) {
      showToast(tr("git.pullError", { error: String(e) }), "error");
    } finally {
      syncing = false;
    }
  }

  const saveLabel = $derived.by(() => {
    const remote = $gitSync.hasRemote;
    if (allOn || selCount === changed.length)
      return remote ? $t("save.saveAll") : $t("save.saveAllLocal");
    return remote
      ? $t("save.saveSel", { n: selCount })
      : $t("save.saveSelLocal", { n: selCount });
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && $quickSaveOpen) {
      e.preventDefault();
      close();
    }
  }}
/>

{#if $quickSaveOpen}
  <!-- backdrop p/ fechar clicando fora -->
  <button class="qs-backdrop" onclick={close} aria-label={$t("save.close")}></button>

  <div class="qs-panel" transition:fly={{ y: -8, duration: 170 }}>
    <div class="qs-head">
      <CloudUpload size={15} class="text-accent" />
      <span class="text-sm font-semibold">{$t("save.title")}</span>
      {#if $gitSync.isRepo && $gitSync.branch}
        <span class="text-[11px] text-text-muted">{$gitSync.branch}</span>
      {/if}
      <button class="qs-x" onclick={close} aria-label={$t("save.close")}>
        <X size={15} />
      </button>
    </div>

    <div class="qs-body">
      {#if !$currentVaultPath}
        <p class="qs-empty">{$t("save.openVault")}</p>
      {:else if !$gitSync.isRepo}
        <div class="qs-setup">
          <GitBranch size={24} class="mx-auto text-text-muted" />
          <p class="mt-2 text-xs leading-relaxed text-text-secondary">{$t("save.notRepo")}</p>
          <button class="qs-primary mt-3" onclick={openSetup}>
            <GitBranch size={14} /> {$t("save.setup")}
          </button>
        </div>
      {:else}
        <!-- estado do remoto -->
        <div class="qs-remote">
          {#if !$gitSync.hasRemote}
            <span class="inline-flex items-center gap-1 text-text-muted">
              <CloudOff size={12} /> {$t("save.noRemoteTag")}
            </span>
          {:else if $gitSync.ahead > 0 || $gitSync.behind > 0}
            {#if $gitSync.ahead > 0}
              <span class="inline-flex items-center gap-0.5 text-emerald-400">
                <ArrowUp size={12} />{$t("save.aheadTag", { n: $gitSync.ahead })}
              </span>
            {/if}
            {#if $gitSync.behind > 0}
              <button class="qs-pull" onclick={pull} disabled={syncing}>
                {#if syncing}<Loader2 size={12} class="animate-spin" />{:else}<Download size={12} />{/if}
                {$t("save.pull", { n: $gitSync.behind })}
              </button>
            {/if}
          {:else}
            <span class="inline-flex items-center gap-1 text-emerald-400">
              <Check size={12} /> {$t("git.synced")}
            </span>
          {/if}
        </div>

        {#if changed.length === 0}
          <div class="qs-clean">
            <Check size={22} class="mx-auto text-emerald-400" />
            <p class="mt-1.5 text-sm font-medium">{$t("save.allSaved")}</p>
            <p class="text-xs text-text-muted">{$t("save.allSavedSub")}</p>
          </div>
        {:else}
          <button class="qs-selall" onclick={toggleAll}>
            {#if allOn}<CheckCheck size={14} class="text-accent" />{:else}<Check size={14} class="text-text-muted" />{/if}
            <span>{$t("save.selectAll")}</span>
            <span class="ml-auto text-[11px] text-text-muted">
              {$t("save.changeCount", { n: changed.length })}
            </span>
          </button>

          <div class="qs-list">
            {#each changed as line, i (line)}
              {@const p = pathOf(line)}
              {@const tag = tagOf(line)}
              <button
                class="qs-item"
                class:on={selected.has(line)}
                onclick={() => toggle(line)}
                in:fly={{ y: 4, duration: 130, delay: Math.min(i * 14, 160) }}
              >
                <span class="qs-check" class:on={selected.has(line)}>
                  {#if selected.has(line)}<Check size={11} />{/if}
                </span>
                <span class="qs-tag {tag.cls}">{tag.ch}</span>
                <span class="qs-name">
                  <span class="truncate font-medium">{baseName(p)}</span>
                  {#if dirName(p)}<span class="qs-dir truncate">{dirName(p)}</span>{/if}
                </span>
              </button>
            {/each}
          </div>

          <input
            bind:value={message}
            onkeydown={(e) => e.key === "Enter" && !busy && save()}
            placeholder={$t("save.messagePlaceholder")}
            class="qs-msg"
          />
          <button class="qs-primary" onclick={save} disabled={busy || selCount === 0}>
            {#if busy}<Loader2 size={15} class="animate-spin" />{:else}<CloudUpload size={15} />{/if}
            {saveLabel}
          </button>
          <p class="qs-hint">
            {$gitSync.hasRemote ? $t("save.remoteHint") : $t("save.noRemoteHint")}
          </p>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .qs-backdrop {
    position: fixed;
    inset: 0;
    z-index: 59;
    background: transparent;
    cursor: default;
  }
  .qs-panel {
    position: fixed;
    top: 50px;
    right: 10px;
    z-index: 60;
    width: 340px;
    max-height: 74vh;
    display: flex;
    flex-direction: column;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface) 96%, transparent);
    backdrop-filter: blur(14px);
    box-shadow:
      0 18px 50px rgba(0, 0, 0, 0.42),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset;
    overflow: hidden;
  }
  .qs-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
  }
  .qs-x {
    margin-left: auto;
    display: grid;
    place-items: center;
    padding: 4px;
    border-radius: 7px;
    color: var(--color-text-secondary);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .qs-x:hover {
    background: var(--color-elevated);
    color: var(--color-text-primary);
  }
  .qs-body {
    padding: 12px;
    overflow-y: auto;
  }
  .qs-empty {
    padding: 20px 8px;
    text-align: center;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }
  .qs-setup,
  .qs-clean {
    padding: 14px 8px;
    text-align: center;
  }
  .qs-remote {
    margin-bottom: 10px;
    font-size: 11px;
  }
  .qs-pull {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 9999px;
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    color: #fbbf24;
    transition: filter 0.14s ease;
  }
  .qs-pull:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .qs-pull:disabled {
    opacity: 0.5;
  }
  .qs-selall {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border-radius: 9px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-primary);
    transition: background 0.14s ease;
  }
  .qs-selall:hover {
    background: var(--color-elevated);
  }
  .qs-list {
    margin: 4px 0 10px;
    max-height: 230px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .qs-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 9px;
    text-align: left;
    transition: background 0.13s ease;
  }
  .qs-item:hover {
    background: var(--color-elevated);
  }
  .qs-item.on {
    background: color-mix(in srgb, var(--color-accent) 9%, transparent);
  }
  .qs-check {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 5px;
    border: 1.5px solid var(--color-border);
    color: #06121a;
    transition: background 0.13s ease, border-color 0.13s ease;
  }
  .qs-check.on {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .qs-tag {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .tag-add { background: color-mix(in srgb, #10b981 20%, transparent); color: #34d399; }
  .tag-del { background: color-mix(in srgb, #f43f5e 20%, transparent); color: #fb7185; }
  .tag-ren { background: color-mix(in srgb, #38bdf8 20%, transparent); color: #7dd3fc; }
  .tag-mod { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #fbbf24; }
  .qs-name {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    line-height: 1.25;
  }
  .qs-name > span {
    font-size: 0.8rem;
  }
  .qs-dir {
    font-size: 0.68rem !important;
    color: var(--color-text-muted);
  }
  .qs-msg {
    width: 100%;
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--color-elevated);
    font-size: 0.85rem;
    outline: none;
  }
  .qs-msg::placeholder {
    color: var(--color-text-secondary);
  }
  .qs-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--color-accent);
    color: #06121a;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 2px 14px rgba(103, 232, 249, 0.22);
    transition: background 0.14s ease, transform 0.1s ease;
  }
  .qs-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .qs-primary:active:not(:disabled) {
    transform: scale(0.98);
  }
  .qs-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .qs-hint {
    margin-top: 8px;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--color-text-muted);
  }
  :global(html.no-anim) .qs-panel {
    transition: none;
  }
</style>
