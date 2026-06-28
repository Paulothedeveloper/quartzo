// Histórico de navegação entre notas (voltar/avançar, estilo navegador)
// + favoritos (bookmarks) por vault.
import { writable, get } from "svelte/store";
import { currentVaultPath } from "./vault";

// ---------- Histórico ----------
export const navStack = writable<string[]>([]);
export const navIndex = writable<number>(-1);
export const canBack = writable(false);
export const canForward = writable(false);

// Quando voltamos/avançamos, a próxima mudança de aba NÃO deve empilhar.
let skipPath: string | null = null;

function refreshFlags() {
  const idx = get(navIndex);
  canBack.set(idx > 0);
  canForward.set(idx < get(navStack).length - 1);
}

/** Registra uma navegação (chamado a cada troca de nota ativa). */
export function recordNav(path: string) {
  if (!path) return;
  if (skipPath === path) {
    skipPath = null;
    refreshFlags();
    return;
  }
  skipPath = null;
  const stack = get(navStack);
  const idx = get(navIndex);
  if (stack[idx] === path) return; // já é a atual
  const next = stack.slice(0, idx + 1);
  next.push(path);
  const capped = next.slice(-100);
  navStack.set(capped);
  navIndex.set(capped.length - 1);
  refreshFlags();
}

export function navBack(open: (p: string) => void) {
  const idx = get(navIndex);
  if (idx <= 0) return;
  const path = get(navStack)[idx - 1];
  navIndex.set(idx - 1);
  skipPath = path;
  refreshFlags();
  open(path);
}

export function navForward(open: (p: string) => void) {
  const idx = get(navIndex);
  if (idx >= get(navStack).length - 1) return;
  const path = get(navStack)[idx + 1];
  navIndex.set(idx + 1);
  skipPath = path;
  refreshFlags();
  open(path);
}

// ---------- Favoritos (por vault) ----------
export const bookmarks = writable<string[]>([]);

function bmKey(v: string): string {
  return `quartzo:bookmarks:${v}`;
}

export function loadBookmarks() {
  const v = get(currentVaultPath);
  if (!v || typeof localStorage === "undefined") {
    bookmarks.set([]);
    return;
  }
  try {
    bookmarks.set(JSON.parse(localStorage.getItem(bmKey(v)) ?? "[]"));
  } catch {
    bookmarks.set([]);
  }
}

export function toggleBookmark(path: string) {
  const v = get(currentVaultPath);
  if (!v || !path) return;
  const list = get(bookmarks);
  const next = list.includes(path) ? list.filter((p) => p !== path) : [path, ...list];
  bookmarks.set(next);
  try {
    localStorage.setItem(bmKey(v), JSON.stringify(next));
  } catch {
    /* ignora */
  }
}

export function removeBookmark(path: string) {
  if (get(bookmarks).includes(path)) toggleBookmark(path);
}

// ---------- Fixadas no topo (pinned, por vault) ----------
export const pinned = writable<string[]>([]);

function pinKey(v: string): string {
  return `quartzo:pinned:${v}`;
}

export function loadPinned() {
  const v = get(currentVaultPath);
  if (!v || typeof localStorage === "undefined") {
    pinned.set([]);
    return;
  }
  try {
    pinned.set(JSON.parse(localStorage.getItem(pinKey(v)) ?? "[]"));
  } catch {
    pinned.set([]);
  }
}

export function togglePin(path: string) {
  const v = get(currentVaultPath);
  if (!v || !path) return;
  const list = get(pinned);
  const next = list.includes(path) ? list.filter((p) => p !== path) : [path, ...list];
  pinned.set(next);
  try {
    localStorage.setItem(pinKey(v), JSON.stringify(next));
  } catch {
    /* ignora */
  }
}
