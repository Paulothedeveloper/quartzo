<script lang="ts">
  import { FolderOpen, FolderPlus } from "@lucide/svelte";
  import CrystalIllustration from "$lib/components/ui/CrystalIllustration.svelte";
  import { t } from "$lib/i18n";

  let { onOpenVault, onCreateVault }: { onOpenVault?: () => void; onCreateVault?: () => void } = $props();

  // partículas brilhantes (posições/tamanhos/tempos fixos = determinístico)
  const particles = [
    { x: 16, y: 22, s: 3, d: 0.0, t: 5.5 },
    { x: 84, y: 16, s: 2, d: 1.4, t: 6.2 },
    { x: 26, y: 70, s: 2, d: 0.7, t: 5.0 },
    { x: 72, y: 64, s: 3, d: 2.1, t: 6.8 },
    { x: 12, y: 48, s: 2, d: 1.0, t: 5.8 },
    { x: 90, y: 44, s: 2, d: 2.6, t: 6.0 },
    { x: 40, y: 14, s: 2, d: 0.4, t: 5.3 },
    { x: 60, y: 80, s: 3, d: 1.8, t: 6.5 },
    { x: 33, y: 40, s: 1.5, d: 3.0, t: 4.8 },
    { x: 67, y: 34, s: 1.5, d: 0.9, t: 5.1 },
    { x: 50, y: 88, s: 2, d: 2.3, t: 6.1 },
    { x: 22, y: 58, s: 1.5, d: 1.6, t: 5.6 },
    { x: 78, y: 76, s: 2, d: 0.2, t: 6.4 },
    { x: 8, y: 34, s: 1.5, d: 2.8, t: 5.2 },
  ];
</script>

