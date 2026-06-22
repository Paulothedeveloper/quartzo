<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { X, Sparkles, Save, Loader2 } from "@lucide/svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { currentVaultPath, fileTree } from "$lib/stores/vault";
  import { showToast } from "$lib/stores/toast";
  import { openNote } from "$lib/vault-actions";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t, tr } from "$lib/i18n";
  import type { FileNode } from "$lib/types";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let title = $state("");
  let content = $state("");
  let tags = $state<string[]>([]);
  let tagInput = $state("");
  let saving = $state(false);
  let contentEl = $state<HTMLTextAreaElement>();

  const today = new Date().toISOString().slice(0, 10);

  // Sugestão de título: 1ª linha não-vazia do conteúdo, sem "#".
  const suggested = $derived.by(() => {
    const line = content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
    return line.replace(/^#+\s*/, "").slice(0, 60);
  });
  const effectiveTitle = $derived(title.trim() || suggested || tr("memory.defaultTitle"));

  // Foca o conteúdo ao abrir; limpa ao fechar.
  $effect(() => {
    if (open) queueMicrotask(() => contentEl?.focus());
  });

  function addTag() {
    const t = tagInput.trim().replace(/,+$/, "").trim();
    if (t && !tags.includes(t)) tags = [...tags, t];
    tagInput = "";
  }
  function onTagKey(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      tags = tags.slice(0, -1);
    }
  }
  function removeTag(t: string) {
    tags = tags.filter((x) => x !== t);
  }

  function reset() {
    title = "";
    content = "";
    tags = [];
    tagInput = "";
  }

  async function save() {
    const vault = $currentVaultPath;
    if (!vault) {
      showToast(tr("memory.noVault"), "info");
      return;
    }
    if (!content.trim()) {
      showToast(tr("memory.noContent"), "info");
      return;
    }
    if (tagInput.trim()) addTag();
    saving = true;
    try {
      const path = await invoke<string>("save_memory", {
        vault,
        title: effectiveTitle,
        content,
        tags,
        date: today,
      });
      fileTree.set(await invoke<FileNode[]>("read_directory", { path: vault }));
      await openNote(path);
      showToast(tr("memory.saved"), "success");
      reset();
      open = false;
    } catch (e) {
      showToast(tr("memory.saveError", { error: String(e) }), "error");
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={(e) => e.target === e.currentTarget && (open = false)}
    onkeydown={(e) => e.key === "Escape" && (open = false)}
    role="presentation"
  >
    <div
      class="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      transition:fly={{ y: 24, duration: 250, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      aria-label={$t("memory.title")}
      tabindex="-1"
    >
      <!-- Header -->
      <div class="flex items-center gap-3 border-b border-border px-5 py-4">
        <CrystalIllustration size={34} glow={0.5} float={false} />
        <div class="flex-1">
          <div class="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} class="text-accent" /> Nova Memória do Claude
          </div>
          <div class="text-xs text-text-secondary">{today} · salva em “00 - Memórias do Claude”</div>
        </div>
        <button
          onclick={() => (open = false)}
          class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Corpo -->
      <div class="flex-1 space-y-4 overflow-auto p-5">
        <!-- Título -->
        <div>
          <label for="mem-title" class="mb-1.5 block text-xs font-medium text-text-secondary"
            >Título</label
          >
          <input
            id="mem-title"
            bind:value={title}
            placeholder={suggested || "Título da memória"}
            class="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>

        <!-- Conteúdo -->
        <div>
          <label for="mem-content" class="mb-1.5 block text-xs font-medium text-text-secondary"
            >Conteúdo</label
          >
          <textarea
            id="mem-content"
            bind:this={contentEl}
            bind:value={content}
            rows="9"
            placeholder="Cole aqui a conversa, decisão técnica ou aprendizado…"
            class="w-full resize-none rounded-lg border border-border bg-bg/40 px-3 py-2 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-accent"
          ></textarea>
        </div>

        <!-- Tags -->
        <div>
          <label for="mem-tags" class="mb-1.5 block text-xs font-medium text-text-secondary"
            >Tags</label
          >
          <div
            class="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg/40 px-2.5 py-2 transition-colors focus-within:border-accent"
          >
            {#each tags as tag (tag)}
              <span
                class="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs text-accent-light"
              >
                {tag}
                <button onclick={() => removeTag(tag)} class="hover:text-accent"
                  ><X size={11} /></button
                >
              </span>
            {/each}
            <input
              id="mem-tags"
              bind:value={tagInput}
              onkeydown={onTagKey}
              onblur={addTag}
              placeholder={tags.length ? "" : "decisão, graph-view…  (Enter)"}
              class="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <button
          onclick={() => (open = false)}
          class="rounded-lg px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          Cancelar
        </button>
        <button
          onclick={save}
          disabled={saving}
          class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-[0_2px_14px_rgba(103,232,249,0.25)] transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
        >
          {#if saving}<Loader2 size={15} class="animate-spin" />{:else}<Save size={15} />{/if}
          Salvar no Quartzo
        </button>
      </div>
    </div>
  </div>
{/if}
