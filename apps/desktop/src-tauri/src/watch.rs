//! File system watcher for `.ai-team/` subdirectories.
//!
//! Emits `team://task-changed` and `team://message-changed` events when task
//! or message JSON files are created, modified, or deleted. The frontend
//! listens to these events to refresh the task and message panels in real
//! time — including changes made by the `team` CLI from a worker terminal.

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

/// Watch one directory and emit `event_name` for every JSON file change.
fn watch_dir(app: AppHandle, dir: PathBuf, event_name: String) -> Result<(), String> {
    if !dir.exists() {
        return Err(format!("{} does not exist", dir.display()));
    }

    let (tx, mut rx) = mpsc::unbounded_channel::<Event>();

    // Background watcher task
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut watcher: RecommendedWatcher = Watcher::new(
            move |res| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("watcher init failed: {e}"))?;

        watcher
            .watch(&dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("watch failed: {e}"))?;

        // Keep the watcher alive
        loop {
            match rx.recv().await {
                Some(event) => {
                    if matches!(
                        event.kind,
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                    ) {
                        for path in event.paths {
                            if path.extension().map_or(false, |e| e == "json") {
                                let _ = app_handle.emit(event_name.as_str(), serde_json::json!({
                                    "file": path.file_name().and_then(|s| s.to_str()).unwrap_or(""),
                                }));
                            }
                        }
                    }
                }
                None => break,
            }
        }
        Ok::<_, String>(())
    });

    Ok(())
}

/// Start watching the tasks directory for the given project root.
#[tauri::command]
pub fn watch_tasks(app: AppHandle, root: String) -> Result<(), String> {
    let dir = Path::new(&root).join(".ai-team").join("tasks");
    watch_dir(app, dir, "team://task-changed".to_string())
}

/// Start watching the messages directory for the given project root.
#[tauri::command]
pub fn watch_messages(app: AppHandle, root: String) -> Result<(), String> {
    let dir = Path::new(&root).join(".ai-team").join("messages");
    watch_dir(app, dir, "team://message-changed".to_string())
}
