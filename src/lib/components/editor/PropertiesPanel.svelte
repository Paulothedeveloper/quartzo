<script lang="ts">
  import { slide } from "svelte/transition";
  import { Plus, X, Tag, ChevronDown } from "@lucide/svelte";
  import { t } from "$lib/i18n";
  import { parseFm, applyFm, type FmField } from "$lib/frontmatter";

  let { content = "", setContent }: { content?: string; setContent: (next: string) => void } =
    $props();

  let collapsed = $state(false);
  // Campos derivados do conteúdo (fonte da verdade = o texto da nota).
  const fields = $derived(parseFm(content).fields);

  function commit(next: FmField[]) {
    setContent(applyFm(content, next));
  }

  function updateValue(i: number, value: string) {
    const next = fields.map((f, idx) => (idx === i ? { ...f, value } : f));
    commit(next);
  }
  function updateKey(i: number, key: string) {
    const next = fields.map((f, idx) => (idx === i ? { ...f, key } : f));
    commit(next);
  }
  function remove(i: number) {
    commit(fields.filter((_, idx) => idx !== i));
  }
  function add() {
    collapsed = false;
    commit([...fields, { key: "", value: "" }]);
  }
</script>

<div class="q-props-edit">
  <button class="q-props-head" onclick={() => (collapsed = !collapsed)}>
    <ChevronDown size={13} class="q-props-chev {collapsed ? 'q-props-chev--c' : ''}" />
    <Tag size={12} />
    <span>{$t("props.title")}</span>
    {#if fields.length}<span class="q-props-count">{fields.length}</span>{/if}
  </button>

  {#if !collapsed}
    <div transition:slide={{ duration: 140 }} class="q-props-body">
      {#if fields.length === 0}
        <button class="q-props-empty" onclick={add}>
          <Plus size={13} /> {$t("props.addFirst")}
        </button>
      {:else}
        {#each fields as f, i (i)}
          <div class="q-props-row">
            <input
              class="q-props-key"
              value={f.key}
              placeholder={$t("props.key")}
              onchange={(e) => updateKey(i, e.currentTarget.value)}
            />
            <input
              class="q-props-val"
              value={f.value}
              placeholder={$t("props.value")}
              onchange={(e) => updateValue(i, e.currentTarget.value)}
            />
            <button class="q-props-del" title={$t("props.remove")} onclick={() => remove(i)}>
              <X size={13} />
            </button>
          </div>
        {/each}
        <button class="q-props-add" onclick={add}>
          <Plus size={13} /> {$t("props.add")}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .q-props-edit {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-accent) 3%, transparent);
  }
  .q-props-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    transition: color 0.14s ease;
  }
  .q-props-head:hover {
    color: var(--color-text-secondary);
  }
  :global(.q-props-chev) {
    transition: transform 0.16s var(--ease-out, ease);
  }
  :global(.q-props-chev--c) {
    transform: rotate(-90deg);
  }
  .q-props-count {
    margin-left: auto;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--color-elevated);
    font-size: 10px;
    color: var(--color-text-secondary);
  }
  .q-props-body {
    padding: 2px 12px 10px;
  }
  .q-props-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .q-props-key,
  .q-props-val {
    height: 28px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: var(--color-elevated);
    padding: 0 9px;
    font-size: 12.5px;
    color: var(--color-text-primary);
    outline: none;
    transition: border-color 0.14s ease, background 0.14s ease;
  }
  .q-props-key {
    width: 34%;
    min-width: 90px;
    color: var(--color-accent-light);
    font-weight: 500;
  }
  .q-props-val {
    flex: 1;
    min-width: 0;
  }
  .q-props-key:focus,
  .q-props-val:focus {
    border-color: var(--color-accent);
    background: var(--color-bg);
  }
  .q-props-del {
    display: grid;
    place-items: center;
    height: 26px;
    width: 26px;
    border-radius: 7px;
    color: var(--color-text-muted);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .q-props-del:hover {
    background: color-mix(in srgb, #ef4444 16%, transparent);
    color: #f87171;
  }
  .q-props-add,
  .q-props-empty {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    padding: 5px 9px;
    border-radius: 7px;
    font-size: 12px;
    color: var(--color-text-secondary);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .q-props-add:hover,
  .q-props-empty:hover {
    background: var(--color-elevated);
    color: var(--color-text-primary);
  }
  .q-props-empty {
    width: 100%;
    justify-content: center;
    color: var(--color-text-muted);
  }
</style>
