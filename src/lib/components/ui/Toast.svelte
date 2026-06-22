<script lang="ts">
  import { fly } from "svelte/transition";
  import { CheckCircle2, AlertCircle, Info } from "@lucide/svelte";
  import { toasts, type ToastType } from "$lib/stores/toast";

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const iconColor: Record<ToastType, string> = {
    success: "text-accent",
    error: "text-danger",
    info: "text-accent",
  };
  const glow: Record<ToastType, string> = {
    success: "0 0 22px rgba(103,232,249,0.30), 0 8px 24px rgba(0,0,0,0.4)",
    info: "0 0 22px rgba(103,232,249,0.22), 0 8px 24px rgba(0,0,0,0.4)",
    error: "0 0 22px rgba(239,68,68,0.28), 0 8px 24px rgba(0,0,0,0.4)",
  };
  const ring: Record<ToastType, string> = {
    success: "border-accent/40",
    info: "border-accent/30",
    error: "border-danger/40",
  };
</script>

<div class="fixed bottom-6 right-6 z-[200] flex flex-col gap-3">
  {#each $toasts as toast (toast.id)}
    {@const Icon = icons[toast.type]}
    <div
      class="flex min-w-[260px] items-center gap-3 rounded-2xl border bg-surface px-5 py-3.5 {ring[
        toast.type
      ]}"
      style="box-shadow: {glow[toast.type]}"
      transition:fly={{ y: 40, duration: 250 }}
    >
      <Icon size={18} class={iconColor[toast.type]} />
      <span class="flex-1 text-sm">{toast.message}</span>
    </div>
  {/each}
</div>
