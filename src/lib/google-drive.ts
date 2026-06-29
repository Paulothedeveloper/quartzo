// Sincronia com o Google Drive — lado do front.
// O comando Rust `google_drive_pick` faz o login (loopback OAuth) + Picker e devolve
// o token + a pasta escolhida. Aqui baixamos o conteúdo dessa pasta (Drive API via
// fetch) e gravamos localmente reusando os comandos existentes (ensure_dir/write_file).
// Escopo drive.file: o token só acessa o que o usuário escolheu no Picker (a pasta
// e seus descendentes).

import { invoke } from "@tauri-apps/api/core";
import { GOOGLE } from "./google-config";

export interface DrivePick {
  accessToken: string;
  folderId: string;
  folderName: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
// MIME do Google Docs nativos (não baixáveis como arquivo cru) — ignorados.
const GOOGLE_NATIVE = /application\/vnd\.google-apps\./;

/** Abre o login do Google + Picker (no navegador) e devolve token + pasta. */
export async function connectAndPick(): Promise<DrivePick> {
  return await invoke<DrivePick>("google_drive_pick", {
    clientId: GOOGLE.clientId,
    clientSecret: GOOGLE.clientSecret,
    apiKey: GOOGLE.apiKey,
    projectNumber: GOOGLE.projectNumber,
  });
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

/** Lista os filhos diretos de uma pasta do Drive (paginado). */
async function listChildren(token: string, folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType)");
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Drive list ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const f of j.files ?? []) out.push(f as DriveFile);
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

/** Baixa o conteúdo (texto) de um arquivo do Drive. */
async function downloadText(token: string, fileId: string): Promise<string> {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive get ${r.status}`);
  return await r.text();
}

export interface DownloadProgress {
  done: number;
  skippedBinary: number;
  listed: number; // total de itens que a API retornou (diagnóstico)
  folders: number;
}

/**
 * Baixa recursivamente a pasta escolhida pro caminho local `destDir`, preservando a
 * estrutura. Por enquanto baixa arquivos de TEXTO (.md e afins); binários (imagens)
 * são contados e pulados nesta primeira versão.
 */
export async function downloadFolder(
  token: string,
  folderId: string,
  destDir: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<DownloadProgress> {
  const prog: DownloadProgress = { done: 0, skippedBinary: 0, listed: 0, folders: 0 };
  const sep = destDir.includes("\\") ? "\\" : "/";

  async function walk(driveFolder: string, localDir: string) {
    await invoke("ensure_dir", { path: localDir });
    const children = await listChildren(token, driveFolder);
    for (const f of children) {
      prog.listed++;
      const childPath = `${localDir}${sep}${f.name}`;
      if (f.mimeType === FOLDER_MIME) {
        prog.folders++;
        onProgress?.(prog);
        await walk(f.id, childPath);
      } else if (GOOGLE_NATIVE.test(f.mimeType)) {
        // Google Docs/Sheets nativos não são arquivos crus — pula.
        prog.skippedBinary++;
        onProgress?.(prog);
      } else if (/\.(md|markdown|txt|json|csv|canvas)$/i.test(f.name) || f.mimeType.startsWith("text/")) {
        const content = await downloadText(token, f.id);
        await invoke("write_file", { path: childPath, content });
        prog.done++;
        onProgress?.(prog);
      } else {
        // binário (imagem/pdf…) — fica pra próxima versão (precisa gravar bytes).
        prog.skippedBinary++;
        onProgress?.(prog);
      }
    }
  }

  await walk(folderId, destDir);
  return prog;
}
