<script lang="ts">
  import { untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { X, Table2, Save, Trash2, Bookmark } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { basesOpen, askPrompt, askConfirm } from "$lib/stores/ui";
  import { currentVaultPath } from "$lib/stores/vault";
  import { openNote } from "$lib/vault-actions";
  import { queryIndex, loadQueryIndex, buildQueryView, type QueryView, type WhereOp } from "$lib/query";
  import { showToast } from "$lib/stores/toast";
  import MobileScreen from "$lib/mobile/MobileScreen.svelte";
  import { isMobile } from "$lib/platform";
  import { t, tr } from "$lib/i18n";

  interface Cfg {
    view: QueryView;
    folder: string;
    tag: string;
    whereKey: string;
    whereOp: WhereOp;
    whereVal: string;
    fields: string[];
    sort: string;
    sortDir: "asc" | "desc";
    limit: number | null;
  }
  interface SavedBase {
    name: string;
    cfg: Cfg;
  }

  const blank = (): Cfg => ({
    view: "table",
    folder: "",
    tag: "",
    whereKey: "",
    whereOp: "=",
    whereVal: "",
    fields: [],
    sort: "",
    sortDir: "asc",
    limit: null,
  });

  let cfg = $state<Cfg>(blank());
  let saved = $state<SavedBase[]>([]);
  let host = $state<HTMLDivElement | null>(null);

  const VIEWS: { id: QueryView; label: string }[] = [
    { id: "table", label: "Tabela" },
    { id: "cards", label: "Cartões" },
    { id: "board", label: "Quadro" },
    { id: "list", label: "Lista" },
  ];
  const OPS: WhereOp[] = ["=", "!=", ">", "<", ">=", "<=", "contains", "exists"];

  const allProps = $derived(
    [...new Set($queryIndex.flatMap((n) => Object.keys(n.props)))].sort((a, b) => a.localeCompare(b))
  );

  async function init() {
    const v = $currentVaultPath;
    if (!v) return;
    await loadQueryIndex(v, true);
    try {
      saved = JSON.parse(await invoke<string>("load_bases", { vault: v })) as SavedBase[];
    } catch {
      saved = [];
    }
  }
  $effect(() => {
    if ($basesOpen) untrack(init);
  });

  function toText(c: Cfg): string {
    const lines = [`view: ${c.view}`];
    if (c.folder.trim()) lines.push(`folder: ${c.folder.trim()}`);
    if (c.tag.trim()) lines.push(`tag: ${c.tag.trim()}`);
    if (c.whereKey)
      lines.push(`where: ${c.whereKey} ${c.whereOp}${c.whereOp === "exists" ? "" : " " + c.whereVal}`);
    if (c.fields.length) lines.push(`fields: ${c.fields.join(", ")}`);
    // o quadro agrupa pela 1ª coluna (ou status)
    if (c.view === "board") lines.push(`group: ${c.fields[0] ?? "status"}`);
    if (c.sort) lines.push(`sort: ${c.sort} ${c.sortDir}`);
    if (c.limit && c.limit > 0) lines.push(`limit: ${c.limit}`);
    return lines.join("\n");
  }

  // Renderiza o resultado ao vivo reaproveitando o motor das views ```query.
  $effect(() => {
    const text = toText(cfg);
    const idx = $queryIndex;
    const el = host;
    if (!el || !$basesOpen) return;
    el.innerHTML = "";
    el.appendChild(buildQueryView(text, idx));
  });

  function onPreviewClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest("[data-qopen]");
    if (a) {
      const p = a.getAttribute("data-qopen");
      if (p) {
        openNote(p);
        basesOpen.set(false);
      }
    }
  }

  function toggleField(f: string) {
    cfg.fields = cfg.fields.includes(f) ? cfg.fields.filter((x) => x !== f) : [...cfg.fields, f];
  }

  async function persist() {
    const v = $currentVaultPath;
    if (!v) return;
    await invoke("save_bases", { vault: v, json: JSON.stringify(saved) });
  }
  async function saveCurrent() {
    const name = await askPrompt({
      title: tr("bases.saveTitle"),
      placeholder: tr("bases.namePlaceholder"),
      confirmLabel: tr("bases.save"),
    });
    if (!name) return;
    const clone = JSON.parse(JSON.stringify(cfg)) as Cfg;
    const i = saved.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) saved[i] = { name, cfg: clone };
    else saved = [...saved, { name, cfg: clone }];
    await persist();
    showToast(tr("bases.saved", { name }), "success");
  }
  function applyBase(b: SavedBase) {
    cfg = { ...blank(), ...b.cfg };
  }
  async function deleteBase(b: SavedBase) {
    const ok = await askConfirm({ title: tr("bases.deleteTitle"), message: tr("bases.deleteMsg", { name: b.name }), danger: true, confirmLabel: tr("common.delete") });
    if (!ok) return;
    saved = saved.filter((s) => s !== b);
    await persist();
  }
  function close() {
    basesOpen.set(false);
  }
