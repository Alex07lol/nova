/** Shared domain types for the AI Dev Team Orchestrator. */

export type WorkerStatus =
  | "starting"
  | "idle"
  | "working"
  | "waiting"
  | "blocked"
  | "review"
  | "error"
  | "stopped"
  | "finished";

export interface Worker {
  id: string;
  name: string;
  role: string;
  command: string;
  args: string[];
  /** Working directory; falls back to the project root. */
  cwd: string | null;
  capabilities: string[];
  autoStart: boolean;
  isLead: boolean;
  status: WorkerStatus;
  /** Live PTY session id; null when the worker is not running. */
  sessionId: string | null;
  pid: number | null;
  exitCode: number | null;
  createdAt: string;
}

export interface WorkerDraft {
  name: string;
  role: string;
  command: string;
  args: string[];
  cwd: string | null;
  capabilities: string[];
  autoStart: boolean;
  isLead: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  dependencies: string[];
}

export interface ActivityEvent {
  id: string;
  type: string;
  actor: string;
  summary: string;
  timestamp: string;
}

/** A team-protocol message from `.ai-team/messages/*.json` (spec §14). */
export interface TeamMessage {
  id: string;
  from: string;
  to: string | null;
  type: string;
  subject: string;
  body: string;
  taskId: string | null;
  createdAt: string;
  status: string;
  /** Id of the message this one replies to (threading, spec §14). */
  replyTo: string | null;
}

export interface ProjectState {
  version: number;
  project: { name: string; path: string };
  objective: string;
  leadId: string | null;
  workers: Worker[];
}

/** Shape returned by the Rust `project_*` commands (loose JSON). */
export type RawJson = Record<string, unknown>;
