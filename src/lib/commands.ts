/**
 * Registro único de comandos do Quartzo.
 * Fonte de verdade para: a Paleta de comandos, o sistema de atalhos
 * (Configurações › Atalhos) e os atalhos padrão. As FUNÇÕES de cada comando
 * ficam no +page (actionMap), aqui só metadados (id, rótulo, atalho padrão).
 */
export interface CommandDef {
  id: string;
  label: string;
  defaultCombo?: string; // ex.: "ctrl+shift+g"
  hint?: string; // categoria mostrada na paleta quando não há atalho
}

export const COMMAND_DEFS: CommandDef[] = [
  { id: "palette", label: "Paleta de comandos", defaultCombo: "ctrl+k" },
  { id: "quick-switch", label: "Ir para nota…", defaultCombo: "ctrl+o" },
  { id: "global-search", label: "Buscar nas notas…", defaultCombo: "ctrl+shift+f" },
  { id: "open-vault", label: "Abrir vault…", hint: "pasta" },
  { id: "new-note", label: "Nova nota", defaultCombo: "ctrl+n" },
  { id: "new-typed", label: "Nova nota de tipo…", hint: "schema" },
  { id: "new-folder", label: "Nova pasta" },
  { id: "daily-note", label: "Nota do dia", hint: "Diário" },
  { id: "new-memory", label: "Nova Memória do Claude", defaultCombo: "ctrl+shift+m" },
  { id: "close-tab", label: "Fechar aba", defaultCombo: "ctrl+w" },
  { id: "toggle-graph", label: "Abrir/fechar grafo", defaultCombo: "ctrl+g" },
  { id: "toggle-canvas", label: "Abrir/fechar Canvas", defaultCombo: "ctrl+shift+c" },
  { id: "toggle-sketch", label: "Abrir/fechar Rascunho", defaultCombo: "ctrl+shift+d" },
  { id: "toggle-backlinks", label: "Backlinks", defaultCombo: "ctrl+shift+b" },
  { id: "toggle-outline", label: "Outline (cabeçalhos)", defaultCombo: "ctrl+shift+o" },
  { id: "toggle-git", label: "Versões (Git)", defaultCombo: "ctrl+shift+g" },
  { id: "cloud-save", label: "Salvar na nuvem…", defaultCombo: "ctrl+s" },
  { id: "toggle-sidebar", label: "Recolher/expandir sidebar", defaultCombo: "ctrl+\\" },
  { id: "pick-color", label: "Conta-gotas (cor da tela)", hint: "cor" },
  { id: "extract-palette", label: "Extrair paleta de imagem…", hint: "cor" },
  { id: "print-pdf", label: "Imprimir / Salvar como PDF", hint: "exportar" },
  { id: "export-html", label: "Exportar nota como HTML…", hint: "exportar" },
  { id: "settings", label: "Configurações", defaultCombo: "ctrl+," },
  { id: "prisma-attach", label: "Anexar mídia do PRISMA…", hint: "PRISMA" },
  { id: "copy-quartzo-link", label: "Copiar link da nota (quartzo://)" },
  { id: "nav-back", label: "Voltar", hint: "Alt+←" },
  { id: "nav-forward", label: "Avançar", hint: "Alt+→" },
  { id: "toggle-bookmark", label: "Favoritar / desfavoritar nota", defaultCombo: "ctrl+shift+s" },
  { id: "fix-broken-links", label: "Corrigir links quebrados…", hint: "links" },
  { id: "find-duplicates", label: "Notas duplicadas…", hint: "limpeza" },
  { id: "vault-insights", label: "Órfãs e recentes…", hint: "vault" },
  { id: "toggle-zen", label: "Modo foco (zen)", hint: "foco" },
  { id: "bases", label: "Bases (tabelas do vault)…", hint: "vault" },
];

/** Atalhos padrão derivados dos comandos que têm defaultCombo. */
export const DEFAULT_SHORTCUTS: Record<string, string> = Object.fromEntries(
  COMMAND_DEFS.filter((c) => c.defaultCombo).map((c) => [c.id, c.defaultCombo as string])
);
