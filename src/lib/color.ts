// Ferramentas de cor pro designer: conta-gotas (EyeDropper) + extração de paleta de imagem.
import { invoke } from "@tauri-apps/api/core";

/** Conta-gotas global: pega a cor de qualquer pixel da tela. null = cancelado/sem suporte. */
export async function pickColor(): Promise<string | null> {
  const ED = (globalThis as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } })
    .EyeDropper;
  if (!ED) return null;
  try {
    const res = await new ED().open();
    return res.sRGBHex.toUpperCase();
  } catch {
    return null; // usuário cancelou (Esc)
  }
}

export function eyedropperSupported(): boolean {
  return typeof globalThis !== "undefined" && "EyeDropper" in globalThis;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}
function rgbToHex(r: number, g: number, b: number): string {
  return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

/**
 * Extrai as cores dominantes de uma imagem do vault. Lê via data URL (Rust) p/ o
 * canvas não ficar "tainted". Retorna HEX ordenados por frequência.
 */
export async function extractPalette(path: string, count = 6): Promise<string[]> {
  const dataUrl = await invoke<string>("read_image_base64", { path });
  return paletteFromDataUrl(dataUrl, count);
}

/** Núcleo da extração (testável sem Tauri): recebe um data URL e devolve os HEX. */
export async function paletteFromDataUrl(dataUrl: string, count = 6): Promise<string[]> {
  const img = await loadImage(dataUrl);
  const W = 140;
  const scale = img.width > 0 ? W / img.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.min(W, img.width));
  canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Quantiza em 4 bits por canal e soma por balde.
  const map = new Map<number, { c: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = map.get(key);
    if (e) {
      e.c++;
      e.r += r;
      e.g += g;
      e.b += b;
    } else {
      map.set(key, { c: 1, r, g, b });
    }
  }
  return [...map.values()]
    .sort((x, y) => y.c - x.c)
    .slice(0, count)
    .map((e) => rgbToHex(Math.round(e.r / e.c), Math.round(e.g / e.c), Math.round(e.b / e.c)));
}

/** Monta um trecho Markdown com a paleta (os HEX já viram swatches no preview). */
export function paletteToMarkdown(colors: string[]): string {
  if (!colors.length) return "";
  return "**Paleta:** " + colors.join("  ") + "\n";
}
