/** Nó da árvore de arquivos (espelha o struct do Rust). */
export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

/** Aba aberta no editor. */
export interface Tab {
  path: string;
  name: string;
  content: string;
  /** true quando há alterações ainda não salvas em disco. */
  dirty: boolean;
}
