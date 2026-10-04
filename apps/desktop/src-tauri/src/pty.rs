//! Universal terminal layer.
//!
//! Every worker — Claude Code, Codex, Agy, OpenCode, a custom CLI — is an
//! independent PTY session. The manager owns the sessions, forwards stdin,
//! streams output to the UI as base64-encoded chunks, handles resize, and
//! reports real exit codes.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub const OUTPUT_EVENT: &str = "pty://output";
pub const EXIT_EVENT: &str = "pty://exit";

#[derive(Debug, Deserialize)]
pub struct SpawnConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub rows: Option<u16>,
    #[serde(default)]
    pub cols: Option<u16>,
}

#[derive(Debug, Serialize)]
pub struct SpawnResult {
    pub id: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OutputEvent {
    pub id: String,
    /// Base64-encoded terminal bytes; JSON-safe transport for binary ANSI data.
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExitEvent {
    pub id: String,
    pub code: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub pid: Option<u32>,
}

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    pid: Option<u32>,
}

/// Owns every live PTY session. Sessions are removed by the exit watcher when
/// the child process terminates, so the map reflects live processes only.
#[derive(Default)]
pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn spawn(&self, app: AppHandle, config: SpawnConfig) -> Result<SpawnResult, String> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows: config.rows.unwrap_or(30),
            cols: config.cols.unwrap_or(120),
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("PTY allocation failed: {e}"))?;

        let mut cmd = CommandBuilder::new(resolve_command(&config.command));
        cmd.args(&config.args);
        if let Some(cwd) = config.cwd.as_deref() {
            let path = Path::new(cwd);
            if !path.is_dir() {
                return Err(format!("Working directory does not exist: {cwd}"));
            }
            cmd.cwd(path);
        }
        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn '{}': {e}", config.command))?;
        let pid = child.process_id();
        let killer = child.clone_killer();
        // Drop the slave early so EOF reaches the reader when the child exits.
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("PTY reader failed: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("PTY writer failed: {e}"))?;

        let id = Uuid::new_v4().to_string();

        // Reader thread: PTY bytes -> UI event stream.
        let output_id = id.clone();
        let output_app = app.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let event = OutputEvent {
                            id: output_id.clone(),
                            data: BASE64.encode(&buf[..n]),
                        };
                        if output_app.emit(OUTPUT_EVENT, event).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Exit watcher: report the real exit code, then drop the session.
        let sessions = Arc::clone(&self.sessions);
        let exit_id = id.clone();
        let exit_app = app.clone();
        thread::spawn(move || {
            let mut child = child;
            let code = child
                .wait()
                .map(|status| status.exit_code() as i64)
                .unwrap_or(-1);
            if let Ok(mut map) = sessions.lock() {
                map.remove(&exit_id);
            }
            let _ = exit_app.emit(EXIT_EVENT, ExitEvent { id: exit_id, code });
        });

        self.sessions
            .lock()
            .map_err(|_| "terminal state poisoned")?
            .insert(
                id.clone(),
                Session {
                    writer,
                    master: pair.master,
                    killer,
                    pid,
                },
            );

        Ok(SpawnResult { id, pid })
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut map = self.sessions.lock().map_err(|_| "terminal state poisoned")?;
        let session = map
            .get_mut(id)
            .ok_or_else(|| format!("Unknown session: {id}"))?;
        session
            .writer
            .write_all(data.as_bytes())
            .and_then(|_| session.writer.flush())
            .map_err(|e| e.to_string())
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let map = self.sessions.lock().map_err(|_| "terminal state poisoned")?;
        let session = map
            .get(id)
            .ok_or_else(|| format!("Unknown session: {id}"))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        let mut map = self.sessions.lock().map_err(|_| "terminal state poisoned")?;
        let session = map
            .get_mut(id)
            .ok_or_else(|| format!("Unknown session: {id}"))?;
        session.killer.kill().map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.sessions
            .lock()
            .map(|map| {
                map.iter()
                    .map(|(id, session)| SessionInfo {
                        id: id.clone(),
                        pid: session.pid,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// Windows `std::process::Command` does not resolve extension-less commands to
/// `.cmd`/`.bat` shims (how npm-installed CLIs like `codex` are installed), so
/// probe PATH + PATHEXT for the real executable. Other platforms resolve
/// extension-less commands through PATH themselves.
fn resolve_command(program: &str) -> String {
    #[cfg(windows)]
    {
        use std::path::Path;
        if Path::new(program).extension().is_some()
            || program.contains('/')
            || program.contains('\\')
        {
            return program.to_string();
        }
        let path_os = match std::env::var_os("PATH") {
            Some(p) => p,
            None => return program.to_string(),
        };
        let pathext =
            std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
        for dir in std::env::split_paths(&path_os) {
            for ext in pathext.split(';').filter(|e| !e.is_empty()) {
                let candidate = dir.join(format!("{program}{ext}"));
                if candidate.is_file() {
                    return candidate.to_string_lossy().into_owned();
                }
            }
        }
        program.to_string()
    }
    #[cfg(not(windows))]
    {
        program.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extensionless_commands_resolve_on_path() {
        // `cmd` always exists on Windows; on other platforms the resolver is
        // the identity function, which this also asserts.
        let resolved = resolve_command("cmd");
        #[cfg(windows)]
        assert!(resolved.to_lowercase().ends_with("cmd.exe"));
        #[cfg(not(windows))]
        assert_eq!(resolved, "cmd");
    }

    #[test]
    fn explicit_paths_pass_through_unchanged() {
        assert_eq!(resolve_command("C:/tools/my-ai.cmd"), "C:/tools/my-ai.cmd");
        assert_eq!(resolve_command("/usr/local/bin/claude"), "/usr/local/bin/claude");
    }
}
