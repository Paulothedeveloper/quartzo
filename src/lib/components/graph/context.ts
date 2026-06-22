/** Estado reativo compartilhado entre GraphCanvas e os nós. */
export interface GraphState {
  hoveredId: string | null;
  /** ids que casam com a busca (null = sem busca ativa). */
  matched: Set<string> | null;
}

export interface GraphCtx {
  state: GraphState; // objeto $state — reativo nos consumidores
  neighbors: Map<string, Set<string>>;
  open: (path: string) => void;
  enter: (id: string) => void;
  leave: () => void;
  /** Foca (zoom + destaque) uma região/pasta. */
  focusGroup: (group: string) => void;
}

export const GRAPH_CTX = Symbol("lumina-graph");
