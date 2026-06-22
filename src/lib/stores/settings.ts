import { writable } from "svelte/store";

export type EditorFont = "JetBrains Mono" | "Fira Code" | "Cascadia Code" | "Consolas";
export type Density = "compact" | "comfortable";
export type Theme = "dark" | "light";
export type ViewMode = "edit" | "split" | "read";

export interface Settings {
  // Editor
  fontSize: number; // 12–20
  editorFont: EditorFont;
  lineHeight: number; // 1.4 – 2.2
  tabSize: number; // 2 | 4
  wordWrap: boolean;
  lineNumbers: boolean;
  vimMode: boolean;
  slashMenu: boolean; // menu "/" no editor
  defaultMode: ViewMode; // modo inicial do editor (editor/dividido/leitura)
  autoSaveDelay: number; // 500 | 700 | 800 | 1500
  // Preview / renderização
  renderMermaid: boolean; // diagramas ```mermaid
  renderQueries: boolean; // views dinâmicas ```query (tabela/kanban/tarefas)
  renderVideo: boolean; // player de revisão ```video + timecodes clicáveis
  renderMath: boolean; // KaTeX $...$  (visual; sempre tokeniza, controla exibição)
  inlineColors: boolean; // swatch ao lado de #RRGGBB
  codeCopyButton: boolean; // botão copiar nos blocos de código
  codeLineNumbers: boolean; // números de linha nos blocos de código
  paletteColors: number; // nº de cores ao extrair paleta de imagem
  // Aparência
  theme: Theme;
  density: Density;
  animations: boolean;
  // Som
  sfx: boolean;
  sfxVolume: number; // 0–1
  // CSS Snippets habilitados (nomes dos arquivos sem .css)
  enabledSnippets: string[];
  // Geral
  autoOpenVault: boolean;
  sidebarWidth: number; // largura da barra lateral (px), arrastável
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  editorFont: "JetBrains Mono",
  lineHeight: 1.75,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: false,
  vimMode: false,
  slashMenu: true,
  defaultMode: "split",
  autoSaveDelay: 700,
  renderMermaid: true,
  renderQueries: true,
  renderVideo: true,
  renderMath: true,
  inlineColors: true,
  codeCopyButton: true,
  codeLineNumbers: false,
  paletteColors: 6,
  theme: "dark",
  density: "comfortable",
  animations: true,
  sfx: true,
  sfxVolume: 0.5,
  enabledSnippets: [],
  autoOpenVault: true,
  sidebarWidth: 280,
};

const KEY = "quartzo:settings";

function load(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignora */
  }
  return { ...DEFAULT_SETTINGS };
}

/** Aplica efeitos colaterais globais (tema, densidade, animações). */
export function applySettings(s: Settings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("density-compact", s.density === "compact");
  html.classList.toggle("no-anim", !s.animations);
  html.classList.toggle("theme-light", s.theme === "light");
}

export const settings = writable<Settings>(load());

settings.subscribe((s) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignora */
    }
  }
  applySettings(s);
});

/** Mapa de fontes -> font-family CSS para o editor. */
export const FONT_STACK: Record<EditorFont, string> = {
  "JetBrains Mono": '"JetBrains Mono", ui-monospace, monospace',
  "Fira Code": '"Fira Code", ui-monospace, monospace',
  "Cascadia Code": '"Cascadia Code", ui-monospace, monospace',
  Consolas: 'Consolas, ui-monospace, monospace',
};

// --- Último vault (para "abrir automaticamente") ---
const LAST_VAULT = "quartzo:lastVault";
export function rememberVault(path: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LAST_VAULT, path);
}
export function getLastVault(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_VAULT);
}

// --- Lista de vaults conhecidos (igual ao seletor do Obsidian) ---
const VAULTS = "quartzo:vaults";
export function getRecentVaults(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(VAULTS) ?? "[]");
  } catch {
    return [];
  }
}
export function addRecentVault(path: string) {
  if (typeof localStorage === "undefined") return;
  const list = [path, ...getRecentVaults().filter((p) => p !== path)].slice(0, 12);
  localStorage.setItem(VAULTS, JSON.stringify(list));
}
export function removeRecentVault(path: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VAULTS, JSON.stringify(getRecentVaults().filter((p) => p !== path)));
}
