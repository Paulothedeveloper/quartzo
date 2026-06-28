// Snapshot automático do Git: salva uma versão sozinho a cada N minutos
// quando o vault é um repositório e há alterações pendentes.
import { get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { settings, getRecentVaults, vaultLabel } from "./stores/settings";
import { currentVaultPath } from "./stores/vault";
import { showToast } from "./stores/toast";
import { tr } from "./i18n";

let timer: ReturnType<typeof setInterval> | null = null;

interface GitStatusLite {
  is_repo: boolean;
  clean: boolean;
}

async function runSnapshot() {
  const vault = get(currentVaultPath);
  if (!vault) return;
  try {
    const st = await invoke<GitStatusLite>("git_status", { vault });
    if (!st.is_repo || st.clean) return;
    const stamp = new Date().toLocaleString();
    await invoke("git_commit", { vault, message: `Snapshot automático — ${stamp}` });
    showToast(tr("git.autoSnapshotDone"), "info");
  } catch {
    /* silencioso: identidade não configurada, etc. */
  }
}

interface GitRemoteLite {
  has_remote: boolean;
  has_upstream: boolean;
}

export interface SaveAllResult {
  pushed: number; // enviados ao remoto
  committed: number; // salvos localmente (sem remoto)
  skipped: number; // sem alteração ou não-repo
  failed: string[]; // labels que deram erro
}

/** Salva TODOS os vaults conhecidos de uma vez: commit em cada um com alterações;
 *  se tiver remoto, faz push. Desktop-only (Git). Retorna um resumo. */
export async function saveAllVaultsToCloud(message?: string): Promise<SaveAllResult> {
  const res: SaveAllResult = { pushed: 0, committed: 0, skipped: 0, failed: [] };
  const vaults = getRecentVaults();
  for (const vault of vaults) {
    try {
      const st = await invoke<GitStatusLite>("git_status", { vault });
      if (!st.is_repo) {
        res.skipped++;
        continue;
      }
      if (!st.clean) {
        const stamp = new Date().toLocaleString();
        await invoke("git_commit", { vault, message: message?.trim() || `Salvar tudo — ${stamp}` });
      }
      // empurra se houver remoto (mesmo sem novo commit, pra subir pendências)
      let remote: GitRemoteLite = { has_remote: false, has_upstream: false };
      try {
        remote = await invoke<GitRemoteLite>("git_remote", { vault });
      } catch {
        /* sem remoto */
      }
      if (remote.has_remote) {
        await invoke("git_push", { vault });
        res.pushed++;
      } else if (!st.clean) {
        res.committed++;
      } else {
        res.skipped++;
      }
    } catch (e) {
      const msg = String(e);
      if (/nothing to commit/i.test(msg)) res.skipped++;
      else res.failed.push(vaultLabel(vault));
    }
  }
  return res;
}

/** (Re)inicia o agendador conforme as Configurações. Chame quando elas mudarem. */
export function syncAutoSnapshot() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const s = get(settings);
  if (!s.gitAutoSnapshot) return;
  const mins = Math.max(1, Math.round(s.gitAutoSnapshotMinutes || 10));
  timer = setInterval(runSnapshot, mins * 60 * 1000);
}
