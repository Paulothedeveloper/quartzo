<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { t, tr } from "$lib/i18n";
  import { fuzzyMatch, highlightParts } from "$lib/fuzzy";

  export interface Command {
    id: string;
    label: string;
    hint?: string;
    action: () => void;
  }

  let {
    open = $bindable(false),
    commands = [],
    onCreate,
    createLabel = tr("palette.createNote"),
    placeholder = tr("palette.placeholder"),
  }: {
    open?: boolean;
    commands?: Command[];
    onCreate?: (name: string) => void;
    createLabel?: string;
    placeholder?: string;
  } = $props();

  let search = $state("");
  let cursor = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  // Busca fuzzy: casa subsequências (ex.: "nta" acha "Nova nota"), ranqueia por
  // pontuação e realça as letras casadas. Sem busca, mantém a ordem original.
  const ranked = $derived.by(() => {
    const q = search.trim();
    if (!q) return commands.map((c) => ({ cmd: c, ranges: [] as [number, number][] }));
    return commands
      .map((c) => ({ cmd: c, r: fuzzyMatch(q, c.label) }))
      .filter((x) => x.r.match)
      .sort((a, b) => b.r.score - a.r.score)
      .map((x) => ({ cmd: x.cmd, ranges: x.r.ranges }));
  });
  const filtered = $derived(ranked.map((r) => r.cmd));
  const canCreate = $derived(!!onCreate && search.trim().length > 0);

  function create() {
    onCreate?.(search.trim());
    open = false;
  }

  // Reseta e foca ao abrir.
  $effect(() => {
    if (open) {
      search = "";
      cursor = 0;
      queueMicrotask(() => inputEl?.focus());
    }
  });

  function run(cmd: Command) {
    cmd.action();
    open = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = Math.min(cursor + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[cursor]) run(filtered[cursor]);
      else if (canCreate) create();
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[150] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
    transition:fade={{ duration: 150 }}
    onclick={() => (open = false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-[520px] overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      transition:fly={{ y: -20, duration: 250 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="border-b border-border p-3">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          bind:this={inputEl}
          bind:value={search}
          {onkeydown}
          {placeholder}
          class="w-full bg-transparent text-lg outline-none placeholder:text-text-secondary"
        />
      </div>
      <div class="max-h-[320px] overflow-auto p-2">
        {#each ranked as { cmd, ranges }, i (cmd.id)}
          <button
            class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition-colors {i ===
            cursor
              ? 'bg-elevated'
              : 'hover:bg-elevated'}"
            onmouseenter={() => (cursor = i)}
            onclick={() => run(cmd)}
          >
            <span
              >{#each highlightParts(cmd.label, ranges) as part}{#if part.hit}<span
                    class="text-accent-light">{part.text}</span
                  >{:else}{part.text}{/if}{/each}</span
            >
            {#if cmd.hint}<span class="text-xs text-text-muted">{cmd.hint}</span>{/if}
          </button>
        {:else}
          {#if canCreate}
            <button
              class="flex w-full items-center justify-between rounded-xl bg-elevated px-4 py-3 text-left text-sm"
              onclick={create}
            >
              <span>{createLabel}: <strong class="text-accent-light">{search.trim()}</strong></span>
              <span class="text-xs text-text-muted">Enter</span>
            </button>
          {:else}
            <div class="px-4 py-6 text-center text-sm text-text-secondary">
              {$t("palette.empty")}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
{/if}
