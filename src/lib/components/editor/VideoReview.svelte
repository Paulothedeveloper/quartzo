<script lang="ts">
  import { save } from "@tauri-apps/plugin-dialog";
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import { Plus, Download, Clapperboard, Loader2, FileVideo2 } from "@lucide/svelte";
  import { insertAtCursor } from "$lib/stores/editor";
  import { showToast } from "$lib/stores/toast";
  import { currentVaultPath } from "$lib/stores/vault";
  import { t, tr } from "$lib/i18n";
  import { activeVideoSeek, formatTC, extractMarkers, markersToCsv } from "$lib/video";

  let { src, abs = "", fps = 30, content = "" }: { src: string; abs?: string; fps?: number; content?: string } =
    $props();

  let video = $state<HTMLVideoElement>();
  const markers = $derived(extractMarkers(content));

  // Proxy ffmpeg (para formatos que o WebView não toca: H.265/ProRes/MOV).
  let proxySrc = $state<string | null>(null);
  let proxying = $state(false);
  let loadFailed = $state(false);
  const effectiveSrc = $derived(proxySrc ?? src);
  // Formatos que costumam falhar no WebView2 → sugerimos proxy proativamente.
  const riskyFormat = $derived(/\.(mov|mkv|avi|m4v)$/i.test(abs));

  // Registra a função de "pular para o tempo" (usada pelos timecodes clicáveis na nota).
  $effect(() => {
    activeVideoSeek.set((sec: number) => {
      if (!video) return;
      video.currentTime = sec;
      video.play?.().catch(() => {});
    });
    return () => activeVideoSeek.set(null);
  });

  function capture() {
    if (!video) return;
    const tc = formatTC(video.currentTime);
    const line = `\n- [${tc}] `;
    if (insertAtCursor(line)) {
      showToast(tr("video.markedAt", { tc }), "success");
    } else {
      navigator.clipboard.writeText(`- [${tc}] `).catch(() => {});
      showToast(tr("video.tcCopied", { tc }), "success");
    }
  }

  async function exportMarkers() {
    const ms = extractMarkers(content);
    if (!ms.length) {
      showToast(tr("video.addMarkersFirst"), "info");
      return;
    }
    try {
      const path = await save({
        defaultPath: "marcadores.csv",
        filters: [{ name: tr("video.csvName"), extensions: ["csv"] }],
      });
      if (!path) return;
      await invoke("write_file", { path, content: markersToCsv(ms, fps) });
      showToast(tr("video.exported", { n: ms.length }), "success");
    } catch (e) {
      showToast(tr("video.exportError", { error: String(e) }), "error");
    }
  }

  async function makeProxy() {
    const vault = $currentVaultPath;
    if (!vault || !abs || proxying) return;
    proxying = true;
    try {
      const out = await invoke<string>("make_video_proxy", { vault, src: abs });
      proxySrc = convertFileSrc(out);
      loadFailed = false;
      showToast(tr("video.proxyDone"), "success");
    } catch (e) {
      const msg = String(e);
      if (/não encontrado|not found|no such file|ffmpeg/i.test(msg) && /encontrad|found/i.test(msg)) {
        showToast(tr("video.proxyNoFfmpeg"), "error");
      } else {
        showToast(tr("video.proxyError", { error: msg }), "error");
      }
    } finally {
      proxying = false;
    }
  }
</script>

<div class="q-video">
  <div class="q-video-head">
    <Clapperboard size={15} />
    <span>{$t("video.title")}</span>
    <span class="q-video-count">
      {markers.length === 1
        ? $t("video.markerOne", { n: markers.length })
        : $t("video.markerMany", { n: markers.length })}
    </span>
  </div>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video}
    src={effectiveSrc}
    controls
    preload="metadata"
    onerror={() => (loadFailed = true)}
  ></video>
  {#if (loadFailed || riskyFormat) && !proxySrc}
    <div class="q-video-warn">
      <FileVideo2 size={14} />
      <span>{$t("video.cantPlay")}</span>
    </div>
  {/if}
  <div class="q-video-bar">
    <button class="q-video-btn primary" onclick={capture}>
      <Plus size={15} /> {$t("video.markTimecode")}
    </button>
    <button class="q-video-btn" onclick={exportMarkers}>
      <Download size={15} /> {$t("video.exportCsv")}
    </button>
    {#if abs}
      <button class="q-video-btn" onclick={makeProxy} disabled={proxying}>
        {#if proxying}<Loader2 size={15} class="q-spin" /> {$t("video.proxying")}
        {:else}<FileVideo2 size={15} /> {$t("video.proxy")}{/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .q-video {
    margin: 0 auto 1.4rem;
    max-width: 820px;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: rgba(148, 163, 184, 0.04);
    overflow: hidden;
    animation: q-fade-in 0.3s var(--ease-out, ease);
  }
  :global(html.no-anim) .q-video {
    animation: none;
  }
  .q-video-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }
  .q-video-head :global(svg) {
    color: var(--color-accent);
  }
  .q-video-count {
    margin-left: auto;
    font-weight: 400;
    font-size: 11.5px;
    color: var(--color-text-muted);
  }
  .q-video video {
    display: block;
    width: 100%;
    max-height: 460px;
    background: #000;
  }
  .q-video-warn {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 10px 12px 0;
    padding: 7px 10px;
    border-radius: 9px;
    font-size: 12px;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    border: 1px solid color-mix(in srgb, #f59e0b 32%, transparent);
  }
  .q-video-warn :global(svg) {
    color: #f59e0b;
    flex-shrink: 0;
  }
  .q-video-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }
  .q-video-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  :global(.q-spin) {
    animation: q-spin 0.8s linear infinite;
  }
  @keyframes q-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .q-video-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    transition: background 0.14s var(--ease-out, ease), color 0.14s var(--ease-out, ease);
  }
  .q-video-btn:hover {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-accent) 16%, var(--color-elevated));
  }
  .q-video-btn.primary {
    background: var(--color-accent);
    color: #06121a;
    border-color: var(--color-accent);
    font-weight: 600;
  }
  .q-video-btn.primary:hover {
    background: var(--color-accent-hover);
    color: #06121a;
  }
</style>
