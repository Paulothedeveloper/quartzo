mod commands;

use commands::{
    build_graph_index, create_folder, create_note, daily_note, delete_to_trash, get_backlinks,
    build_query_index, copy_vault_to_cloud, create_note_full, detect_cloud_folders,
    get_unlinked_mentions, git_commit, git_init, git_log, git_status, launch_prisma, prisma_installed,
    list_css_snippets, list_tags, read_directory, read_file, read_image_base64, rename_path,
    save_canvas_image, save_memory, search_notes, start_vault_watch, toggle_task, write_file,
    WatchState,
};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatchState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            create_note,
            build_graph_index,
            save_memory,
            get_backlinks,
            start_vault_watch,
            rename_path,
            delete_to_trash,
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
            git_log,
            detect_cloud_folders,
            copy_vault_to_cloud,
            create_note_full,
            launch_prisma,
            prisma_installed
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
