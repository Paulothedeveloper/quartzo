// Estado leve de sincronização Git do vault — alimenta o badge da TitleBar e o
// painel "Salvar na nuvem" (QuickSave). Uma única fonte pra não duplicar chamadas.
import { writable, get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { currentVaultPath } from "./vault";

export interface GitSyncState {
  isRepo: boolean;
  branch: string;
  changed: string[]; // linhas do `git status --porcelain` ("XY caminho")
  hasRemote: boolean;
  hasUpstream: boolean;
  ahead: number;
  behind: number;
}

const EMPTY: GitSyncState = {
  isRepo: false,
  branch: "",
  changed: [],
  hasRemote: false,
  hasUpstream: false,
  ahead: 0,
  behind: 0,
};

export const gitSync = writable<GitSyncState>({ ...EMPTY });

let inflight = false;

/** Relê status + remoto do vault atual e atualiza a store (no-op fora do Tauri). */
export async function refreshGitSync(): Promise<void> {
  const vault = get(currentVaultPath);
  if (!vault) {
    gitSync.set({ ...EMPTY });
    return;
  }
  if (inflight) return;
  inflight = true;
  try {
    const st = await invoke<{ is_repo: boolean; branch: string; changed: string[]; clean: boolean }>(
      "git_status",
      { vault }
    );
    let remote = { has_remote: false, url: "", has_upstream: false, ahead: 0, behind: 0 };
    if (st.is_repo) {
      try {
        remote = await invoke("git_remote", { vault });
      } catch {
        /* sem remoto */
      }
    }
    gitSync.set({
      isRepo: st.is_repo,
      branch: st.branch,
      changed: st.changed,
      hasRemote: remote.has_remote,
      hasUpstream: remote.has_upstream,
      ahead: remote.ahead,
      behind: remote.behind,
    });
  } catch {
    gitSync.set({ ...EMPTY });
  } finally {
    inflight = false;
  }
}
