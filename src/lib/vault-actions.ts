import { get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { fileTree, currentVaultPath } from "$lib/stores/vault";
import { openTabs, activeTabPath } from "$lib/stores/tabs";
import { showToast } from "$lib/stores/toast";
import { rememberVault, addRecentVault } from "$lib/stores/settings";
import { renamingPath, rightPane, backlinksOpen, showGraph, showCanvas, showSketch } from "$lib/stores/ui";
import { graphData } from "$lib/stores/graph";
import { loadTabs } from "$lib/tab-persist";
import type { FileNode } from "$lib/types";

/** Cria uma nota nova numa pasta e já entra em modo renomear (não abre no editor
 * pra não roubar o foco do campo de nome). Abre ao confirmar o nome. */
export async function createNoteIn(dir: string): Promise<void> {
  try {
    const path = await invoke<string>("create_note", { dir, baseName: "Sem título" });
    await refreshTree();
    renamingPath.set(path);
  } catch (e) {
    showToast(`Erro ao criar nota: ${e}`, "error");
  }
}

/** Cria uma nota com o nome dado na raiz do vault e abre. (usado no "buscar = criar") */
export async function createNamedNote(name: string): Promise<void> {
  const vault = get(currentVaultPath);
  if (!vault) {
    showToast("Abra um vault primeiro", "info");
    return;
  }
  try {
    const path = await invoke<string>("create_note", { dir: vault, baseName: name });
    await refreshTree();
    await openNote(path);
  } catch (e) {
    showToast(`Erro ao criar nota: ${e}`, "error");
  }
}

/** Abre (ou cria) a nota do dia em Diário/AAAA-MM-DD.md. */
export async function openDailyNote(): Promise<void> {
  const vault = get(currentVaultPath);
  if (!vault) {
    showToast("Abra um vault primeiro", "info");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  try {
    const path = await invoke<string>("daily_note", { vaultPath: vault, date });
    await refreshTree();
    await openNote(path);
  } catch (e) {
    showToast(`Erro ao abrir nota do dia: ${e}`, "error");
  }
}

/** Cria uma pasta nova e já entra em modo renomear. */
export async function createFolderIn(dir: string): Promise<void> {
  try {
    const path = await invoke<string>("create_folder", { parent: dir, name: "Nova pasta" });
    await refreshTree();
    renamingPath.set(path);
  } catch (e) {
    showToast(`Erro ao criar pasta: ${e}`, "error");
  }
}

/** Relê a árvore do vault atual. */
export async function refreshTree(): Promise<void> {
  const vault = get(currentVaultPath);
  if (!vault) return;
  try {
    fileTree.set(await invoke<FileNode[]>("read_directory", { path: vault }));
  } catch (e) {
    showToast(`Erro ao ler vault: ${e}`, "error");
  }
}

/** Abre um vault: define caminho, lembra, lê árvore e inicia o file watcher.
 * Limpa o estado do vault anterior (abas, painéis e o índice do grafo) — senão
 * o grafo/abas continuavam mostrando o vault antigo ao trocar. */
export async function setVault(path: string): Promise<void> {
  const previous = get(currentVaultPath);
  if (previous && previous !== path) {
    openTabs.set([]);
    activeTabPath.set(null);
    rightPane.set(null);
    backlinksOpen.set(false);
  }
  currentVaultPath.set(path);
  graphData.set(null); // invalida o índice do grafo -> reindexar no novo vault
  rememberVault(path);
  addRecentVault(path);
  await refreshTree();
  try {
    await invoke("start_vault_watch", { path });
  } catch {
    /* sem watcher (ex.: navegador) — segue normal */
  }
  // Restaura as abas da última sessão deste vault.
  const saved = loadTabs(path);
  if (saved.paths.length) {
    const tabs = [];
    for (const p of saved.paths) {
      try {
        const content = await invoke<string>("read_file", { path: p });
        tabs.push({ path: p, name: baseName(p), content, dirty: false });
      } catch {
        /* arquivo sumiu — ignora */
      }
    }
    if (tabs.length) {
      openTabs.set(tabs);
      activeTabPath.set(
        saved.active && tabs.some((t) => t.path === saved.active)
          ? saved.active
          : tabs[tabs.length - 1].path
      );
    }
  }
}

/** Achata a árvore num array só de arquivos. */
export function flatFiles(nodes: FileNode[] = get(fileTree)): FileNode[] {
  const out: FileNode[] = [];
  const walk = (ns: FileNode[]) => {
    for (const n of ns) {
      if (n.is_dir) {
        if (n.children) walk(n.children);
      } else {
        out.push(n);
      }
    }
  };
  walk(nodes);
  return out;
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Resolve o alvo de um wikilink (`[[Nota]]`, `[[Nota|alias]]`, `[[Nota#secao]]`)
 * para um caminho de arquivo no vault. Retorna null se não achar.
 */
export function resolveWikilink(target: string): string | null {
  const clean = target.split("|")[0].split("#")[0].trim().toLowerCase();
  if (!clean) return null;
  const files = flatFiles();
  // 1) match exato pelo nome sem extensão
  const exact = files.find((f) => stripExt(f.name).toLowerCase() === clean);
  if (exact) return exact.path;
  // 2) match pelo nome completo (com extensão)
  const full = files.find((f) => f.name.toLowerCase() === clean);
  return full?.path ?? null;
}

/** Abre (ou foca) a aba de um arquivo, carregando o conteúdo via Rust.
 * Sempre sai do Grafo/Canvas pra mostrar a nota (senão a view "presa" não trocava). */
export async function openNote(path: string): Promise<void> {
  showGraph.set(false);
  showCanvas.set(false);
  showSketch.set(false);
  const tabs = get(openTabs);
  if (tabs.some((t) => t.path === path)) {
    activeTabPath.set(path);
    return;
  }
  try {
    const content = await invoke<string>("read_file", { path });
    openTabs.update((ts) => [...ts, { path, name: baseName(path), content, dirty: false }]);
    activeTabPath.set(path);
  } catch (e) {
    showToast(`Erro ao abrir arquivo: ${e}`, "error");
  }
}

/** Renomeia arquivo/pasta e ajusta abas abertas. */
export async function renameEntry(path: string, newName: string): Promise<void> {
  if (!newName.trim()) return;
  try {
    const newPath = await invoke<string>("rename_path", { path, newName });
    openTabs.update((ts) =>
      ts.map((t) => (t.path === path ? { ...t, path: newPath, name: baseName(newPath) } : t))
    );
    if (get(activeTabPath) === path) activeTabPath.set(newPath);
    await refreshTree();
    showToast("Renomeado", "success");
  } catch (e) {
    showToast(`Erro ao renomear: ${e}`, "error");
  }
}

/** Move pra lixeira e fecha abas afetadas. */
export async function deleteEntry(path: string): Promise<void> {
  try {
    await invoke("delete_to_trash", { path });
    const sep = path.includes("\\") ? "\\" : "/";
    openTabs.update((ts) => ts.filter((t) => t.path !== path && !t.path.startsWith(path + sep)));
    const active = get(activeTabPath);
    if (active && !get(openTabs).some((t) => t.path === active)) {
      const rem = get(openTabs);
      activeTabPath.set(rem.length ? rem[rem.length - 1].path : null);
    }
    await refreshTree();
    showToast("Movido para a lixeira", "info");
  } catch (e) {
    showToast(`Erro ao apagar: ${e}`, "error");
  }
}

/** Abre o item no explorador de arquivos do sistema. */
export async function revealEntry(path: string): Promise<void> {
  try {
    await revealItemInDir(path);
  } catch (e) {
    showToast(`Erro ao abrir no explorador: ${e}`, "error");
  }
}

/** Copia o caminho para a área de transferência. */
export async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    showToast("Caminho copiado", "success");
  } catch {
    showToast("Não foi possível copiar", "error");
  }
}

/** Abre uma nota a partir de um wikilink; avisa se não existir ainda. */
export async function openWikilink(target: string): Promise<void> {
  const path = resolveWikilink(target);
  if (path) {
    await openNote(path);
  } else {
    showToast(`Nota não encontrada: ${target.split("|")[0].split("#")[0].trim()}`, "info");
  }
}
