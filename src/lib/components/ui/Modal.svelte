<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    closeOnBackdrop = true,
    children,
  }: { open?: boolean; closeOnBackdrop?: boolean; children: Snippet } = $props();

  function backdrop() {
    if (closeOnBackdrop) open = false;
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    transition:fade={{ duration: 150 }}
    onclick={backdrop}
    onkeydown={(e) => e.key === "Escape" && (open = false)}
    role="presentation"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      transition:fly={{ y: 24, duration: 250 }}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {@render children()}
    </div>
  </div>
{/if}
