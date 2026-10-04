import type { WorkerStatus } from "./types";

export interface StatusMeta {
  label: string;
  dot: string;
  chip: string;
  active: boolean;
}

export const STATUS_META: Record<WorkerStatus, StatusMeta> = {
  starting: {
    label: "Starting",
    dot: "bg-accent animate-pulse-soft",
    chip: "text-accent border-accent/30 bg-accent/10",
    active: true,
  },
  idle: {
    label: "Idle",
    dot: "bg-ok",
    chip: "text-ok border-ok/30 bg-ok/10",
    active: true,
  },
  working: {
    label: "Working",
    dot: "bg-ok animate-pulse-soft",
    chip: "text-ok border-ok/30 bg-ok/10",
    active: true,
  },
  waiting: {
    label: "Waiting",
    dot: "bg-warn",
    chip: "text-warn border-warn/30 bg-warn/10",
    active: true,
  },
  blocked: {
    label: "Blocked",
    dot: "bg-danger animate-pulse-soft",
    chip: "text-danger border-danger/30 bg-danger/10",
    active: true,
  },
  review: {
    label: "Review",
    dot: "bg-review",
    chip: "text-review border-review/30 bg-review/10",
    active: true,
  },
  error: {
    label: "Error",
    dot: "bg-danger",
    chip: "text-danger border-danger/30 bg-danger/10",
    active: false,
  },
  stopped: {
    label: "Stopped",
    dot: "bg-faint",
    chip: "text-faint border-edge-2 bg-panel-2",
    active: false,
  },
  finished: {
    label: "Finished",
    dot: "bg-ok",
    chip: "text-ok border-ok/30 bg-ok/10",
    active: false,
  },
};

/** Live PTY session = the worker process is actually running. */
export const isRunning = (status: WorkerStatus): boolean =>
  status === "starting" || status === "idle" || status === "working";

const EVENT_COLORS: Record<string, string> = {
  PROJECT_OPENED: "text-accent",
  PROJECT_INITIALIZED: "text-accent",
  OBJECTIVE_UPDATED: "text-muted",
  WORKER_ADDED: "text-ok",
  WORKER_STARTED: "text-ok",
  WORKER_STOPPED: "text-faint",
  WORKER_EXITED: "text-muted",
  WORKER_ERROR: "text-danger",
  WORKER_REMOVED: "text-danger",
  LEAD_ASSIGNED: "text-review",
};

export const eventColor = (type: string): string =>
  EVENT_COLORS[type] ?? "text-muted";

const MESSAGE_TYPE_COLORS: Record<string, string> = {
  question: "text-accent",
  answer: "text-ok",
  notification: "text-muted",
  blocker: "text-danger",
  handoff: "text-review",
  review_request: "text-review",
  contract_change: "text-warn",
  completion: "text-ok",
};

export const messageTypeColor = (type: string): string =>
  MESSAGE_TYPE_COLORS[type] ?? "text-muted";
