<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { AlertTriangle } from "@lucide/svelte";
  import { confirmRequest } from "$lib/stores/ui";
  import { t } from "$lib/i18n";

  function done(ok: boolean) {
    const req = $confirmRequest;
    confirmRequest.set(null);
    req?.resolve(ok);
  }

  function onKey(e: KeyboardEvent) {
    if (!$confirmRequest) return;
    if (e.key === "Escape") done(false);
    if (e.key === "Enter") done(true);
  }
</script>

<svelte:window onkeydown={onKey} />

{#if $confirmRequest}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    transition:fade={{ duration: 140 }}
    onclick={() => done(false)}
    role="presentation"
  >
    <div
      class="w-[400px] max-w-[90vw] rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      transition:scale={{ duration: 180, start: 0.96, easing: cubicOut }}
      role="alertdialog"
      aria-modal="true"
      aria-label={$confirmRequest.title}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start gap-3">
        {#if $confirmRequest.danger}
          <div class="mt-0.5 rounded-lg bg-red-500/15 p-2 text-red-400">
            <AlertTriangle size={18} />
          </div>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="text-base font-semibold">{$confirmRequest.title}</div>
          <p class="mt-1 text-sm text-text-secondary">{$confirmRequest.message}</p>
        </div>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button
          onclick={() => done(false)}
          class="rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          {$t("common.cancel")}
        </button>
        <button
          onclick={() => done(true)}
          class="rounded-lg px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.97] {$confirmRequest.danger
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-accent text-bg hover:bg-accent-hover'}"
        >
          {$confirmRequest.confirmLabel ?? $t("common.confirm")}
        </button>
      </div>
    </div>
  </div>
{/if}
