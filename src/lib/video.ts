// Notas time-coded sobre vídeo local + exportação de marcadores (review estilo Frame.io, offline).
import { writable } from "svelte/store";

/** Função para "pular" o player ativo para um tempo (registrada pelo VideoReview). */
export const activeVideoSeek = writable<((sec: number) => void) | null>(null);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Segundos -> "mm:ss" (ou "hh:mm:ss" se passar de 1h). */
export function formatTC(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "mm:ss" ou "hh:mm:ss" -> segundos. */
export function parseTC(tc: string): number {
  const p = tc.split(":").map((x) => parseInt(x, 10));
  if (p.some((n) => isNaN(n))) return 0;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/** "hh:mm:ss:ff" (timecode com frames, p/ NLE) a partir de segundos + fps. */
export function formatSMPTE(sec: number, fps: number): number | string {
  const total = Math.max(0, sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export interface Marker {
  tc: string;
  sec: number;
  text: string;
}

/** Extrai marcadores `[mm:ss] texto` (ou `- [mm:ss] texto`) do corpo da nota, ordenados. */
export function extractMarkers(content: string): Marker[] {
  const out: Marker[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const m = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/.exec(raw.trim());
    if (m) out.push({ tc: m[1], sec: parseTC(m[1]), text: m[2].replace(/^[-*]\s*/, "").trim() });
  }
  return out.sort((a, b) => a.sec - b.sec);
}

function csvEsc(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV de marcadores: Timecode, Timecode(SMPTE), Nota. Universal (planilha/NLE via import). */
export function markersToCsv(markers: Marker[], fps: number): string {
  const rows = markers.map((m) => `${m.tc},${formatSMPTE(m.sec, fps)},${csvEsc(m.text)}`);
  return "Timecode,SMPTE,Nota\n" + rows.join("\n") + "\n";
}
