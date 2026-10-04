//! `.ai-team` project state — the shared, human-readable protocol directory.
//!
//! Layout (per the product spec):
//!
//! ```text
//! .ai-team/
//! ├── state.json        orchestrator state (workers, objective, lead)
//! ├── objective.md      the giant project prompt
//! ├── architecture.md   shared architecture notes
//! ├── rules.md          rules every worker must follow
//! ├── tasks/            one JSON file per task
//! ├── messages/         worker-to-worker messages
//! ├── contracts/        shared public interfaces
//! ├── decisions/        durable decision records
//! ├── events/           log.jsonl activity history
//! └── worker-config/    per-worker configuration
//! ```

use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const TEAM_DIR: &str = ".ai-team";
pub const STATE_FILE: &str = "state.json";
pub const EVENTS_FILE: &str = "log.jsonl";

fn team_path(root: &str) -> PathBuf {
    Path::new(root).join(TEAM_DIR)
}

pub fn is_initialized(root: &str) -> bool {
    team_path(root).join(STATE_FILE).is_file()
}

/// Create the protocol directory structure and default state. Idempotent:
/// existing files are preserved so reopening a project never clobbers state.
pub fn init(root: &str, project_name: &str) -> Result<Value, String> {
    let team = team_path(root);
    for dir in ["tasks", "messages", "contracts", "decisions", "events", "worker-config"] {
        fs::create_dir_all(team.join(dir)).map_err(|e| e.to_string())?;
    }

    if !is_initialized(root) {
        let state = json!({
            "version": 1,
            "project": { "name": project_name, "path": root },
            "objective": "",
            "leadId": Value::Null,
            "workers": []
        });
        write_json(&team.join(STATE_FILE), &state)?;

        write_if_missing(
            &team.join("objective.md"),
            "# Project Objective\n\n(one gigantic project prompt — the shared goal for the team)\n",
        )?;
        write_if_missing(
            &team.join("architecture.md"),
            "# Architecture\n\n(shared architecture notes live here)\n",
        )?;
        write_if_missing(
            &team.join("rules.md"),
            "# Project Rules\n\n- (rules every team member must follow)\n",
        )?;
        write_if_missing(&team.join("events").join(EVENTS_FILE), "")?;
    }

    load(root)
}

pub fn load(root: &str) -> Result<Value, String> {
    let path = team_path(root).join(STATE_FILE);
    let raw = fs::read_to_string(&path).map_err(|_| "NOT_INITIALIZED".to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Corrupt project state: {e}"))
}

pub fn save(root: &str, state: Value) -> Result<(), String> {
    write_json(&team_path(root).join(STATE_FILE), &state)
}

/// Read every `tasks/*.json` file. Missing directory or malformed files are
/// tolerated: the task panel degrades gracefully instead of failing.
pub fn list_tasks(root: &str) -> Result<Vec<Value>, String> {
    let dir = team_path(root).join("tasks");
    let mut paths: Vec<PathBuf> = match fs::read_dir(&dir) {
        Ok(entries) => entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().map(|ext| ext == "json").unwrap_or(false))
            .collect(),
        Err(_) => return Ok(Vec::new()),
    };
    paths.sort();
    let mut tasks = Vec::new();
    for path in paths {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                tasks.push(value);
            }
        }
    }
    Ok(tasks)
}

/// Read every `messages/*.json` file, newest first (sorted by `createdAt`).
/// Missing directory or malformed files are tolerated, like tasks.
pub fn list_messages(root: &str) -> Result<Vec<Value>, String> {
    let dir = team_path(root).join("messages");
    let mut paths: Vec<PathBuf> = match fs::read_dir(&dir) {
        Ok(entries) => entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().map(|ext| ext == "json").unwrap_or(false))
            .collect(),
        Err(_) => return Ok(Vec::new()),
    };
    paths.sort();
    let mut messages = Vec::new();
    for path in paths {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                messages.push(value);
            }
        }
    }
    messages.sort_by(|a, b| {
        let at = a.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
        let bt = b.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
        bt.cmp(at)
    });
    Ok(messages)
}

