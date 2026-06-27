<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import { Search, Film, Image as ImageIcon, Music, FileQuestion, X, Loader2, Boxes } from "@lucide/svelte";
  import { prismaPickerOpen } from "$lib/stores/ui";
  import { insertAtCursor } from "$lib/stores/editor";
  import { showToast } from "$lib/stores/toast";
  import { t, tr } from "$lib/i18n";

  interface PrismaAsset {
    id: number;
    path: string;
    filename: string;
    ext: string;
    kind: string;
    thumbnail: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
  }

  let q = $state("");
  let assets = $state<PrismaAsset[]>([]);
  let loading = $state(false);
  let present = $state(true);
  let inputEl = $state<HTMLInputElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function load() {
    loading = true;
    try {
      assets = await invoke<PrismaAsset[]>("prisma_search_assets", { query: q, limit: 60 });
    } catch (e) {
      assets = [];
      showToast(String(e), "error");
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!$prismaPickerOpen) return;
    q = "";
    assets = [];
    invoke<boolean>("prisma_db_present")
      .then((p) => {
        present = p;
        if (p) load();
      })
      .catch(() => (present = false));
    queueMicrotask(() => inputEl?.focus());
  });

  function onInput() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 200);
  }

  function fileUrl(p: string): string {
    return "file:///" + encodeURI(p.replace(/\\/g, "/"));
  }

  function attach(a: PrismaAsset) {
    const snippet = `[${a.filename}](prisma://asset/${a.id}) ([${tr("prisma.openFile")}](${fileUrl(a.path)}))`;
    if (insertAtCursor(snippet)) {
      showToast(tr("prisma.attached", { name: a.filename }), "success");
    } else {
      navigator.clipboard.writeText(snippet).catch(() => {});
      showToast(tr("prisma.copied"), "info");
    }
    prismaPickerOpen.set(false);
  }

  function fmtDur(s: number | null): string {
    if (!s) return "";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, "0")}`;
  }
  function metaText(a: PrismaAsset): string {
    const bits: string[] = [a.ext.replace(/^\./, "").toUpperCase()];
    if (a.width && a.height) bits.push(`${a.width}×${a.height}`);
    if (a.duration) bits.push(fmtDur(a.duration));
    return bits.join(" · ");
  }
</script>

{#if $prismaPickerOpen}
  <div
    class="fixed inset-0 z-[170] flex items-start justify-center bg-black/55 pt-[12vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={() => prismaPickerOpen.set(false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      transition:fly={{ y: -18, duration: 230 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={$t("prisma.title")}
      tabindex="-1"
    >
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Boxes size={16} class="text-accent" />
        <span class="text-sm font-semibold">{$t("prisma.title")}</span>
        <button
          class="ml-auto rounded-lg p-1 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          onclick={() => prismaPickerOpen.set(false)}
        >
          <X size={15} />
        </button>
      </div>

      {#if !present}
        <div class="px-5 py-10 text-center text-sm text-text-secondary">
          {$t("prisma.notInstalled")}
        </div>
      {:else}
        <div class="flex items-center gap-2 border-b border-border px-4 py-2">
          <Search size={15} class="text-text-muted" />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:this={inputEl}
            bind:value={q}
            oninput={onInput}
            placeholder={$t("prisma.search")}
            class="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
          />
          {#if loading}<Loader2 size={14} class="animate-spin text-text-muted" />{/if}
        </div>

        <div class="min-h-0 flex-1 overflow-auto p-2">
          {#each assets as a (a.id)}
            <button
              class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-elevated"
              onclick={() => attach(a)}
            >
              <span class="grid h-10 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-bg">
                {#if a.thumbnail}
                  <img src={convertFileSrc(a.thumbnail)} alt="" class="h-full w-full object-cover" />
                {:else if a.kind === "video"}
                  <Film size={16} class="text-text-muted" />
                {:else if a.kind === "image"}
                  <ImageIcon size={16} class="text-text-muted" />
                {:else if a.kind === "audio"}
                  <Music size={16} class="text-text-muted" />
                {:else}
                  <FileQuestion size={16} class="text-text-muted" />
                {/if}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-text-primary">{a.filename}</span>
                <span class="block truncate text-[11px] text-text-muted">{metaText(a)}</span>
              </span>
            </button>
          {:else}
            {#if !loading}
              <div class="px-4 py-8 text-center text-sm text-text-secondary">{$t("prisma.empty")}</div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
