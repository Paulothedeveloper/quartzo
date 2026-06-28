<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { promptRequest } from "$lib/stores/ui";
  import { t } from "$lib/i18n";

  let value = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);

  // Preenche o valor inicial e foca quando o diálogo abre.
  $effect(() => {
    const req = $promptRequest;
    if (req) {
      value = req.initial ?? "";
      queueMicrotask(() => {
        inputEl?.focus();
        inputEl?.select();
      });
    }
  });

  function done(ok: boolean) {
    const req = $promptRequest;
    promptRequest.set(null);
    req?.resolve(ok ? value.trim() : null);
  }

  function onKey(e: KeyboardEvent) {
    if (!$promptRequest) return;
    if (e.key === "Escape") done(false);
    if (e.key === "Enter") {
      e.preventDefault();
      done(true);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if $promptRequest}
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    transition:fade={{ duration: 140 }}
    onclick={() => done(false)}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-[420px] max-w-[90vw] rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      transition:scale={{ duration: 180, start: 0.96, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      aria-label={$promptRequest.title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="text-base font-semibold">{$promptRequest.title}</div>
      {#if $promptRequest.message}
        <p class="mt-1 text-sm text-text-secondary">{$promptRequest.message}</p>
      {/if}
      <input
        bind:this={inputEl}
        bind:value
        placeholder={$promptRequest.placeholder ?? ""}
        class="mt-3 w-full rounded-lg bg-elevated px-3 py-2 text-sm outline-none transition-colors focus:bg-bg placeholder:text-text-secondary"
      />
      <div class="mt-5 flex justify-end gap-2">
        <button
          onclick={() => done(false)}
          class="rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          {$t("common.cancel")}
        </button>
        <button
          onclick={() => done(true)}
          class="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-bg transition-all hover:bg-accent-hover active:scale-[0.97]"
        >
          {$promptRequest.confirmLabel ?? $t("common.confirm")}
        </button>
      </div>
    </div>
  </div>
{/if}
