import { writable } from "svelte/store";
import type { FileNode } from "$lib/types";

/** Caminho da pasta-raiz do vault aberto (null = nenhum). */
export const currentVaultPath = writable<string | null>(null);

/** Árvore de arquivos do vault. */
export const fileTree = writable<FileNode[]>([]);

/** Arquivo clicado no explorer (sinaliza pro layout abrir aba). */
export const selectedFile = writable<string | null>(null);