<div class="welcome">
  <div class="bloom"></div>
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>
  {#each particles as p, i (i)}
    <span
      class="particle"
      style="left:{p.x}%; top:{p.y}%; width:{p.s}px; height:{p.s}px; animation-delay:{p.d}s; animation-duration:{p.t}s"
    ></span>
  {/each}

  <div class="content">
    <div class="crystal">
      <div class="prism"></div>
      <div class="prism prism2"></div>
      <CrystalIllustration size={224} glow={0.85} />
    </div>
    <h1>{$t("welcome.titlePrefix")} <span class="grad">Quartzo</span></h1>
    <p class="sub">{$t("welcome.subtitleLine1")}<br />{$t("welcome.subtitleLine2")}</p>
    <div class="ctarow">
      <button class="cta" onclick={() => onCreateVault?.()}>
        <FolderPlus size={19} /> {$t("welcome.createVault")}
      </button>
      <button class="cta cta-ghost" onclick={() => onOpenVault?.()}>
        <FolderOpen size={18} /> {$t("welcome.openVault")}
      </button>
    </div>
    <p class="hint">
      {$t("welcome.hintBefore")} <kbd>Ctrl</kbd><kbd>K</kbd> {$t("welcome.hintAfter")}
    </p>
  </div>
</div>

<style>
  .welcome {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: auto; /* nunca corta o conteúdo: rola se a janela for baixa */
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse 75% 60% at 50% 36%, #101a36 0%, #0a0f1c 55%, #05070e 100%);
  }
  .bloom {
    position: absolute;
    top: 30%;
    left: 50%;
    width: 620px;
    height: 620px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(103, 232, 249, 0.18) 0%, rgba(103, 232, 249, 0) 65%);
    filter: blur(20px);
    pointer-events: none;
  }
  .orb {
    position: absolute;
    border-radius: 9999px;
    filter: blur(70px);
    pointer-events: none;
    opacity: 0.4;
  }
  .orb1 {
    width: 360px;
    height: 360px;
    top: 6%;
    left: 8%;
    background: radial-gradient(circle, rgba(103, 232, 249, 0.5), transparent 70%);
    animation: drift 16s ease-in-out infinite;
  }
  .orb2 {
    width: 420px;
    height: 420px;
    bottom: 0%;
    right: 6%;
    background: radial-gradient(circle, rgba(129, 140, 248, 0.45), transparent 70%);
    animation: drift 20s ease-in-out infinite reverse;
  }
  .orb3 {
    width: 260px;
    height: 260px;
    bottom: 14%;
    left: 22%;
    background: radial-gradient(circle, rgba(34, 211, 238, 0.35), transparent 70%);
    animation: drift 24s ease-in-out infinite;
  }
  .particle {
    position: absolute;
    border-radius: 9999px;
    background: #a5f3fc;
    box-shadow: 0 0 8px 1px rgba(103, 232, 249, 0.9);
    opacity: 0;
    animation-name: twinkle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 2;
    text-align: center;
    padding: 2rem max(2rem, env(safe-area-inset-left)) calc(2rem + env(safe-area-inset-bottom));
    max-width: 560px;
    animation: rise 0.6s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1)) both;
  }
  .crystal {
    position: relative;
    display: inline-grid;
    place-items: center;
    filter: drop-shadow(0 0 48px rgba(103, 232, 249, 0.5));
  }
  /* anéis de refração prismática girando = sensação de cristal/luz quebrando */
  .prism {
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 9999px;
    background: conic-gradient(
      from 0deg,
      #67e8f9,
      #818cf8,
      #22d3ee,
      #a5f3fc,
      #c4b5fd,
      #67e8f9
    );
    -webkit-mask: radial-gradient(circle, transparent 57%, #000 60%, #000 68%, transparent 71%);
    mask: radial-gradient(circle, transparent 57%, #000 60%, #000 68%, transparent 71%);
    opacity: 0.45;
    filter: blur(1.5px);
    animation: spin 22s linear infinite;
    pointer-events: none;
  }
  .prism2 {
    width: 420px;
    height: 420px;
    opacity: 0.18;
    -webkit-mask: radial-gradient(circle, transparent 60%, #000 63%, #000 66%, transparent 69%);
    mask: radial-gradient(circle, transparent 60%, #000 63%, #000 66%, transparent 69%);
    animation: spin 34s linear infinite reverse;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  :global(html.no-anim) .prism {
    animation: none;
  }
  h1 {
    margin-top: 1.4rem;
    font-size: clamp(1.9rem, 6vw, 2.6rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    color: #f0f9ff;
    line-height: 1.18; /* >1.1 senão o texto em degradê corta os descendentes */
    padding-bottom: 0.08em;
  }
  .grad {
    background: linear-gradient(115deg, #a5f3fc 0%, #67e8f9 45%, #818cf8 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub {
    margin-top: 1rem;
    color: #94a3b8;
    font-size: 1.05rem;
    line-height: 1.6;
  }
  .ctarow {
    margin-top: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    justify-content: center;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1.9rem;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 600;
    color: #06121a;
    background: linear-gradient(180deg, #7ff0ff, #22d3ee);
    box-shadow:
      0 0 0 1px rgba(165, 243, 252, 0.6),
      0 8px 30px rgba(103, 232, 249, 0.4);
    transition:
      transform 0.18s var(--ease-out, ease),
      box-shadow 0.18s var(--ease-out, ease),
      filter 0.18s var(--ease-out, ease);
  }
  .cta:hover {
    transform: translateY(-2px);
    filter: brightness(1.08);
    box-shadow:
      0 0 0 1px rgba(165, 243, 252, 0.9),
      0 12px 44px rgba(103, 232, 249, 0.6);
  }
  .cta:active {
    transform: translateY(0) scale(0.98);
  }
  .cta-ghost {
    background: transparent;
    color: #cbd5e1;
    box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.4);
  }
  .cta-ghost:hover {
    filter: none;
    background: rgba(148, 163, 184, 0.1);
    box-shadow: inset 0 0 0 1px rgba(165, 243, 252, 0.6);
  }
  .hint {
    margin-top: 1.4rem;
    color: #64748b;
    font-size: 0.85rem;
  }
  .hint kbd {
    display: inline-block;
    margin: 0 1px;
    padding: 1px 7px;
    border-radius: 6px;
    background: rgba(42, 55, 79, 0.7);
    border: 1px solid #334155;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: #cbd5e1;
  }

  /* Janelas baixas: encolhe o cristal e as margens pra nada cortar. */
  @media (max-height: 760px) {
    .crystal { transform: scale(0.72); margin-bottom: -2rem; }
    h1 { margin-top: 0.5rem; }
    .sub { font-size: 0.95rem; margin-top: 0.6rem; }
    .cta { margin-top: 1.2rem; }
    .hint { margin-top: 0.9rem; }
  }
  @media (max-height: 560px) {
    .crystal { transform: scale(0.55); margin-bottom: -3.4rem; }
    .hint { display: none; }
  }

  @keyframes drift {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(30px, -24px) scale(1.08);
    }
  }
  @keyframes twinkle {
    0%,
    100% {
      opacity: 0;
      transform: scale(0.6);
    }
    50% {
      opacity: 0.9;
      transform: scale(1);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  :global(html.no-anim) .orb,
  :global(html.no-anim) .particle,
  :global(html.no-anim) .content {
    animation: none;
  }
  :global(html.no-anim) .particle {
    opacity: 0.5;
  }
</style>
