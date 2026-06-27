// Índice de aliases do vault (front-matter `aliases:`) → caminho da nota.
// Permite resolver [[Apelido]] e sugerir apelidos no autocomplete.
import { writable, get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";

export const aliasIndex = writable<Map<string, string>>(new Map());

export async function loadAliasIndex(vault: string | null) {
  if (!vault) {
    aliasIndex.set(new Map());
    return;
  }
  try {
    const pairs = await invoke<[string, string][]>("build_alias_index", { vaultPath: vault });
    aliasIndex.set(new Map(pairs));
  } catch {
    aliasIndex.set(new Map());
  }
}

/** Resolve um alias (case-insensitive) para o caminho da nota, se existir. */
export function resolveAlias(name: string): string | null {
  return get(aliasIndex).get(name.trim().toLowerCase()) ?? null;
}
