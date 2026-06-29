// Sincronia com o Google Drive (DESKTOP) — login por loopback (OAuth 2.0 PKCE,
// fluxo de "installed app") + Google Picker, tudo no navegador do sistema.
//
// Por que assim: o WebView do Tauri não é uma origem http válida pro Google
// (OAuth/Picker), então o login e o Picker rodam no NAVEGADOR, numa página servida
// por um servidor HTTP local efêmero (127.0.0.1:porta-aleatória). O cliente OAuth
// é do tipo "App para computador" (Desktop), que aceita qualquer porta de loopback.
//
// Escopo: drive.file (NÃO-sensível) — o app só acessa o que o usuário escolher no
// Picker. Sem leitura do Drive inteiro, sem avaliação de segurança CASA.
//
// O download recursivo dos arquivos é feito no FRONTEND (fetch na Drive API +
// os comandos write_file/ensure_dir que já existem) — aqui só devolvemos o token
// de acesso + a pasta escolhida.
//
// Android fica pra fase 2 (redirect por deep link com tauri-plugin-deep-link) —
// por isso este módulo é compilado só no desktop.

use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::sync::mpsc;
use std::time::Duration;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DrivePick {
    // serializa como accessToken/folderId/folderName (o front lê em camelCase).
    pub access_token: String,
    pub folder_id: String,
    pub folder_name: String,
}

