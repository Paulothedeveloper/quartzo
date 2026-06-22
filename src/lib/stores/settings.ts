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
  // S1 Editor (estilo Obsidian)
  statusBar: boolean; // mostra o status (Salvando/Não salvo/Salvo) na barra do editor
  readableLineLength: boolean; // margens de tamanho confortável (limita largura)
  rtl: boolean; // direção do texto da direita para a esquerda
  closeBrackets: boolean; // cria pares de parênteses/aspas/markdown
  spellcheck: boolean; // verificação ortográfica do navegador no editor
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
  accentColor: string; // "" = usa o padrão do tema; senão hex (#RRGGBB)
  appZoom: number; // zoom global do app (0.8–1.4)
  uiFontScale: number; // escala da fonte da interface (0.85–1.25)
  // Som
  sfx: boolean;
  sfxVolume: number; // 0–1
  // CSS Snippets habilitados (nomes dos arquivos sem .css)
  enabledSnippets: string[];
  // Geral
  autoOpenVault: boolean;
  sidebarWidth: number; // largura da barra lateral (px), arrastável
  // Atalhos (id da ação -> combo normalizado, ex.: "ctrl+shift+k")
  shortcuts: Record<string, string>;
}

/** Ações com atalho + rótulo (usado na UI de Atalhos). */
export const SHORTCUT_ACTIONS: { id: string; label: string }[] = [
  { id: "palette", label: "Paleta de comandos" },
  { id: "quickSwitch", label: "Ir para nota" },
  { id: "search", label: "Buscar nas notas" },
  { id: "graph", label: "Abrir/fechar grafo" },
  { id: "canvas", label: "Abrir/fechar Canvas" },
  { id: "sketch", label: "Abrir/fechar Rascunho" },
  { id: "outline", label: "Outline (cabeçalhos)" },
  { id: "backlinks", label: "Backlinks" },
  { id: "git", label: "Versões (Git)" },
  { id: "memory", label: "Nova Memória do Claude" },
  { id: "settings", label: "Configurações" },
  { id: "sidebar", label: "Recolher/expandir sidebar" },
  { id: "closeTab", label: "Fechar aba" },
];

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  palette: "ctrl+k",
  quickSwitch: "ctrl+o",
  search: "ctrl+shift+f",
  graph: "ctrl+g",
  canvas: "ctrl+shift+c",
  sketch: "ctrl+shift+d",
  outline: "ctrl+shift+o",
  backlinks: "ctrl+shift+b",
  git: "ctrl+shift+g",
  memory: "ctrl+shift+m",
  settings: "ctrl+,",
  sidebar: "ctrl+\\",
  closeTab: "ctrl+w",
};

/** "ctrl+shift+k" -> "Ctrl+Shift+K" (exibição). */
export function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((p) => {
      if (p === "ctrl") return "Ctrl";
      if (p === "shift") return "Shift";
      if (p === "alt") return "Alt";
      if (p === "\\") return "\\";
      if (p === ",") return ",";
      return p.toUpperCase();
    })
    .join("+");
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
  statusBar: true,
  readableLineLength: true,
  rtl: false,
  closeBrackets: true,
  spellcheck: false,
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
  accentColor: "",
  appZoom: 1,
  uiFontScale: 1,
  sfx: true,
  sfxVolume: 0.5,
  enabledSnippets: [],
  autoOpenVault: true,
  sidebarWidth: 280,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

const KEY = "quartzo:settings";

function load(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // mescla atalhos p/ versões antigas receberem ações novas
        shortcuts: { ...DEFAULT_SHORTCUTS, ...(parsed.shortcuts ?? {}) },
      };
    }
  } catch {
    /* ignora */
  }
  return { ...DEFAULT_SETTINGS };
}

/** Clareia (amt>0) ou escurece (amt<0) um hex. amt em [-1,1]. */
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  );
  return "#" + ch.map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Aplica efeitos colaterais globais (tema, densidade, animações, accent, zoom, fonte). */
export function applySettings(s: Settings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("density-compact", s.density === "compact");
  html.classList.toggle("no-anim", !s.animations);
  html.classList.toggle("theme-light", s.theme === "light");

  // Cor de destaque customizável (cascateia pelos var(--color-accent*) do Tailwind v4).
  if (s.accentColor && /^#?[0-9a-fA-F]{3,6}$/.test(s.accentColor)) {
    const hex = s.accentColor.startsWith("#") ? s.accentColor : "#" + s.accentColor;
    html.style.setProperty("--color-accent", hex);
    html.style.setProperty("--color-accent-hover", shade(hex, -0.14));
    html.style.setProperty("--color-accent-light", shade(hex, 0.3));
  } else {
    html.style.removeProperty("--color-accent");
    html.style.removeProperty("--color-accent-hover");
    html.style.removeProperty("--color-accent-light");
  }

  // Zoom global do app + escala da fonte da interface.
  const zoom = s.appZoom && s.appZoom > 0 ? s.appZoom : 1;
  html.style.setProperty("zoom", String(zoom));
  const scale = s.uiFontScale && s.uiFontScale > 0 ? s.uiFontScale : 1;
  html.style.fontSize = Math.round(16 * scale) + "px";
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