</script>

{#snippet body()}
      <!-- Bases salvas -->
      <div class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <Bookmark size={13} class="text-text-muted" />
        {#each saved as b (b.name)}
          <span class="group flex items-center gap-1 rounded-full bg-elevated py-1 pl-3 pr-1.5 text-xs">
            <button class="hover:text-accent-light" onclick={() => applyBase(b)}>{b.name}</button>
            <button class="rounded-full p-0.5 text-text-muted opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100" onclick={() => deleteBase(b)} aria-label={$t("common.delete")}>
              <Trash2 size={11} />
            </button>
          </span>
        {:else}
          <span class="text-xs text-text-muted">{$t("bases.noneSaved")}</span>
        {/each}
        <button class="ml-auto flex items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent/15 hover:text-accent-light" onclick={saveCurrent}>
          <Save size={13} /> {$t("bases.saveCurrent")}
        </button>
      </div>

      <!-- Controles -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-border px-4 py-3 md:grid-cols-3">
        <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {$t("bases.view")}
          <select bind:value={cfg.view} class="bases-input">
            {#each VIEWS as v}<option value={v.id}>{v.label}</option>{/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {$t("bases.folder")}
          <input bind:value={cfg.folder} placeholder={$t("bases.folderPlaceholder")} class="bases-input" />
        </label>
        <label class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {$t("bases.tag")}
          <input bind:value={cfg.tag} placeholder="status" class="bases-input" />
        </label>

        <div class="col-span-2 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted md:col-span-2">
          {$t("bases.filter")}
          <div class="flex gap-1.5">
            <select bind:value={cfg.whereKey} class="bases-input flex-1">
              <option value="">—</option>
              {#each allProps as p}<option value={p}>{p}</option>{/each}
            </select>
            <select bind:value={cfg.whereOp} class="bases-input w-24">
              {#each OPS as o}<option value={o}>{o}</option>{/each}
            </select>
            <input bind:value={cfg.whereVal} disabled={cfg.whereOp === "exists"} placeholder={$t("bases.value")} class="bases-input flex-1 disabled:opacity-40" />
          </div>
        </div>
        <div class="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {$t("bases.sort")}
          <div class="flex gap-1.5">
            <select bind:value={cfg.sort} class="bases-input flex-1">
              <option value="">{$t("bases.byName")}</option>
              {#each allProps as p}<option value={p}>{p}</option>{/each}
            </select>
            <select bind:value={cfg.sortDir} class="bases-input w-20">
              <option value="asc">↑</option>
              <option value="desc">↓</option>
            </select>
          </div>
        </div>

        <div class="col-span-2 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-muted md:col-span-3">
          {$t("bases.columns")}
          <div class="flex flex-wrap gap-1.5">
            {#each allProps as p}
              <button
                class="rounded-full px-2.5 py-0.5 text-xs transition-colors {cfg.fields.includes(p)
                  ? 'bg-accent text-bg'
                  : 'bg-elevated text-text-secondary hover:text-text-primary'}"
                onclick={() => toggleField(p)}
              >
                {p}
              </button>
            {:else}
              <span class="text-xs normal-case text-text-muted">{$t("bases.noProps")}</span>
            {/each}
          </div>
        </div>
      </div>

      <!-- Resultado -->
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="q-prose min-h-0 flex-1 overflow-auto p-4" bind:this={host} onclick={onPreviewClick}></div>
{/snippet}

{#if $basesOpen}
  {#if isMobile}
    <MobileScreen title={$t("bases.title")} icon={Table2} onClose={close} pad={false}>
      {@render body()}
    </MobileScreen>
  {:else}
    <div
      class="qmodal-overlay fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[7vh] backdrop-blur-sm"
      transition:fade={{ duration: 150 }}
      onclick={close}
      role="presentation"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="qmodal-panel flex max-h-[84vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
        transition:fly={{ y: -18, duration: 230 }}
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={$t("bases.title")}
        tabindex="-1"
      >
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Table2 size={16} class="text-accent" />
          <span class="text-sm font-semibold">{$t("bases.title")}</span>
          <button class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary" onclick={close} aria-label={$t("save.close")}>
            <X size={15} />
          </button>
        </div>

        {@render body()}
      </div>
    </div>
  {/if}
{/if}

<style>
  :global(.bases-input) {
    border-radius: 8px;
    background: var(--color-elevated);
    padding: 5px 9px;
    font-size: 0.8rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    color: var(--color-text-primary);
    outline: none;
    border: 1px solid transparent;
  }
  :global(.bases-input:focus) {
    border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
  }
</style>
