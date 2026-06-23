// Snapshot automático do Git: salva uma versão sozinho a cada N minutos
// quando o vault é um repositório e há alterações pendentes.
import { get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { settings } from "./stores/settings";
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
