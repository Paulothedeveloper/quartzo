<script lang="ts">
  import { save } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
  import { Plus, Download, Clapperboard } from "@lucide/svelte";
  import { insertAtCursor } from "$lib/stores/editor";
  import { showToast } from "$lib/stores/toast";
  import { activeVideoSeek, formatTC, extractMarkers, markersToCsv } from "$lib/video";

  let { src, fps = 30, content = "" }: { src: string; fps?: number; content?: string } = $props();

  let video = $state<HTMLVideoElement>();
  const markers = $derived(extractMarkers(content));

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
      showToast(`Marcado em ${tc}`, "success");
    } else {
      navigator.clipboard.writeText(`- [${tc}] `).catch(() => {});
      showToast(`Timecode copiado: ${tc}`, "success");
    }
  }

  async function exportMarkers() {
    const ms = extractMarkers(content);
    if (!ms.length) {
      showToast("Adicione marcadores [mm:ss] na nota primeiro", "info");
      return;
    }
    try {
      const path = await save({
        defaultPath: "marcadores.csv",
        filters: [{ name: "CSV de marcadores", extensions: ["csv"] }],
      });
      if (!path) return;
      await invoke("write_file", { path, content: markersToCsv(ms, fps) });
      showToast(`${ms.length} marcadores exportados`, "success");
    } catch (e) {
      showToast(`Erro ao exportar: ${e}`, "error");
    }
  }
</script>

<div class="q-video">
  <div class="q-video-head">
    <Clapperboard size={15} />
    <span>Revisão de vídeo</span>
    <span class="q-video-count">{markers.length} marcador{markers.length === 1 ? "" : "es"}</span>
  </div>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} {src} controls preload="metadata"></video>
  <div class="q-video-bar">
    <button class="q-video-btn primary" onclick={capture}>
      <Plus size={15} /> Marcar timecode
    </button>
    <button class="q-video-btn" onclick={exportMarkers}>
      <Download size={15} /> Exportar marcadores (CSV)
    </button>
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
  .q-video-bar {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
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
