<script lang="ts">
  import { getContext } from "svelte";
  import { Handle, Position } from "@xyflow/svelte";
  import { X } from "@lucide/svelte";

  let { id, data }: { id: string; data: { color: string } } = $props();
  const ctx = getContext<{
    remove: (id: string) => void;
    copy: (text: string) => void;
  }>("qcanvas");

  const color = $derived(data.color || "#67E8F9");
</script>

<div class="qswatch" style="background:{color}">
  <Handle type="target" position={Position.Left} class="qhandle" />
  <Handle type="source" position={Position.Right} class="qhandle" />
  <button class="qswatch-del nodrag" title="Excluir" onclick={() => ctx.remove(id)}>
    <X size={13} />
  </button>
  <button class="qswatch-hex nodrag" title="Copiar" onclick={() => ctx.copy(color)}>{color}</button>
</div>

<style>
  .qswatch {
    position: relative;
    width: 130px;
    height: 130px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 10px;
  }
  :global(.svelte-flow__node.selected) .qswatch {
    outline: 3px solid rgba(103, 232, 249, 0.6);
    outline-offset: 2px;
  }
  .qswatch-hex {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 7px;
    padding: 2px 8px;
    backdrop-filter: blur(4px);
  }
  .qswatch-del {
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
    transition: all 0.16s var(--ease-out, ease);
  }
  .qswatch:hover .qswatch-del {
    opacity: 1;
  }
  .qswatch-del:hover {
    color: #fff;
    background: var(--color-danger);
    border-color: var(--color-danger);
  }
  :global(.qswatch .qhandle) {
    width: 11px;
    height: 11px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface);
    opacity: 0;
    transition: opacity 0.16s var(--ease-out, ease);
  }
  .qswatch:hover :global(.qhandle) {
    opacity: 1;
  }
</style>
