<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { get } from "svelte/store";
  import { invoke } from "@tauri-apps/api/core";
  import { open as openDialog } from "@tauri-apps/plugin-dialog";
  import { X, Unlink, FolderSearch, Monitor, FilePlus2, Loader2, Check } from "@lucide/svelte";
  import { relinkOpen } from "$lib/stores/ui";
  import { currentVaultPath } from "$lib/stores/vault";
  import { activeTabPath, openTabs } from "$lib/stores/tabs";
  import { activeEditorView } from "$lib/stores/editor";
  import { flatFiles, resolveWikilink } from "$lib/vault-actions";
  import { showToast } from "$lib/stores/toast";
  import { t, tr } from "$lib/i18n";

  interface Broken {
    raw: string; // token completo, ex.: "![[img.png]]" ou "[[Nota]]"
    target: string; // alvo limpo
    embed: boolean; // tem "!" na frente
  }

  let broken = $state<Broken[]>([]);
  let candidates = $state<Record<string, string[]>>({}); // raw -> caminhos achados
  let busy = $state<string | null>(null); // raw em processamento
  let fixed = $state<Set<string>>(new Set());

  const AV_IMG = /\.(png|jpe?g|gif|webp|svg|bmp|avif|mp4|webm|m4v|mov|ogg|ogv|pdf|mp3|wav)$/i;

  function noteContent(): string {
    const p = get(activeTabPath);
    return get(openTabs).find((t) => t.path === p)?.content ?? "";
  }

  // Um link [[x]] / ![[x]] está quebrado se não resolve no vault.
  function resolves(target: string, embed: boolean): boolean {
    const clean = target.split("|")[0].split("#")[0].trim();
    if (!clean) return true;
    if (resolveWikilink(clean)) return true;
    // embed de anexo (imagem/av): casa por nome de arquivo no vault
    if (embed && AV_IMG.test(clean)) {
      const lc = clean.toLowerCase();
      return flatFiles().some(
        (f) => f.name.toLowerCase() === lc || f.path.replace(/\\/g, "/").toLowerCase().endsWith("/" + lc)
      );
    }
    return false;
  }

  function scan() {
    const content = noteContent();
    const re = /(!?)\[\[([^\]\n]+)\]\]/g;
    const seen = new Set<string>();
    const out: Broken[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const embed = m[1] === "!";
      const target = m[2];
      const raw = m[0];
      if (seen.has(raw)) continue;
      seen.add(raw);
      if (!resolves(target, embed)) out.push({ raw, target, embed });
    }
    broken = out;
    candidates = {};
    fixed = new Set();
  }

  $effect(() => {
    if ($relinkOpen) scan();
  });

  function baseName(target: string): string {
    return target.split("|")[0].split("#")[0].trim().split(/[\\/]/).pop() ?? target;
  }

  async function searchVault(b: Broken) {
    const base = baseName(b.target).toLowerCase();
    const stem = base.replace(/\.md$/i, "");
    const hits = flatFiles()
      .filter((f) => {
        const n = f.name.toLowerCase();
        return n === base || n.replace(/\.md$/i, "") === stem;
      })
      .map((f) => f.path);
    candidates = { ...candidates, [b.raw]: hits };
    if (!hits.length) showToast(tr("relink.noneVault"), "info");
  }

  async function scanPc(b: Broken) {
    busy = b.raw;
    try {
      const name = baseName(b.target);
      const file = /\.\w+$/.test(name) ? name : `${name}.md`;
      const hits = await invoke<string[]>("scan_for_file", { filename: file, vault: get(currentVaultPath) });
      candidates = { ...candidates, [b.raw]: hits };
      if (!hits.length) showToast(tr("relink.nonePc"), "info");
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      busy = null;
    }
  }

  async function pickManual(b: Broken) {
    const sel = await openDialog({ multiple: false, title: tr("relink.pickTitle") });
    if (typeof sel !== "string") return;
    await applyRelink(b, sel);
  }

  // Reescreve o token quebrado pela referência nova; importa o anexo se for de fora.
  async function applyRelink(b: Broken, chosenPath: string) {
    const vault = get(currentVaultPath);
    if (!vault) return;
    busy = b.raw;
    try {
      const vnorm = vault.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
      const cnorm = chosenPath.replace(/\\/g, "/").toLowerCase();
      const isMd = /\.md$/i.test(chosenPath);
      let refName: string;
      if (cnorm.startsWith(vnorm + "/")) {
        // já está no vault: linka por nome (sem .md para notas)
        const fileName = chosenPath.split(/[\\/]/).pop() ?? "";
        refName = isMd ? fileName.replace(/\.md$/i, "") : fileName;
      } else {
        // fora do vault: copia pra attachments e linka por nome
        const imported = await invoke<string>("import_attachment", { vault, src: chosenPath });
        refName = isMd ? imported.replace(/\.md$/i, "") : imported;
      }
      // preserva alias/heading do alvo original
      const extra = b.target.includes("|") ? b.target.slice(b.target.indexOf("|")) : "";
      const heading = (() => {
        const t0 = b.target.split("|")[0];
        return t0.includes("#") ? t0.slice(t0.indexOf("#")) : "";
      })();
      const newToken = `${b.embed ? "!" : ""}[[${refName}${heading}${extra}]]`;

      const content = noteContent();
      const next = content.split(b.raw).join(newToken);
      const path = get(activeTabPath);
      if (path && next !== content) {
        openTabs.update((ts) => ts.map((x) => (x.path === path ? { ...x, content: next, dirty: true } : x)));
        const v = get(activeEditorView);
        if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: next } });
        await invoke("write_file", { path, content: next });
        openTabs.update((ts) => ts.map((x) => (x.path === path ? { ...x, dirty: false } : x)));
      }
      fixed = new Set([...fixed, b.raw]);
      showToast(tr("relink.fixed"), "success");
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      busy = null;
    }
  }

  function shortPath(p: string): string {
    const parts = p.replace(/\\/g, "/").split("/");
    return parts.slice(-3).join("/");
  }