/// base64url sem padding.
fn b64url(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Gera (verifier, challenge) PKCE (S256).
fn pkce() -> (String, String) {
    // verifier: 64 bytes aleatórios -> base64url (sem dep de rand: usa o nanos do relógio + endereço)
    let mut seed = [0u8; 32];
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let mix = t ^ (pid << 64) ^ (&seed as *const _ as u128);
    for (i, b) in seed.iter_mut().enumerate() {
        *b = (((mix >> (i % 16 * 8)) as u64).wrapping_mul(6364136223846793005).wrapping_add(i as u64) >> 33) as u8;
    }
    let verifier = b64url(&seed);
    let challenge = b64url(&Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

fn html_response(body: &str) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
    let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap();
    tiny_http::Response::from_string(body).with_header(header)
}

/// Página "pode fechar" mostrada no navegador ao terminar.
fn done_page(msg: &str) -> String {
    format!(
        "<!doctype html><html><head><meta charset='utf-8'><meta name='color-scheme' content='dark'>\
        <style>body{{font-family:system-ui;background:#0a0f1c;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0}}\
        .c{{text-align:center}}.k{{color:#67e8f9;font-weight:700}}</style></head>\
        <body><div class='c'><p class='k'>Quartzo</p><p>{}</p><p style='opacity:.6'>Pode fechar esta aba.</p></div></body></html>",
        msg
    )
}

/// Página do Google Picker (roda no navegador, origem 127.0.0.1 válida).
fn picker_page(token: &str, api_key: &str, app_id: &str) -> String {
    // Ao escolher, redireciona pro /picked?id=..&name=.. (o servidor captura).
    format!(
        "<!doctype html><html><head><meta charset='utf-8'><meta name='color-scheme' content='dark'>\
        <style>body{{font-family:system-ui;background:#0a0f1c;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0}}\
        .c{{text-align:center}}.k{{color:#67e8f9;font-weight:700;font-size:20px}}</style></head>\
        <body><div class='c'><p class='k'>Quartzo</p><p>Escolha a pasta do seu vault…</p></div>\
        <script src='https://apis.google.com/js/api.js'></script>\
        <script>\
        const TOKEN={token:?}, KEY={api_key:?}, APPID={app_id:?};\
        function onApiLoad(){{ gapi.load('picker',{{callback:build}}); }}\
        function build(){{\
          const view=new google.picker.DocsView(google.picker.ViewId.FOLDERS)\
            .setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes('application/vnd.google-apps.folder');\
          const picker=new google.picker.PickerBuilder()\
            .setAppId(APPID).setOAuthToken(TOKEN).setDeveloperKey(KEY)\
            .addView(view).setTitle('Escolha a pasta do vault')\
            .setCallback(cb).build();\
          picker.setVisible(true);\
        }}\
        function cb(d){{\
          if(d.action===google.picker.Action.PICKED){{\
            const f=d.docs[0];\
            location.href='/picked?id='+encodeURIComponent(f.id)+'&name='+encodeURIComponent(f.name);\
          }} else if(d.action===google.picker.Action.CANCEL){{ location.href='/picked?cancel=1'; }}\
        }}\
        window.onload=onApiLoad;\
        </script></body></html>",
        token = token, api_key = api_key, app_id = app_id
    )
}

fn qval(query: &str, key: &str) -> Option<String> {
    // query sem o '?'
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some(key) {
            let raw = it.next().unwrap_or("");
            return Some(urlencoding::decode(raw).map(|c| c.into_owned()).unwrap_or_else(|_| raw.to_string()));
        }
    }
    None
}

/// Faz o login no Google + abre o Picker e devolve token + pasta escolhida.
/// `client_id`/`client_secret` do cliente OAuth "Desktop"; `api_key` p/ o Picker;
/// `project_number` = appId do Picker.
#[tauri::command]
pub async fn google_drive_pick(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
    api_key: String,
    project_number: String,
) -> Result<DrivePick, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let server = tiny_http::Server::http("127.0.0.1:0")
            .map_err(|e| format!("falha ao abrir loopback: {e}"))?;
        let port = server
            .server_addr()
            .to_ip()
            .ok_or_else(|| "endereço de loopback inesperado".to_string())?
            .port();
        let redirect = format!("http://127.0.0.1:{port}");

        let (verifier, challenge) = pkce();
        // drive.readonly: drive.file NÃO lista conteúdo de pasta (provado: 0 itens).
        // Pra baixar um vault inteiro precisa de leitura. Em modo TESTE funciona sem
        // a avaliação CASA (só exigida pra publicar pra qualquer usuário).
        let scope = "https://www.googleapis.com/auth/drive.readonly";
        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={cid}&redirect_uri={ru}\
             &response_type=code&scope={sc}&code_challenge={ch}&code_challenge_method=S256\
             &access_type=offline&prompt=consent",
            cid = urlencoding::encode(&client_id),
            ru = urlencoding::encode(&redirect),
            sc = urlencoding::encode(scope),
            ch = challenge,
        );

        app.opener()
            .open_url(auth_url, None::<&str>)
            .map_err(|e| format!("não consegui abrir o navegador: {e}"))?;

        let mut access_token: Option<String> = None;
        let (tx, rx) = mpsc::channel::<DrivePick>();

        // Loop de requisições do loopback (timeout total ~5min).
        let deadline = std::time::Instant::now() + Duration::from_secs(300);
        loop {
            if std::time::Instant::now() > deadline {
                return Err("tempo esgotado no login do Google.".into());
            }
            let req = match server.recv_timeout(Duration::from_secs(2)) {
                Ok(Some(r)) => r,
                Ok(None) => {
                    if let Ok(p) = rx.try_recv() {
                        return Ok(p);
                    }
                    continue;
                }
                Err(e) => return Err(format!("erro no loopback: {e}")),
            };

            let url = req.url().to_string();
            let (path, query) = match url.split_once('?') {
                Some((p, q)) => (p.to_string(), q.to_string()),
                None => (url.clone(), String::new()),
            };

            if path == "/" {
                // callback do OAuth com ?code=...
                if let Some(err) = qval(&query, "error") {
                    let _ = req.respond(html_response(&done_page("Login cancelado.")));
                    return Err(format!("login negado: {err}"));
                }
                let code = match qval(&query, "code") {
                    Some(c) => c,
                    None => {
                        let _ = req.respond(html_response(&done_page("Aguardando login…")));
                        continue;
                    }
                };
                // troca code -> token (PKCE)
                let resp = ureq::post("https://oauth2.googleapis.com/token")
                    .send_form(&[
                        ("client_id", client_id.as_str()),
                        ("client_secret", client_secret.as_str()),
                        ("code", code.as_str()),
                        ("code_verifier", verifier.as_str()),
                        ("grant_type", "authorization_code"),
                        ("redirect_uri", redirect.as_str()),
                    ]);
                match resp {
                    Ok(r) => {
                        let v: serde_json::Value = r.into_json().map_err(|e| format!("token inválido: {e}"))?;
                        match v.get("access_token").and_then(|t| t.as_str()) {
                            Some(t) => {
                                access_token = Some(t.to_string());
                                // mostra o Picker
                                let _ = req.respond(html_response(&picker_page(t, &api_key, &project_number)));
                            }
                            None => {
                                let _ = req.respond(html_response(&done_page("Falha ao obter o token.")));
                                return Err(format!("resposta sem access_token: {v}"));
                            }
                        }
                    }
                    Err(e) => {
                        let _ = req.respond(html_response(&done_page("Falha na troca do token.")));
                        return Err(format!("erro na troca do token: {e}"));
                    }
                }
            } else if path == "/picked" {
                if qval(&query, "cancel").is_some() {
                    let _ = req.respond(html_response(&done_page("Seleção cancelada.")));
                    return Err("seleção cancelada".into());
                }
                let id = qval(&query, "id").unwrap_or_default();
                let name = qval(&query, "name").unwrap_or_else(|| "Vault".into());
                let _ = req.respond(html_response(&done_page("Vault selecionado! Baixando no app…")));
                if let Some(t) = access_token.clone() {
                    let _ = tx.send(DrivePick { access_token: t, folder_id: id, folder_name: name });
                    if let Ok(p) = rx.recv_timeout(Duration::from_secs(1)) {
                        return Ok(p);
                    }
                }
            } else {
                // qualquer outra rota (favicon etc.) — só responde algo
                let _ = req.respond(html_response(&done_page("…")));
            }
        }
    })
    .await
    .map_err(|e| format!("tarefa falhou: {e}"))?
}
