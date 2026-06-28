<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    FolderOpen,
    FilePlus,
    Link2,
    Search,
    Share2,
    Wand2,
    Palette,
    Boxes,
    ArrowLeft,
    ArrowRight,
    Check,
    X,
  } from "@lucide/svelte";
  import { tutorialOpen } from "$lib/stores/ui";
  import { isMobile } from "$lib/platform";
  import { sfx } from "$lib/sfx";
  import { t } from "$lib/i18n";

  export const TUTORIAL_FLAG = "quartzo:tutorialDone";

  // Reaproveita os passos tut.step1..8 do i18n (PT/EN/ES). Passo 8 = PRISMA (só desktop).
  const allSteps = [
    { n: 1, icon: FolderOpen },
    { n: 2, icon: FilePlus },
    { n: 3, icon: Link2 },
    { n: 4, icon: Search },
    { n: 5, icon: Share2 },
    { n: 6, icon: Wand2 },
    { n: 7, icon: Palette },
    { n: 8, icon: Boxes },
  ];
  const steps = $derived(isMobile ? allSteps.filter((s) => s.n !== 8) : allSteps);

  let i = $state(0);
  const step = $derived(steps[Math.min(i, steps.length - 1)]);
  const isLast = $derived(i >= steps.length - 1);

  // Passos que falam de atalhos/sidebar do desktop têm variante mobile (tutm.*).
  const MOBILE_OVERRIDES = [1, 4, 5];
  const bodyKey = $derived(
    isMobile && MOBILE_OVERRIDES.includes(step.n)
      ? `tutm.step${step.n}Body`
      : `tut.step${step.n}Body`
  );

  function finish() {
    try {
      localStorage.setItem(TUTORIAL_FLAG, "1");
    } catch {
      /* ignora */
    }
    tutorialOpen.set(false);
    i = 0;
  }
  function next() {
    if (isLast) {
      sfx.success();
      finish();
    } else {
      i += 1;
    }
  }
  function back() {
    if (i > 0) i -= 1;
  }
  function onKey(e: KeyboardEvent) {
    if (!$tutorialOpen) return;
    if (e.key === "Escape") finish();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if $tutorialOpen && step}
  <div
    class="tut-backdrop"
    transition:fade={{ duration: 180 }}
    role="presentation"
  >
    <div
      class="tut-card"
      transition:fly={{ y: 18, duration: 260, easing: cubicOut }}
      role="dialog"
      aria-modal="true"
      aria-label={$t("tut.title")}
      tabindex="-1"
    >
      <button class="tut-x" onclick={finish} title={$t("tut.skip")} aria-label={$t("tut.skip")}>
        <X size={16} />
      </button>

      <div class="tut-kicker">{$t("tut.title")}</div>
      {#key i}
        <div class="tut-step" in:fly={{ x: 16, duration: 220, easing: cubicOut }}>
          <div class="tut-icon">
            {#key step.n}
              {@const Icon = step.icon}
              <Icon size={30} />
            {/key}
          </div>
          <h2 class="tut-title">{$t(`tut.step${step.n}Title`)}</h2>
          <p class="tut-body">{$t(bodyKey)}</p>
        </div>
      {/key}

      <div class="tut-dots">
        {#each steps as s, idx (s.n)}
          <button
            class="tut-dot"
            class:on={idx === i}
            onclick={() => (i = idx)}
            aria-label={`${idx + 1}`}
          ></button>
        {/each}
      </div>

      <div class="tut-actions">
        <button class="tut-skip" onclick={finish}>{$t("tut.skip")}</button>
        <div class="tut-nav">
          {#if i > 0}
            <button class="tut-btn ghost" onclick={back}>
              <ArrowLeft size={16} /> {$t("tut.back")}
            </button>
          {/if}
          <button class="tut-btn primary" onclick={next}>
            {#if isLast}
              <Check size={16} /> {$t("tut.done")}
            {:else}
              {$t("tut.next")} <ArrowRight size={16} />
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tut-backdrop {
    position: fixed;
    inset: 0;
    z-index: 210;
    display: grid;
    place-items: center;
    padding: 20px;
    padding-top: calc(20px + env(safe-area-inset-top));
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    background: rgba(5, 8, 15, 0.62);
    backdrop-filter: blur(8px);
    overflow: auto;
  }
  .tut-card {
    position: relative;
    width: 100%;
    max-width: 460px;
    border-radius: 20px;
    border: 1px solid var(--color-border);
    background:
      radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 60%),
      color-mix(in srgb, var(--color-surface) 96%, transparent);
    padding: 30px 28px 22px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
    text-align: center;
  }
  .tut-x {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    padding: 6px;
    border-radius: 8px;
    color: var(--color-text-muted);
    transition: background 0.14s ease, color 0.14s ease;
  }
  .tut-x:hover { background: var(--color-elevated); color: var(--color-text-primary); }
  .tut-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-accent-light);
  }
  .tut-step { margin-top: 14px; min-height: 188px; }
  .tut-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 18px;
    color: var(--color-accent-light);
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent);
  }
  .tut-title {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }
  .tut-body {
    margin-top: 10px;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
  .tut-dots {
    display: flex;
    justify-content: center;
    gap: 7px;
    margin: 18px 0 16px;
  }
  .tut-dot {
    width: 7px;
    height: 7px;
    border-radius: 9999px;
    background: var(--color-border);
    transition: background 0.18s ease, width 0.18s ease;
  }
  .tut-dot.on {
    width: 22px;
    background: var(--color-accent);
  }
  .tut-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .tut-skip {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    padding: 8px 4px;
  }
  .tut-skip:hover { color: var(--color-text-secondary); }
  .tut-nav { display: flex; gap: 8px; }
  .tut-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 11px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: background 0.14s ease, transform 0.1s ease;
  }
  .tut-btn:active { transform: scale(0.97); }
  .tut-btn.primary {
    background: var(--color-accent);
    color: #06121a;
    box-shadow: 0 2px 14px rgba(103, 232, 249, 0.25);
  }
  .tut-btn.primary:hover { background: var(--color-accent-hover); }
  .tut-btn.ghost {
    color: var(--color-text-secondary);
    box-shadow: inset 0 0 0 1px var(--color-border);
  }
  .tut-btn.ghost:hover { background: var(--color-elevated); color: var(--color-text-primary); }
  :global(html.no-anim) .tut-card,
  :global(html.no-anim) .tut-step { animation: none; }
</style>