/// Write a new team-protocol message file (spec §14).
///
/// The caller supplies the semantic fields (`from`, `to`, `type`, `subject`,
/// `body`, `taskId`, `replyTo`, `createdAt`); a missing `id` is generated
/// here so every surface writes the same `msg_xxxxxxxx` shape. When `replyTo`
/// names an existing message it is marked read — replying means the human
/// has read it.
pub fn send_message(root: &str, message: &Value) -> Result<Value, String> {
    if !message.is_object() {
        return Err("Message must be a JSON object".to_string());
    }
    let from = message
        .get("from")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if from.is_empty() {
        return Err("Message requires a sender (from)".to_string());
    }
    let body = message.get("body").and_then(|v| v.as_str()).unwrap_or("");
    if body.trim().is_empty() {
        return Err("Message body is required".to_string());
    }
    let created_at = message
        .get("createdAt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if created_at.is_empty() {
        return Err("Message requires createdAt".to_string());
    }

    let mut msg = message.clone();
    let id = msg
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("msg_{}", &uuid::Uuid::new_v4().simple().to_string()[..8]));
    msg["id"] = Value::String(id.clone());
    if msg.get("status").map_or(true, |v| v.is_null()) {
        msg["status"] = Value::String("unread".to_string());
    }

    let dir = team_path(root).join("messages");
    write_json(&dir.join(format!("{id}.json")), &msg)?;

    // Replying marks the original as read: the human has clearly seen it.
    if let Some(reply_to) = msg.get("replyTo").and_then(|v| v.as_str()) {
        let original_path = dir.join(format!("{reply_to}.json"));
        if let Ok(raw) = fs::read_to_string(&original_path) {
            if let Ok(mut original) = serde_json::from_str::<Value>(&raw) {
                original["status"] = Value::String("read".to_string());
                let _ = write_json(&original_path, &original);
            }
        }
    }

    Ok(msg)
}

pub fn append_event(root: &str, event: &Value) -> Result<(), String> {
    let path = team_path(root).join("events").join(EVENTS_FILE);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    let line = serde_json::to_string(event).map_err(|e| e.to_string())?;
    writeln!(file, "{line}").map_err(|e| e.to_string())
}

