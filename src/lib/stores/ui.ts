import { writable } from "svelte/store";

/** Mostra o Graph View no lugar do editor. */
export const showGraph = writable(false);

/** Sidebar recolhida (rail de ícones de 64px). */
export const sidebarCollapsed = writable(false);

/** Modal de configurações aberto. */
export const settingsOpen = writable(false);

/** Modal "Nova Memória do Claude" aberto. */
export const memoryOpen = writable(false);

/** Painel de backlinks (direita) aberto. */
export const backlinksOpen = writable(false);

/** Painel de Outline (cabeçalhos da nota) aberto. */
export const outlineOpen = writable(false);

/** Painel de Git / versões aberto. */
export const gitOpen = writable(false);

/** Caminho da nota aberta no painel lateral direito (split). null = fechado. */
export const rightPane = writable<string | null>(null);

/** Mostra o Canvas no lugar do editor. */
export const showCanvas = writable(false);

/** Mostra o Rascunho (desenho à mão livre) no lugar do editor. */
export const showSketch = writable(false);

/** Caminho do item sendo renomeado no FileTree (inline). */
export const renamingPath = writable<string | null>(null);

export interface CtxMenuItem {
  label?: string;
  icon?: any;
  action?: () => void;
  danger?: boolean;
  separator?: boolean;
}
/** Menu de contexto global (clique-direito). null = fechado. */
export const ctxMenu = writable<{ x: number; y: number; items: CtxMenuItem[] } | null>(null);

/** Pedido de busca global com termo pré-preenchido (ex.: clicar numa tag). */
export const searchRequest = writable<string | null>(null);

/** Pedido de abrir o seletor de "nova nota de tipo" (disparado pelo + Adicionar). */
export const typePickerRequest = writable(false);
