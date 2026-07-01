<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Lightbulb, X } from "@lucide/svelte";
  import { activeCoach, dismissCoach, skipAllCoach } from "$lib/stores/coachmarks";
  import { t } from "$lib/i18n";

  // position:fixed anct fica preso a ancestrais transformados (.app-body/q-view-in),
  // que são mais altos que a viewport -> o card vazava embaixo da janela. Portamos
  // pro <body> (mesma correção do GraphNotePeek) pra ancorar na viewport real.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

{#if $activeCoach}
  {@const c = $activeCoach}
  <!-- Coachmark contextual: dica curta da feature que o usuário acabou de abrir.
       Não-modal (só o card recebe clique) — não bloqueia a tela. -->
  <div class="coach" use:portal transition:fly={{ y: 20, duration: 240, easing: cubicOut }}>
    <div class="coach-icon"><Lightbulb size={16} /></div>
    <div class="coach-body">
      <div class="coach-title">{c.title}</div>
      <div class="coach-text">{c.body}</div>
      <div class="coach-actions">
        <button class="coach-skip" onclick={() => skipAllCoach()}>
          {$t("coach.skipAll") ?? "Não mostrar dicas"}
        </button>
        <button class="coach-ok" onclick={() => dismissCoach(c.id)}>
          {$t("coach.got") ?? "Entendi"}
        </button>
      </div>
    </div>
    <button class="coach-x" onclick={() => dismissCoach(c.id)} aria-label="fechar">
      <X size={14} />
    </button>
  </div>
{/if}

<style>
  .coach {
    position: fixed;
    left: 50%;
    bottom: calc(22px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 190;
    display: flex;
    gap: 12px;
    width: min(440px, calc(100vw - 32px));
    padding: 14px 14px 12px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
    background: color-mix(in srgb, var(--color-surface) 82%, transparent);
    backdrop-filter: blur(16px) saturate(1.2);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      0 16px 44px rgba(0, 0, 0, 0.5);
  }
  .coach-icon {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    color: var(--color-accent-light);
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
  }
  .coach-body {
    min-width: 0;
    flex: 1;
  }
  .coach-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .coach-text {
    margin-top: 3px;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
    overflow-wrap: break-word;
  }
  .coach-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
  .coach-skip {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    padding: 5px 6px;
    border-radius: 8px;
    transition: color 0.14s ease;
  }
  .coach-skip:hover {
    color: var(--color-text-secondary);
  }
  .coach-ok {
    font-size: 0.82rem;
    font-weight: 600;
    color: #06121a;
    background: var(--color-accent);
    padding: 6px 14px;
    border-radius: 9px;
    transition: background 0.14s ease, transform 0.1s ease;
  }
  .coach-ok:hover {
    background: var(--color-accent-hover);
  }
  .coach-ok:active {
    transform: scale(0.96);
  }
  .coach-x {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    color: var(--color-text-muted);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .coach-x:hover {
    background: var(--color-elevated);
    color: var(--color-text-primary);
  }
</style>
