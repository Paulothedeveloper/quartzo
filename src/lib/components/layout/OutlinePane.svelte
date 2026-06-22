<script lang="ts">
  import { get } from "svelte/store";
  import { fly } from "svelte/transition";
  import { List, X } from "@lucide/svelte";
  import { EditorView } from "@codemirror/view";
  import { openTabs, activeTabPath } from "$lib/stores/tabs";
  import { outlineOpen } from "$lib/stores/ui";
  import { activeEditorView } from "$lib/stores/editor";

  interface Heading {
    level: number;
    text: string;
    line: number; // 0-based
    index: number; // ordem entre os cabeçalhos (alinha com o preview)
  }

  const activeTab = $derived($openTabs.find((t) => t.path === $activeTabPath) ?? null);

  const headings = $derived.by<Heading[]>(() => {
    const md = activeTab?.content ?? "";
    const lines = md.split(/\r?\n/);
    let inFence = false;
    const out: Heading[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*(```|~~~)/.test(l)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i, index: out.length });
    }
    return out;
  });

  const minLevel = $derived(headings.length ? Math.min(...headings.map((h) => h.level)) : 1);

  function goto(h: Heading) {
    // Editor (edit/split): rola e posiciona o cursor na linha do cabeçalho.
    const view = get(activeEditorView);
    if (view && h.line < view.state.doc.lines) {
      const pos = view.state.doc.line(h.line + 1).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 16 }),
      });
      view.focus();
    }
    // Preview (split/read): rola até o N-ésimo cabeçalho renderizado.
    const prose = document.querySelector(".q-prose");
    if (prose) {
      const hs = prose.querySelectorAll("h1,h2,h3,h4,h5,h6");
      (hs[h.index] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
</script>

<div class="flex h-full flex-col">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
    <List size={15} class="text-accent" />
    <span class="text-sm font-medium">Outline</span>
    <span class="text-xs text-text-muted">{headings.length}</span>
    <button
      onclick={() => outlineOpen.set(false)}
      class="ml-auto rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
    >
      <X size={15} />
    </button>
  </div>

  <div class="flex-1 overflow-auto p-2">
    {#if !activeTab}
      <div class="px-3 py-8 text-center text-sm text-text-secondary">Nenhuma nota aberta.</div>
    {:else if headings.length === 0}
      <div class="px-3 py-8 text-center text-sm text-text-secondary">
        Esta nota não tem cabeçalhos (#).
      </div>
    {:else}
      {#each headings as h (h.index)}
        <button
          onclick={() => goto(h)}
          in:fly={{ y: 5, duration: 170, delay: Math.min(h.index * 12, 220) }}
          class="block w-full truncate rounded-md py-1.5 pr-2 text-left text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-accent-light"
          style="padding-left:{8 + (h.level - minLevel) * 14}px"
          title={h.text}
        >
          {h.text}
        </button>
      {/each}
    {/if}
  </div>
</div>
