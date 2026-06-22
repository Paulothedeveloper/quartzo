// SFX da UI — sons curtos e cristalinos sintetizados via Web Audio (sem assets).
// Respeita Configurações: settings.sfx (on/off) e settings.sfxVolume (0–1).
import { get } from "svelte/store";
import { settings } from "./stores/settings";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  sweep?: number; // frequência final (glissando)
  delay?: number; // atraso em segundos
}

function play(tones: Tone[], master = 1) {
  const s = get(settings);
  if (!s.sfx) return;
  const c = ac();
  if (!c) return;
  const vol = Math.max(0, Math.min(1, s.sfxVolume ?? 0.5)) * master;
  if (vol <= 0) return;
  const now = c.currentTime;
  for (const t of tones) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = t.type ?? "sine";
    const start = now + (t.delay ?? 0);
    o.frequency.setValueAtTime(t.freq, start);
    if (t.sweep) o.frequency.exponentialRampToValueAtTime(Math.max(t.sweep, 1), start + t.dur);
    const peak = Math.max((t.gain ?? 0.25) * vol, 0.0002);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + t.dur + 0.03);
  }
}

let lastHover = 0;

export const sfx = {
  /** Inicializa o áudio num gesto do usuário (chamar no 1º pointerdown). */
  unlock() {
    ac();
  },
  click() {
    play([{ freq: 660, dur: 0.07, type: "triangle", gain: 0.16, sweep: 760 }]);
  },
  hover() {
    const n = Date.now();
    if (n - lastHover < 55) return; // anti-spam
    lastHover = n;
    play([{ freq: 1180, dur: 0.035, type: "sine", gain: 0.05 }]);
  },
  toggleOn() {
    play([
      { freq: 587, dur: 0.07, type: "triangle", gain: 0.15 },
      { freq: 880, dur: 0.1, type: "triangle", gain: 0.15, delay: 0.05 },
    ]);
  },
  toggleOff() {
    play([
      { freq: 587, dur: 0.07, type: "triangle", gain: 0.13 },
      { freq: 392, dur: 0.1, type: "triangle", gain: 0.13, delay: 0.05 },
    ]);
  },
  open() {
    play([{ freq: 480, dur: 0.16, type: "sine", gain: 0.16, sweep: 820 }]);
  },
  close() {
    play([{ freq: 620, dur: 0.14, type: "sine", gain: 0.13, sweep: 320 }]);
  },
  success() {
    play([
      { freq: 659, dur: 0.1, type: "triangle", gain: 0.17 },
      { freq: 988, dur: 0.16, type: "triangle", gain: 0.17, delay: 0.08 },
      { freq: 1319, dur: 0.18, type: "sine", gain: 0.1, delay: 0.16 },
    ]);
  },
  error() {
    play([{ freq: 320, dur: 0.2, type: "sawtooth", gain: 0.18, sweep: 180 }]);
  },
  info() {
    play([{ freq: 784, dur: 0.09, type: "sine", gain: 0.12 }]);
  },
  remove() {
    play([{ freq: 440, dur: 0.16, type: "triangle", gain: 0.15, sweep: 150 }]);
  },
};
