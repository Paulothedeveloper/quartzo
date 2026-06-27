import { get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { fileTree, currentVaultPath } from "$lib/stores/vault";
import { openTabs, activeTabPath } from "$lib/stores/tabs";
import { showToast } from "$lib/stores/toast";
import { rememberVault, addRecentVault } from "$lib/stores/settings";
import { renamingPath, rightPane, backlinksOpen, showGraph, showCanvas, showSketch, askConfirm } from "$lib/stores/ui";
import { graphData } from "$lib/stores/graph";
import { settings } from "$lib/stores/settings";
import { activeEditorView } from "$lib/stores/editor";
import { loadTabs } from "$lib/tab-persist";
import { tr } from "$lib/i18n";
import type { FileNode } from "$lib/types";

/** Pasta-alvo para uma nota nova, conforme a config "local padrão de novas notas". */
export function newNoteDir(): string {
  const vault = get(currentVaultPath);
  if (!vault) return "";
  if (get(settings).newNoteLocation === "current") {
    const active = get(activeTabPath);
    if (active) {
      const sep = active.includes("\\") ? "\\" : "/";
      const dir = active.slice(0, active.lastIndexOf(sep));
      if (dir) return dir;
    }
  }
  return vault;
}

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
    const path = await invoke<string>("create_note", { dir: newNoteDir() || vault, baseName: name });
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
  // 0) wikilink por CAMINHO ("pasta/Nota"): casa pelo fim do caminho relativo
  if (/[\\/]/.test(clean)) {
    const norm = clean.replace(/\\/g, "/");
    const withExt = norm.endsWith(".md") ? norm : `${norm}.md`;
    const byPath = files.find((f) => {
      const p = f.path.replace(/\\/g, "/").toLowerCase();
      return p.endsWith(`/${withExt}`) || p.endsWith(`/${norm}`) || p === withExt || p === norm;
    });
    if (byPath) return byPath.path;
    // se não casar como caminho, tenta o último segmento como nome
  }
  const base = clean.replace(/\\/g, "/").split("/").pop() ?? clean;
  // 1) match exato pelo nome sem extensão
  const exact = files.find((f) => stripExt(f.name).toLowerCase() === base);
  if (exact) return exact.path;
  // 2) match pelo nome completo (com extensão)
  const full = files.find((f) => f.name.toLowerCase() === base);
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
  const isNote = /\.md$/i.test(path);
  try {
    let newPath: string;
    let updated = 0;
    if (isNote) {
      // Renomeia a nota E corrige os [[wikilinks]] que apontavam pra ela.
      const res = await invoke<{ new_path: string; updated: number }>("rename_note", {
        vault: get(currentVaultPath),
        path,
        newName,
      });
      newPath = res.new_path;
      updated = res.updated;
    } else {
      newPath = await invoke<string>("rename_path", { path, newName });
    }
    // atualiza a aba renomeada (caminho + nome)
    openTabs.update((ts) =>
      ts.map((t) => (t.path === path ? { ...t, path: newPath, name: baseName(newPath) } : t))
    );
    if (get(activeTabPath) === path) activeTabPath.set(newPath);

    // Se links foram reescritos no disco, re-sincroniza as abas abertas
    // NÃO sujas (senão a auto-gravação delas sobrescreveria a correção dos links).
    if (updated > 0) {
      const view = get(activeEditorView);
      const activeP = get(activeTabPath);
      for (const t of get(openTabs)) {
        if (t.dirty) continue;
        try {
          const fresh = await invoke<string>("read_file", { path: t.path });
          if (fresh === t.content) continue;
          openTabs.update((ts) => ts.map((x) => (x.path === t.path ? { ...x, content: fresh } : x)));
          // se for a aba ativa aberta no editor, atualiza o CodeMirror ao vivo
          if (t.path === activeP && view) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: fresh } });
          }
        } catch {
          /* ignora */
        }
      }
    }

    await refreshTree();
    showToast(updated > 0 ? tr("toast.renamedLinks", { count: updated }) : tr("toast.renamed"), "success");
  } catch (e) {
    showToast(`${tr("toast.renameError")}: ${e}`, "error");
  }
}

/** Move pra lixeira e fecha abas afetadas. Confirma antes, se a config pedir. */
export async function deleteEntry(path: string): Promise<void> {
  if (get(settings).confirmBeforeDelete) {
    const ok = await askConfirm({
      title: tr("dialog.deleteTitle"),
      message: tr("dialog.deleteMsg", { name: baseName(path) }),
      confirmLabel: tr("common.delete"),
      danger: true,
    });
    if (!ok) return;
  }
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
