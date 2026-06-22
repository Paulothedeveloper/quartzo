<script lang="ts">
  import { getContext } from "svelte";
  import { Handle, Position, NodeResizer } from "@xyflow/svelte";
  import { X, ImageOff } from "@lucide/svelte";

  let { id, data }: { id: string; data: { src: string } } = $props();
  const ctx = getContext<{
    remove: (id: string) => void;
    src: (p: string) => string;
    saveNow?: () => void;
  }>("qcanvas");

  const url = $derived(data.src ? ctx.src(data.src) : "");
  const fileName = $derived(data.src.split(/[\\/]/).pop() ?? "");
  let broken = $state(false);
</script>

<div class="qimg">
  <NodeResizer minWidth={70} minHeight={70} keepAspectRatio onResizeEnd={() => ctx.saveNow?.()} />
  <Handle type="target" position={Position.Left} class="qhandle" />
  <Handle type="source" position={Position.Right} class="qhandle" />
  <button class="qimg-del nodrag" title="Excluir" onclick={() => ctx.remove(id)}>
    <X size={13} />
  </button>
  {#if broken}
    <div class="qimg-broken">
      <ImageOff size={22} />
      <span>{fileName}</span>
    </div>
  {:else}
    <img src={url} alt={fileName} draggable="false" onerror={() => (broken = true)} />
  {/if}
</div>

<style>
  .qimg {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 14px;
    overflow: hidden;
    background: #11192b;
    border: 1px solid rgba(148, 163, 184, 0.14);
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition:
      border-color 0.18s var(--ease-out, ease),
      box-shadow 0.18s var(--ease-out, ease);
  }
  .qimg:hover {
    border-color: rgba(148, 163, 184, 0.24);
  }
  :global(.svelte-flow__node.selected) .qimg {
    border-color: rgba(103, 232, 249, 0.7);
    box-shadow:
      0 0 0 3px rgba(103, 232, 249, 0.14),
      0 14px 36px rgba(0, 0, 0, 0.45);
  }
  .qimg img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .qimg-broken {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 180px;
    padding: 28px 16px;
    color: var(--color-text-muted);
    font-size: 12px;
    text-align: center;
  }
  .qimg-del {
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
  .qimg:hover .qimg-del {
    opacity: 1;
    transform: scale(1);
  }
  .qimg-del:hover {
    color: #fff;
    background: var(--color-danger);
    border-color: var(--color-danger);
  }
  :global(.qimg .qhandle) {
    width: 11px;
    height: 11px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface);
    opacity: 0;
    transition: opacity 0.16s var(--ease-out, ease);
  }
  .qimg:hover :global(.qhandle) {
    opacity: 1;
  }
</style>
