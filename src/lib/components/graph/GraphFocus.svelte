<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";
  import { untrack } from "svelte";

  // target.nonce muda a cada pedido de foco; ids=null => enquadrar tudo.
  let { target }: { target: { ids: string[] | null; nonce: number } } = $props();

  const { fitView } = useSvelteFlow();

  $effect(() => {
    const nonce = target.nonce; // dependência: dispara a cada pedido
    if (nonce === 0) return; // ignora o estado inicial
    const ids = untrack(() => target.ids);
    const opts: any = ids
      ? { duration: 700, padding: 0.45, maxZoom: 1.5, nodes: ids.map((id) => ({ id })) }
      : { duration: 700, padding: 0.18 };
    // fora do flush do effect: garante nós medidos e evita aviso de "set nodes"
    requestAnimationFrame(() => fitView(opts));
  });
</script>
