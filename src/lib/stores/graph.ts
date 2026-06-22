import { writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";

export interface RawGraphNode {
  id: string;
  label: string;
  group: string;
  path: string;
  word_count: number;
  tags: string[];
}

export interface RawGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "wikilink" | "embed";
}

export interface GraphData {
  nodes: RawGraphNode[];
  edges: RawGraphEdge[];
}

export const graphData = writable<GraphData | null>(null);
export const graphLoading = writable(false);

/** Constrói o índice do grafo no Rust e guarda no store. */
export async function loadGraph(vaultPath: string): Promise<void> {
  graphLoading.set(true);
  try {
    const data = await invoke<GraphData>("build_graph_index", { vaultPath });
    graphData.set(data);
  } finally {
    graphLoading.set(false);
  }
}
