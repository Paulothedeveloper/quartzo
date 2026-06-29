mod commands;
mod docx;
#[cfg(desktop)]
mod google_drive;

#[cfg(desktop)]
use google_drive::google_drive_pick;

// Stub no mobile: o fluxo de loopback OAuth é desktop por enquanto (Android = deep
// link, fase 2). Mantém o nome do comando pro invoke_handler resolver nas 2 builds.
#[cfg(not(desktop))]
#[tauri::command]
async fn google_drive_pick(
    _client_id: String,
    _client_secret: String,
    _api_key: String,
    _project_number: String,
) -> Result<(), String> {
    Err("Sincronia com o Drive: disponível no desktop por enquanto.".into())
}

use commands::{
    build_graph_index, build_alias_index, create_folder, create_note, daily_note, delete_to_trash, get_backlinks,
    build_query_index, copy_vault_to_cloud, create_note_full, detect_cloud_folders,
    get_unlinked_mentions, git_commit, git_commit_files, git_diff, git_init, git_log, git_pull, git_push, git_remote, rename_note, link_mention,
    find_duplicate_notes, vault_insights, load_bases, save_bases, export_docx,
    scan_for_file, import_attachment, ensure_dir,
    git_status, launch_prisma, prisma_installed, prisma_db_present, prisma_search_assets,
    ffmpeg_available, make_video_proxy,
    list_css_snippets, list_tags, read_directory, read_file, read_image_base64, rename_path,
    save_canvas_image, save_memory, search_notes, start_vault_watch, toggle_task, write_file,
    WatchState,
};
use std::sync::Mutex;
#[cfg(desktop)]
use tauri::{Emitter, Manager};

/// Trata um quartzo://note/<caminho-relativo> — foca a janela e manda o front abrir a nota.
/// Só desktop: usa métodos de janela (unminimize/set_focus) que não existem no mobile.
#[cfg(desktop)]
fn handle_deeplink(app: &tauri::AppHandle, url: &str) {
    if let Some(rest) = url.strip_prefix("quartzo://note/") {
        // tira query/fragmento e decodifica %20 etc.
        let raw = rest.split(['?', '#']).next().unwrap_or("").trim();
        let decoded = percent_decode(raw);
        if !decoded.is_empty() {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("deeplink:open-note", decoded);
        }
    }
}

/// Decodificação simples de percent-encoding (sem dependências extras).
#[cfg(desktop)]
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h = (bytes[i + 1] as char).to_digit(16);
            let l = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (h, l) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // single-instance é SÓ desktop: se já há um Quartzo aberto e clicam um
    // quartzo://, o SO chama isto na instância existente (em vez de abrir outra).
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
        for arg in &argv {
            if arg.starts_with("quartzo://") {
                handle_deeplink(app, arg);
            }
        }
    }));

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        handle_deeplink(&handle, url.as_str());
                    }
                });
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    let handle = app.handle().clone();
                    let urls: Vec<String> = urls.iter().map(|u| u.as_str().to_string()).collect();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        for u in urls {
                            handle_deeplink(&handle, &u);
                        }
                    });
                }
            }
            Ok(())
        })
        .manage(WatchState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            create_note,
            build_graph_index,
            build_alias_index,
            save_memory,
            get_backlinks,
            start_vault_watch,
            rename_path,
            rename_note,
            link_mention,
            scan_for_file,
            import_attachment,
            delete_to_trash,
            ensure_dir,
            search_notes,
            create_folder,
            list_tags,
            daily_note,
            get_unlinked_mentions,
            list_css_snippets,
            build_query_index,
            toggle_task,
            read_image_base64,
            save_canvas_image,
            git_status,
            git_init,
            git_commit,
            git_commit_files,
            git_log,
            git_diff,
            git_remote,
            git_push,
            git_pull,
            detect_cloud_folders,
            copy_vault_to_cloud,
            create_note_full,
            launch_prisma,
            prisma_installed,
            prisma_db_present,
            prisma_search_assets,
            ffmpeg_available,
            make_video_proxy,
            find_duplicate_notes,
            vault_insights,
            load_bases,
            save_bases,
            export_docx,
            google_drive_pick
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
