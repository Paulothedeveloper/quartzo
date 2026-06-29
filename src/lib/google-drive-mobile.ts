// Sincronia com o Google Drive — fluxo MOBILE (Android).
//
// No Android não dá pra usar loopback (como no desktop). O OAuth é por DEEP LINK:
// abrimos o login no navegador do sistema (Custom Tab) e o Google redireciona de
// volta pro app via o scheme reverso do Client ID Android
// (com.googleusercontent.apps.<id>:/oauth2redirect). O Rust captura esse redirect e
// emite o evento `oauth-redirect` (ver lib.rs, bloco #[cfg(mobile)]).
//
// Client Android NÃO tem secret — a segurança é o PKCE (code_verifier/challenge).
// Escopo: drive.readonly (lê/baixa; é restrito → em modo teste mostra "app não
// verificado", o test user passa em Avançado → Acessar).

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { GOOGLE } from "./google-config";
import { downloadFolder, type DownloadProgress } from "./google-drive";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveVault {
  id: string;
  name: string;
}

/** Scheme reverso do Client ID Android → redirect_uri do deep link. */
function redirectUri(): string {
  const id = GOOGLE.androidClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${id}:/oauth2redirect`;
}

// ---- PKCE (Web Crypto) ----
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(len = 64): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64url(a).slice(0, len);
}
async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

/**
 * Faz o login Google no navegador e espera o redirect voltar pro app (deep link).
 * Devolve o access_token. Rejeita em ~3min se o usuário não concluir.
 */
async function authorize(): Promise<string> {
  if (!GOOGLE.androidClientId) {
    throw new Error("Falta o Client ID Android (google-config.ts).");
  }
  const verifier = randomString(64);
  const state = randomString(24);
  const redirect = redirectUri();

  const url =
    `${AUTH_URL}?client_id=${encodeURIComponent(GOOGLE.androidClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&code_challenge=${await challenge(verifier)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=consent`;

  // Espera o redirect (evento do Rust) ANTES de abrir o navegador.
  const code: string = await new Promise(async (resolve, reject) => {
    let unlisten: (() => void) | null = null;
    const timer = setTimeout(() => {
      unlisten?.();
      reject(new Error("Tempo esgotado no login do Google."));
    }, 180_000);

    unlisten = await listen<string>("oauth-redirect", (e) => {
      try {
        const u = new URL(e.payload);
        const err = u.searchParams.get("error");
        if (err) throw new Error(`Google: ${err}`);
        if (u.searchParams.get("state") !== state) return; // não é o nosso
        const c = u.searchParams.get("code");
        if (!c) throw new Error("Redirect sem 'code'.");
        clearTimeout(timer);
        unlisten?.();
        resolve(c);
      } catch (ex) {
        clearTimeout(timer);
        unlisten?.();
        reject(ex as Error);
      }
    });

    await openUrl(url);
  });

  // Troca o code por token (PKCE, sem secret).
  const body = new URLSearchParams({
    client_id: GOOGLE.androidClientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Troca de token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("Token vazio.");
  return j.access_token as string;
}

/** Lista subpastas de um pai (pra escolher o vault). */
async function listFolders(token: string, parentId: string): Promise<DriveVault[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=name`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive list ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.files ?? []).map((f: any) => ({ id: f.id, name: f.name }));
}

export interface DriveSession {
  token: string;
  vaults: DriveVault[]; // subpastas da pasta VAULTS (cada uma é um vault)
}

/**
 * Login + acha a pasta "VAULTS" no Drive e lista os vaults dentro dela.
 * Se não houver "VAULTS", cai pras pastas da raiz do Drive.
 */
export async function connectAndListVaults(): Promise<DriveSession> {
  const token = await authorize();

  // Procura uma pasta chamada VAULTS (case-insensitive não dá na query; tenta exato).
  const q = encodeURIComponent(
    `name='VAULTS' and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent("files(id,name)")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Drive busca ${r.status}: ${await r.text()}`);
  const found = (await r.json()).files ?? [];

  const parent = found[0]?.id ?? "root";
  const vaults = await listFolders(token, parent);
  return { token, vaults };
}

/** Baixa um vault escolhido pro caminho local. Reusa o downloadFolder do desktop. */
export async function downloadVault(
  token: string,
  vaultId: string,
  destDir: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<DownloadProgress> {
  await invoke("ensure_dir", { path: destDir });
  return await downloadFolder(token, vaultId, destDir, onProgress);
}
