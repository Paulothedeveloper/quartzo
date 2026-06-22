import { writable } from "svelte/store";
import type { Tab } from "$lib/types";

/** Abas abertas no editor. */
export const openTabs = writable<Tab[]>([]);

/** Caminho da aba ativa (null = nenhuma). */
export const activeTabPath = writable<string | null>(null);
