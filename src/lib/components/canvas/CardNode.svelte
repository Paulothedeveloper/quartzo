<script lang="ts">
  import { getContext } from "svelte";
  import { Handle, Position } from "@xyflow/svelte";
  import { X, GripHorizontal } from "@lucide/svelte";

  let { id, data }: { id: string; data: { text: string } } = $props();
  const ctx = getContext<{
    update: (id: string, text: string) => void;
    remove: (id: string) => void;
  }>("qcanvas");
</script>

<div class="qcard">
  <Handle type="target" position={Position.Left} class="qhandle" />
  <Handle type="source" position={Position.Right} class="qhandle" />
  <div class="qcard-grip">
    <GripHorizontal size={14} />
  </div>
  <button class="qcard-del nodrag" title="Excluir" onclick={() => ctx.remove(id)}>
    <X size={13} />
  </button>
  <textarea
    class="nodrag nowheel"
    value={data.text}
    placeholder="Escreva…"
    oninput={(e) => ctx.update(id, e.currentTarget.value)}
  ></textarea>
</div>

<style>
  .qcard {
    position: relative;
    width: 248px;
    border-radius: 16px;
    background: linear-gradient(180deg, #1e2942 0%, #18223a 100%);
    border: 1px solid rgba(148, 163, 184, 0.14);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition:
      border-color 0.18s var(--ease-out, ease),
      box-shadow 0.18s var(--ease-out, ease),
      transform 0.18s var(--ease-out, ease);
  }
  .qcard:hover {
    border-color: rgba(148, 163, 184, 0.24);
  }
  :global(.svelte-flow__node.selected) .qcard {
    border-color: rgba(103, 232, 249, 0.7);
    box-shadow:
      0 0 0 3px rgba(103, 232, 249, 0.14),
      0 14px 36px rgba(0, 0, 0, 0.45);
  }
  /* grip de arrastar (aparece no hover) */
  .qcard-grip {
    display: flex;
    justify-content: center;
    padding: 5px 0 1px;
    color: rgba(148, 163, 184, 0.35);
    opacity: 0;
    transition: opacity 0.18s var(--ease-out, ease);
    cursor: grab;
  }
  .qcard:hover .qcard-grip {
    opacity: 1;
  }
  .qcard textarea {
    width: 100%;
    min-height: 84px;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    padding: 4px 16px 16px;
    font-size: 14px;
    line-height: 1.6;
    color: #e8eef7;
    font-family: var(--font-sans);
  }
  .qcard textarea::placeholder {
    color: rgba(148, 163, 184, 0.5);
  }
  .qcard-del {
    position: absolute;
    top: -9px;
    right: -9px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: #2a374f;
    border: 1px solid rgba(148, 163, 184, 0.2);
    color: var(--color-text-secondary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.16s var(--ease-out, ease);
  }
  .qcard:hover .qcard-del {
    opacity: 1;
    transform: scale(1);
  }
  .qcard-del:hover {
    color: #fff;
    background: var(--color-danger);
    border-color: var(--color-danger);
  }
  /* Handles de conexão (discretos; acendem no hover do card) */
  :global(.qcard .qhandle) {
    width: 11px;
    height: 11px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface);
    opacity: 0;
    transition: opacity 0.16s var(--ease-out, ease);
  }
  .qcard:hover :global(.qhandle) {
    opacity: 1;
  }
</style>