/// Return the most recent events, oldest first.
pub fn recent_events(root: &str, limit: usize) -> Result<Vec<Value>, String> {
    let path = team_path(root).join("events").join(EVENTS_FILE);
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => return Ok(Vec::new()),
    };
    let mut events: Vec<Value> = raw
        .lines()
        .rev()
        .take(limit)
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    events.reverse();
    Ok(events)
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, body).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn write_if_missing(path: &Path, content: &str) -> Result<(), String> {
    if !path.exists() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(path, content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_root(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("nova-team-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn init_creates_state_and_is_idempotent() {
        let root = temp_root("init");
        let first = init(root.to_str().unwrap(), "demo").unwrap();
        assert_eq!(first["project"]["name"], "demo");
        assert!(is_initialized(root.to_str().unwrap()));
        assert!(root.join(TEAM_DIR).join("objective.md").is_file());
        assert!(root.join(TEAM_DIR).join("worker-config").is_dir());

        // A saved objective survives re-init.
        let mut state = first.clone();
        state["objective"] = json!("Build a warranty platform");
        save(root.to_str().unwrap(), state).unwrap();
        init(root.to_str().unwrap(), "demo").unwrap();
        let reloaded = load(root.to_str().unwrap()).unwrap();
        assert_eq!(reloaded["objective"], "Build a warranty platform");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn load_reports_missing_state() {
        let root = temp_root("missing");
        let err = load(root.to_str().unwrap()).unwrap_err();
        assert_eq!(err, "NOT_INITIALIZED");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn events_append_and_recent_roundtrip() {
        let root = temp_root("events");
        let dir = root.to_str().unwrap().to_string();
        for i in 0..5 {
            append_event(&dir, &json!({ "id": i, "type": "TEST" })).unwrap();
        }
        let recent = recent_events(&dir, 3).unwrap();
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0]["id"], 2);
        assert_eq!(recent[2]["id"], 4);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn tasks_listing_is_sorted_and_tolerant() {
        let root = temp_root("tasks");
        let dir = root.to_str().unwrap().to_string();
        let tasks_dir = root.join(TEAM_DIR).join("tasks");
        fs::create_dir_all(&tasks_dir).unwrap();
        fs::write(tasks_dir.join("02-b.json"), json!({ "id": "b", "title": "B" }).to_string()).unwrap();
        fs::write(tasks_dir.join("01-a.json"), json!({ "id": "a", "title": "A" }).to_string()).unwrap();
        fs::write(tasks_dir.join("broken.json"), "not json").unwrap();

        let tasks = list_tasks(&dir).unwrap();
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0]["id"], "a");
        assert_eq!(tasks[1]["id"], "b");

        // No tasks directory at all is not an error.
        let empty = temp_root("tasks-empty");
        assert!(list_tasks(empty.to_str().unwrap()).unwrap().is_empty());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&empty);
    }

    #[test]
    fn messages_listing_is_newest_first_and_tolerant() {
        let root = temp_root("messages");
        let dir = root.to_str().unwrap().to_string();
        let messages_dir = root.join(TEAM_DIR).join("messages");
        fs::create_dir_all(&messages_dir).unwrap();
        fs::write(
            messages_dir.join("a.json"),
            serde_json::json!({ "id": "a", "createdAt": "2026-01-01T00:00:00Z" }).to_string(),
        )
        .unwrap();
        fs::write(
            messages_dir.join("b.json"),
            serde_json::json!({ "id": "b", "createdAt": "2026-02-01T00:00:00Z" }).to_string(),
        )
        .unwrap();
        fs::write(messages_dir.join("broken.json"), "not json").unwrap();

        let messages = list_messages(&dir).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["id"], "b");
        assert_eq!(messages[1]["id"], "a");

        // No messages directory at all is not an error.
        let empty = temp_root("messages-empty");
        assert!(list_messages(empty.to_str().unwrap()).unwrap().is_empty());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&empty);
    }

    #[test]
    fn send_message_writes_file_and_marks_reply_read() {
        let root = temp_root("send-msg");
        let dir = root.to_str().unwrap().to_string();
        let messages_dir = root.join(TEAM_DIR).join("messages");
        fs::create_dir_all(&messages_dir).unwrap();
        fs::write(
            messages_dir.join("msg_orig001.json"),
            json!({
                "id": "msg_orig001",
                "from": "codex-ui",
                "to": "lead",
                "type": "question",
                "body": "What is the auth schema?",
                "status": "unread"
            })
            .to_string(),
        )
        .unwrap();

        let sent = send_message(
            &dir,
            &json!({
                "from": "lead",
                "to": "codex-ui",
                "type": "answer",
                "subject": "",
                "body": "POST /login returns { token }",
                "createdAt": "2026-10-03T10:00:00Z",
                "replyTo": "msg_orig001"
            }),
        )
        .unwrap();

        assert!(sent["id"].as_str().unwrap().starts_with("msg_"));
        assert_eq!(sent["from"], "lead");
        assert_eq!(sent["status"], "unread");
        assert!(messages_dir
            .join(format!("{}.json", sent["id"].as_str().unwrap()))
            .is_file());

        // The replied-to message flipped to read.
        let raw = fs::read_to_string(messages_dir.join("msg_orig001.json")).unwrap();
        let original: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(original["status"], "read");

        // Validation: missing sender or body is rejected.
        let no_sender = send_message(
            &dir,
            &json!({ "body": "hi", "createdAt": "2026-10-03T10:00:00Z" }),
        )
        .unwrap_err();
        assert!(no_sender.contains("sender"));
        let no_body = send_message(
            &dir,
            &json!({ "from": "lead", "createdAt": "2026-10-03T10:00:00Z" }),
        )
        .unwrap_err();
        assert!(no_body.contains("body"));

        let _ = fs::remove_dir_all(&root);
    }
}
