/**
 * Typed IPC boundary to the Rust core.
 * All terminal bytes cross as base64 so binary ANSI sequences survive JSON.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { RawJson } from "./types";

/** Start watching the .ai-team/tasks directory for external changes. */
export const watchTasks = (root: string): Promise<void> =>
  invoke("watch_tasks", { root });

export interface SpawnConfig {
  command: string;
  args: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  rows?: number;
  cols?: number;
}

export interface SpawnResult {
  id: string;
  pid: number | null;
}

export interface OutputPayload {
  id: string;
  data: string;
}

export interface ExitPayload {
  id: string;
  code: number;
}

export const pickProjectFolder = (): Promise<string | null> =>
  invoke<string | null>("pick_project_folder");

export const projectInit = (root: string, name: string): Promise<RawJson> =>
  invoke("project_init", { root, name });

export const projectLoad = (root: string): Promise<RawJson> =>
  invoke("project_load", { root });

export const projectSave = (root: string, state: unknown): Promise<void> =>
  invoke("project_save", { root, state });

export const projectTasks = (root: string): Promise<RawJson[]> =>
  invoke("project_tasks", { root });

export const projectMessages = (root: string): Promise<RawJson[]> =>
  invoke("project_messages", { root });

/**
 * Send a team-protocol message (spec §14). The payload carries the semantic
 * fields; Rust generates a missing `id` and marks `replyTo` read.
 */
export const messagesSend = (root: string, message: RawJson): Promise<RawJson> =>
  invoke("messages_send", { root, message });

export const eventsAppend = (root: string, event: RawJson): Promise<void> =>
  invoke("events_append", { root, event });

export const eventsRecent = (root: string, limit?: number): Promise<RawJson[]> =>
  invoke("events_recent", { root, limit });

export const ptySpawn = (config: SpawnConfig): Promise<SpawnResult> =>
  invoke("pty_spawn", { config });

export const ptyWrite = (id: string, data: string): Promise<void> =>
  invoke("pty_write", { id, data });

export const ptyResize = (id: string, rows: number, cols: number): Promise<void> =>
  invoke("pty_resize", { id, rows, cols });

export const ptyKill = (id: string): Promise<void> => invoke("pty_kill", { id });

export const ptyList = (): Promise<{ id: string; pid: number | null }[]> =>
  invoke("pty_list");

export const listenPtyOutput = (
  handler: (payload: OutputPayload) => void,
): Promise<() => void> => listen<OutputPayload>("pty://output", (e) => handler(e.payload));

export const listenPtyExit = (
  handler: (payload: ExitPayload) => void,
): Promise<() => void> => listen<ExitPayload>("pty://exit", (e) => handler(e.payload));

/** Listen for external task changes (e.g., from the `team` CLI). */
export const listenTaskChanged = (
  handler: (payload: { file: string }) => void,
): Promise<() => void> =>
  listen<{ file: string }>("team://task-changed", (e) => handler(e.payload));

/** Start watching the .ai-team/messages directory for external changes. */
export const watchMessages = (root: string): Promise<void> =>
  invoke("watch_messages", { root });

/** Listen for external message changes (e.g., from the `team` CLI). */
export const listenMessageChanged = (
  handler: (payload: { file: string }) => void,
): Promise<() => void> =>
  listen<{ file: string }>("team://message-changed", (e) => handler(e.payload));

/** Decode base64 PTY bytes into a Uint8Array for xterm.write(). */
export const decodeBase64 = (data: string): Uint8Array => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};
