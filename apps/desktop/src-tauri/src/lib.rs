//! Nova — AI Dev Team Orchestrator.
//!
//! One command center, N real terminal workers. The Rust core owns three
//! concerns: the PTY terminal manager, `.ai-team` project state, and the
//! native folder picker.

mod project;
mod pty;
mod watch;

use pty::{SpawnConfig, SpawnResult, SessionInfo, TerminalManager};
use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// Open the native folder picker and return the chosen project directory.
#[tauri::command]
async fn pick_project_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let path = picked
        .and_then(|entry| entry.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
        .filter(|path| !path.is_empty());
    Ok(path)
}

// ---------------------------------------------------------------------------
// Project state (.ai-team)
// ---------------------------------------------------------------------------

#[tauri::command]
fn project_init(root: String, name: String) -> Result<Value, String> {
    project::init(&root, &name)
}

#[tauri::command]
fn project_load(root: String) -> Result<Value, String> {
    project::load(&root)
}

#[tauri::command]
fn project_save(root: String, state: Value) -> Result<(), String> {
    project::save(&root, state)
}

#[tauri::command]
fn project_tasks(root: String) -> Result<Vec<Value>, String> {
    project::list_tasks(&root)
}

#[tauri::command]
fn project_messages(root: String) -> Result<Vec<Value>, String> {
    project::list_messages(&root)
}

/// Send a team-protocol message (spec §14) — used by the Command Center
/// reply composer; `replyTo` marks the original message read.
#[tauri::command]
fn messages_send(root: String, message: Value) -> Result<Value, String> {
    project::send_message(&root, &message)
}

#[tauri::command]
fn events_append(root: String, event: Value) -> Result<(), String> {
    project::append_event(&root, &event)
}

#[tauri::command]
fn events_recent(root: String, limit: Option<usize>) -> Result<Vec<Value>, String> {
    project::recent_events(&root, limit.unwrap_or(200))
}

// ---------------------------------------------------------------------------
// Universal terminal layer
// ---------------------------------------------------------------------------

#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    manager: State<'_, TerminalManager>,
    config: SpawnConfig,
) -> Result<SpawnResult, String> {
    manager.spawn(app, config)
}

#[tauri::command]
fn pty_write(manager: State<'_, TerminalManager>, id: String, data: String) -> Result<(), String> {
    manager.write(&id, &data)
}

#[tauri::command]
fn pty_resize(manager: State<'_, TerminalManager>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    manager.resize(&id, rows, cols)
}

#[tauri::command]
fn pty_kill(manager: State<'_, TerminalManager>, id: String) -> Result<(), String> {
    manager.kill(&id)
}

#[tauri::command]
fn pty_list(manager: State<'_, TerminalManager>) -> Vec<SessionInfo> {
    manager.list()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TerminalManager::new())
        .invoke_handler(tauri::generate_handler![
            pick_project_folder,
            project_init,
            project_load,
            project_save,
            project_tasks,
            project_messages,
            messages_send,
            events_append,
            events_recent,
            watch_tasks,
            watch_messages,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            pty_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
