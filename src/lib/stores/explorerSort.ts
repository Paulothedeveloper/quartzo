import { writable, get } from "svelte/store";
import { currentVaultPath } from "./vault";
import type { FileNode } from "$lib/types";

/** Modo de ordenação do explorador. */
export type SortMode = "manual" | "az" | "za" | "random";

const MODE_KEY = "quartzo:sortMode";
const ORDER_KEY = "quartzo:customOrder"; // { [vault]: { [parentPath]: string[] } }

function loadMode(): SortMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "manual" || m === "az" || m === "za" || m === "random") return m;
  } catch {
    /* ignora */
  }
  return "az";
}

/** Modo atual (persistido). */
export const sortMode = writable<SortMode>(loadMode());
sortMode.subscribe((m) => {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignora */
  }
});

/** Semente do modo aleatório — muda a cada "re-sortear". */
export const sortSeed = writable<number>(1);
export function reshuffle() {
  sortSeed.update((s) => s + 1);
}

/** Revisão da ordem manual — bump força re-render das árvores. */
export const customOrderRev = writable(0);

type OrderMap = Record<string, Record<string, string[]>>;
function loadOrders(): OrderMap {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) || "{}");
  } catch {
    return {};
  }
}
let orders: OrderMap = loadOrders();
function saveOrders() {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  } catch {
    /* ignora */
  }
  customOrderRev.update((n) => n + 1);
}

/** Ordem manual salva pros filhos de `parentPath` (null se não houver). */
export function getOrder(parentPath: string): string[] | null {
  const v = get(currentVaultPath);
  if (!v) return null;
  return orders[v]?.[parentPath] ?? null;
}
/** Salva a ordem manual dos filhos de `parentPath`. */
export function setOrder(parentPath: string, paths: string[]) {
  const v = get(currentVaultPath);
  if (!v) return;
  if (!orders[v]) orders[v] = {};
  orders[v][parentPath] = paths;
  saveOrders();
}

function dirOf(p: string): string {
  return p.replace(/[\\/][^\\/]+$/, "");
}

// hash estável (string -> uint) pra ordenação aleatória determinística por semente
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Ordena os filhos de um nível conforme o modo.
 * - az/za: pastas primeiro, depois alfabético (↑/↓).
 * - random: embaralha tudo (determinístico pela semente).
 * - manual: respeita a ordem salva; itens novos vão pro fim (alfabético).
 */
export function sortNodes(
  nodes: FileNode[],
  mode: SortMode,
  seed: number,
  order: string[] | null
): FileNode[] {
  const arr = [...nodes];
  if (mode === "random") {
    return arr.sort((a, b) => hash(a.path + ":" + seed) - hash(b.path + ":" + seed));
  }
  if (mode === "manual" && order && order.length) {
    const idx = new Map(order.map((p, i) => [p, i]));
    return arr.sort((a, b) => {
      const ia = idx.has(a.path) ? idx.get(a.path)! : Infinity;
      const ib = idx.has(b.path) ? idx.get(b.path)! : Infinity;
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name); // itens novos (sem ordem) em alfabético
    });
  }
  // az / za (e manual sem ordem salva) -> pastas primeiro + alfabético
  arr.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    const c = a.name.localeCompare(b.name);
    return mode === "za" ? -c : c;
  });
  return arr;
}

export { dirOf };
