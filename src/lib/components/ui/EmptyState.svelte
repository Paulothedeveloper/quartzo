<script lang="ts">
  import type { Snippet } from "svelte";
  import CrystalIllustration from "./CrystalIllustration.svelte";

  let {
    title,
    subtitle = "",
    crystal = true,
    crystalSize = 128,
    compact = false,
    children,
  }: {
    title: string;
    subtitle?: string;
    crystal?: boolean;
    crystalSize?: number;
    compact?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class="q-empty-in flex h-full flex-col items-center justify-center px-6 text-center">
  {#if crystal}
    <CrystalIllustration size={crystalSize} glow={0.45} />
  {/if}
  <p class="{compact ? 'mt-4 text-base' : 'mt-6 text-xl'} font-semibold text-text-primary">
    {title}
  </p>
  {#if subtitle}
    <p class="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{subtitle}</p>
  {/if}
  {#if children}
    <div class="mt-6">{@render children()}</div>
  {/if}
</div>

<style>
  .q-empty-in {
    animation: q-empty-in 0.4s var(--ease-out, ease) both;
  }
  @keyframes q-empty-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  :global(html.no-anim) .q-empty-in {
    animation: none;
  }
</style>