</script>

{#if $relinkOpen}
  <div
    class="fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[10vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={() => relinkOpen.set(false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[78vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      transition:fly={{ y: -18, duration: 230 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={$t("relink.title")}
      tabindex="-1"
    >
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Unlink size={16} class="text-accent" />
        <span class="text-sm font-semibold">{$t("relink.title")}</span>
        <button
          class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          onclick={() => relinkOpen.set(false)}
        >
          <X size={15} />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto p-3">
        {#if broken.length === 0}
          <div class="px-4 py-10 text-center text-sm text-text-secondary">{$t("relink.noneBroken")}</div>
        {:else}
          <p class="px-1 pb-2 text-xs text-text-secondary">{$t("relink.hint")}</p>
          {#each broken as b (b.raw)}
            <div class="mb-2 rounded-xl border border-border bg-bg/30 p-2.5 {fixed.has(b.raw) ? 'opacity-50' : ''}">
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 truncate text-xs text-rose-300">{b.raw}</code>
                {#if fixed.has(b.raw)}
                  <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400"><Check size={12} /> {$t("relink.done")}</span>
                {/if}
              </div>
              {#if !fixed.has(b.raw)}
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <button class="relink-act" onclick={() => searchVault(b)}><FolderSearch size={13} /> {$t("relink.vault")}</button>
                  <button class="relink-act" onclick={() => scanPc(b)} disabled={busy === b.raw}>
                    {#if busy === b.raw}<Loader2 size={13} class="animate-spin" />{:else}<Monitor size={13} />{/if}
                    {$t("relink.pc")}
                  </button>
                  <button class="relink-act" onclick={() => pickManual(b)}><FilePlus2 size={13} /> {$t("relink.manual")}</button>
                </div>
                {#if candidates[b.raw]?.length}
                  <div class="mt-2 space-y-0.5">
                    {#each candidates[b.raw] as cand (cand)}
                      <button
                        class="flex w-full items-center gap-2 truncate rounded-md px-2 py-1 text-left text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                        onclick={() => applyRelink(b, cand)}
                        title={cand}
                      >
                        <Check size={12} class="shrink-0 text-accent-light" />
                        <span class="truncate">…/{shortPath(cand)}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .relink-act {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border-radius: 7px;
    background: var(--color-elevated);
    padding: 4px 9px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .relink-act:hover {
    background: color-mix(in srgb, var(--color-accent) 16%, var(--color-elevated));
    color: var(--color-accent-light);
  }
  .relink-act:disabled {
    opacity: 0.5;
  }
</style>
