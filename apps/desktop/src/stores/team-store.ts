import { create } from "zustand";
import * as ipc from "../lib/ipc";
import type {
  ActivityEvent,
  ProjectState,
  RawJson,
  Task,
  TeamMessage,
  Worker,
  WorkerDraft,
  WorkerStatus,
} from "../lib/types";

const OBJECTIVE_SAVE_DEBOUNCE_MS = 900;
const STARTING_TO_IDLE_MS = 1200;
const MESSAGE_POLL_MS = 5000;

interface TeamStore {
  projectPath: string | null;
  projectName: string | null;
  objective: string;
  workers: Worker[];
  tasks: Task[];
  events: ActivityEvent[];
  messages: TeamMessage[];
  /** Message ids the user has already seen in the Command Center. */
  seenMessageIds: string[];
  leadId: string | null;
  openTabs: string[];
  activeTab: string;
  error: string | null;

  openProject: (path: string) => Promise<void>;
  closeProject: () => void;
  setError: (message: string | null) => void;
  setObjective: (text: string) => void;

  addWorker: (draft: WorkerDraft) => Promise<Worker | null>;
  startWorker: (id: string, activate?: boolean) => Promise<void>;
  stopWorker: (id: string) => Promise<void>;
  restartWorker: (id: string) => Promise<void>;
  removeWorker: (id: string) => Promise<void>;
  setLead: (id: string) => void;

  openTerminal: (id: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (tab: string) => void;

  handleExit: (sessionId: string, code: number) => void;
  refreshTasks: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  markMessagesSeen: () => void;
  replyToMessage: (messageId: string, body: string) => Promise<void>;

  logEvent: (type: string, actor: string, summary: string) => void;
}

export const COMMAND_CENTER_TAB = "command-center";

/** Unread messages the user has not seen in the Command Center yet. */
export const selectUnreadMessageCount = (state: {
  messages: TeamMessage[];
  seenMessageIds: string[];
}): number =>
  state.messages.filter(
    (message) => message.status === "unread" && !state.seenMessageIds.includes(message.id),
  ).length;

let objectiveSaveTimer: ReturnType<typeof setTimeout> | null = null;
const startingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let messagePollTimer: ReturnType<typeof setInterval> | null = null;

const basename = (path: string): string => {
  const normalized = path.replace(/[\\/]+$/, "");
  const lastSegment = normalized.split(/[\\/]/).pop();
  return lastSegment || normalized || "project";
};

const newId = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const asText = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const normalizeTask = (raw: RawJson, index: number): Task => ({
  id: asText(raw.id, `task-${index + 1}`),
  title: asText(raw.title ?? raw.name, "Untitled task"),
  description: asText(raw.description),
  status: asText(raw.status, "planned"),
  priority: asText(raw.priority, "medium"),
  assignee: typeof raw.assignee === "string" ? raw.assignee : null,
  dependencies: Array.isArray(raw.dependencies)
    ? raw.dependencies.filter((d): d is string => typeof d === "string")
    : [],
});

const normalizeMessage = (raw: RawJson): TeamMessage => ({
  id: asText(raw.id, newId("msg")),
  from: asText(raw.from, "unknown"),
  to: typeof raw.to === "string" && raw.to.length > 0 ? raw.to : null,
  type: asText(raw.type, "notification"),
  subject: asText(raw.subject),
  body: asText(raw.body),
  taskId: typeof raw.taskId === "string" && raw.taskId.length > 0 ? raw.taskId : null,
  createdAt: asText(raw.createdAt, new Date().toISOString()),
  status: asText(raw.status, "unread"),
  replyTo: typeof raw.replyTo === "string" && raw.replyTo.length > 0 ? raw.replyTo : null,
});

export const useTeamStore = create<TeamStore>()((set, get) => {
  /** Append an activity event to the feed and persist it to .ai-team/events. */
  const logEvent = (type: string, actor: string, summary: string) => {
    const { projectPath, events } = get();
    const event: ActivityEvent = {
      id: newId("evt"),
      type,
      actor,
      summary,
      timestamp: new Date().toISOString(),
    };
    set({ events: [...events.slice(-299), event] });
    if (projectPath) {
      void ipc
        .eventsAppend(projectPath, event as unknown as RawJson)
        .catch(() => undefined);
    }
  };

  /** Persist orchestrator state into .ai-team/state.json. */
  const persist = () => {
    const { projectPath, projectName, objective, leadId, workers } = get();
    if (!projectPath) return;
    const state: ProjectState = {
      version: 1,
      project: { name: projectName ?? basename(projectPath), path: projectPath },
      objective,
      leadId,
      workers,
    };
    void ipc.projectSave(projectPath, state).catch(() => undefined);
  };

  const getWorker = (id: string): Worker | undefined =>
    get().workers.find((worker) => worker.id === id);

  const patchWorker = (id: string, patch: Partial<Worker>) => {
    set({
      workers: get().workers.map((worker) =>
        worker.id === id ? { ...worker, ...patch } : worker,
      ),
    });
  };

  const clearStartingTimer = (workerId: string) => {
    const timer = startingTimers.get(workerId);
    if (timer) {
      clearTimeout(timer);
      startingTimers.delete(workerId);
    }
  };

  const openTabFor = (id: string) => {
    const { openTabs } = get();
    if (!openTabs.includes(id)) set({ openTabs: [...openTabs, id] });
  };

  return {
    projectPath: null,
    projectName: null,
    objective: "",
    workers: [],
    tasks: [],
    events: [],
    messages: [],
    seenMessageIds: [],
    leadId: null,
    openTabs: [],
    activeTab: COMMAND_CENTER_TAB,
    error: null,

    setError: (message) => set({ error: message }),

    openProject: async (path) => {
      set({ error: null });
      const name = basename(path);
      let raw: RawJson;
      try {
        raw = await ipc.projectLoad(path).catch(async (loadError: unknown) => {
          const message = String(loadError);
          if (message.includes("NOT_INITIALIZED")) {
            const initialized = await ipc.projectInit(path, name);
            logEvent(
              "PROJECT_INITIALIZED",
              "orchestrator",
              `Initialized .ai-team protocol directory`,
            );
            return initialized;
          }
          throw loadError;
        });
      } catch (loadError) {
        set({
          error: `Failed to open project: ${String(loadError)}`,
          projectPath: null,
        });
        return;
      }

      // Restored workers come back detached: dead processes are marked stopped.
      const restoredWorkers: Worker[] = (Array.isArray(raw.workers) ? raw.workers : [])
        .filter((entry): entry is RawJson => typeof entry === "object" && entry !== null)
        .map((entry) => ({
          id: asText(entry.id, newId("worker")),
          name: asText(entry.name, "Unnamed worker"),
          role: asText(entry.role, "Contributor"),
          command: asText(entry.command, ""),
          args: Array.isArray(entry.args)
            ? entry.args.filter((arg): arg is string => typeof arg === "string")
            : [],
          cwd: typeof entry.cwd === "string" ? entry.cwd : null,
          capabilities: Array.isArray(entry.capabilities)
            ? entry.capabilities.filter((c): c is string => typeof c === "string")
            : [],
          autoStart: entry.autoStart === true,
          isLead: entry.isLead === true,
          status: "stopped" as WorkerStatus,
          sessionId: null,
          pid: null,
          exitCode: null,
          createdAt: asText(entry.createdAt, new Date().toISOString()),
        }));

      const objective = asText(raw.objective);
      const leadId = typeof raw.leadId === "string" ? raw.leadId : null;

      set({
        projectPath: path,
        projectName: name,
        objective,
        leadId,
        workers: restoredWorkers,
        tasks: [],
        events: [],
        openTabs: [],
        activeTab: COMMAND_CENTER_TAB,
      });

      let recent: RawJson[] = [];
      try {
        recent = await ipc.eventsRecent(path, 200);
      } catch {
        recent = [];
      }
      set({
        events: recent
          .filter((entry) => typeof entry.id === "string" || typeof entry.type === "string")
          .map((entry, index) => ({
            id: asText(entry.id, newId("evt")),
            type: asText(entry.type, "EVENT"),
            actor: asText(entry.actor, "orchestrator"),
            summary: asText(entry.summary, asText(entry.type, "event")),
            timestamp: asText(
              entry.timestamp,
              new Date(Date.now() + index).toISOString(),
            ),
          })),
      });

      logEvent("PROJECT_OPENED", "orchestrator", `Opened ${name}`);

      try {
        await ipc.watchTasks(path);
      } catch {
        // Watcher may fail on some platforms; ignore silently.
      }

      try {
        const tasks = await ipc.projectTasks(path);
        set({ tasks: tasks.map(normalizeTask) });
      } catch {
        set({ tasks: [] });
      }

      // Start watching .ai-team/tasks for external changes (e.g., team CLI).
      let unwatch: (() => void) | null = null;
      try {
        unwatch = await ipc.listenTaskChanged(() => {
          // External change detected → refresh tasks
          void get().refreshTasks();
        });
      } catch {
        // Watcher may fail on some platforms; ignore silently.
      }
      (get as any).__unwatch = unwatch;

      // Watch + poll .ai-team/messages so worker questions surface live.
      let unwatchMessages: (() => void) | null = null;
      try {
        await ipc.watchMessages(path).catch(() => undefined);
        unwatchMessages = await ipc.listenMessageChanged(() => {
          void get().refreshMessages();
        });
      } catch {
        // Watcher may fail on some platforms; ignore silently.
      }
      (get as any).__unwatchMessages = unwatchMessages;
      if (messagePollTimer) clearInterval(messagePollTimer);
      messagePollTimer = setInterval(() => void get().refreshMessages(), MESSAGE_POLL_MS);
      void get().refreshMessages();

      // Auto-start workers configured for it. Tabs stay closed; workers are
      // manageable from the Team panel until the user opens their terminal.
      for (const worker of restoredWorkers.filter((worker) => worker.autoStart)) {
        void get().startWorker(worker.id, false);
      }
    },

    closeProject: () => {
      const unwatch = (get as any).__unwatch;
      if (typeof unwatch === 'function') unwatch();
      const unwatchMessages = (get as any).__unwatchMessages;
      if (typeof unwatchMessages === 'function') unwatchMessages();
      if (messagePollTimer) {
        clearInterval(messagePollTimer);
        messagePollTimer = null;
      }
      set({
        projectPath: null,
        projectName: null,
        objective: "",
        workers: [],
        tasks: [],
        events: [],
        messages: [],
        seenMessageIds: [],
        leadId: null,
        openTabs: [],
        activeTab: COMMAND_CENTER_TAB,
      });
    },

    setObjective: (text) => {
      set({ objective: text });
      if (objectiveSaveTimer) clearTimeout(objectiveSaveTimer);
      objectiveSaveTimer = setTimeout(() => {
        objectiveSaveTimer = null;
        persist();
        logEvent("OBJECTIVE_UPDATED", "orchestrator", "Project objective saved");
      }, OBJECTIVE_SAVE_DEBOUNCE_MS);
    },

    addWorker: async (draft) => {
      const { projectPath } = get();
      if (!projectPath) return null;
      const worker: Worker = {
        id: newId("worker"),
        name: draft.name,
        role: draft.role,
        command: draft.command,
        args: draft.args,
        cwd: draft.cwd,
        capabilities: draft.capabilities,
        autoStart: draft.autoStart,
        isLead: draft.isLead,
        status: "stopped",
        sessionId: null,
        pid: null,
        exitCode: null,
        createdAt: new Date().toISOString(),
      };
      set({ workers: [...get().workers, worker], leadId: draft.isLead ? worker.id : get().leadId });
      logEvent("WORKER_ADDED", worker.name, `${worker.name} joined as ${worker.role}`);
      persist();
      if (worker.autoStart) {
        await get().startWorker(worker.id, true);
      }
      return worker;
    },

    startWorker: async (id, activate = true) => {
      const { projectPath } = get();
      const worker = getWorker(id);
      if (!projectPath || !worker || worker.sessionId) return;
      patchWorker(id, { status: "starting", exitCode: null });
      if (activate) {
        openTabFor(id);
        set({ activeTab: id });
      } else {
        openTabFor(id);
      }
      try {
        const result = await ipc.ptySpawn({
          command: worker.command,
          args: worker.args,
          cwd: worker.cwd ?? projectPath,
          env: { TEAM_ACTOR: worker.name },
        });
        clearStartingTimer(id);
        patchWorker(id, {
          status: "starting",
          sessionId: result.id,
          pid: result.pid,
        });
        logEvent(
          "WORKER_STARTED",
          worker.name,
          `${worker.name} started (${worker.command}${worker.args.length ? ` ${worker.args.join(" ")}` : ""})`,
        );
        startingTimers.set(
          id,
          setTimeout(() => {
            startingTimers.delete(id);
            const current = getWorker(id);
            if (current && current.status === "starting" && current.sessionId === result.id) {
              patchWorker(id, { status: "idle" });
            }
          }, STARTING_TO_IDLE_MS),
        );
      } catch (spawnError) {
        patchWorker(id, { status: "error", sessionId: null, pid: null });
        logEvent(
          "WORKER_ERROR",
          worker.name,
          `Failed to start ${worker.name}: ${String(spawnError)}`,
        );
        set({ error: `Failed to start ${worker.name}: ${String(spawnError)}` });
      }
    },

    stopWorker: async (id) => {
      const worker = getWorker(id);
      if (!worker) return;
      clearStartingTimer(id);
      if (worker.sessionId) {
        await ipc.ptyKill(worker.sessionId).catch(() => undefined);
        // The pty-exit event finalizes status; set it here too for snappiness.
        patchWorker(id, { status: "stopped" });
      } else {
        patchWorker(id, { status: "stopped" });
      }
      logEvent("WORKER_STOPPED", worker.name, `${worker.name} stopped`);
      persist();
    },

    restartWorker: async (id) => {
      const worker = getWorker(id);
      if (!worker) return;
      if (worker.sessionId) {
        await get().stopWorker(id);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      await get().startWorker(id, true);
    },

    removeWorker: async (id) => {
      const worker = getWorker(id);
      if (!worker) return;
      if (worker.sessionId) await get().stopWorker(id);
      set({
        workers: get().workers.filter((entry) => entry.id !== id),
        openTabs: get().openTabs.filter((tab) => tab !== id),
        activeTab:
          get().activeTab === id ? COMMAND_CENTER_TAB : get().activeTab,
        leadId: get().leadId === id ? null : get().leadId,
      });
      logEvent("WORKER_REMOVED", worker.name, `${worker.name} removed from the team`);
      persist();
    },

    setLead: (id) => {
      const worker = getWorker(id);
      const isLead = worker?.isLead === true;
      set({
        leadId: isLead ? null : id,
        workers: get().workers.map((entry) => ({
          ...entry,
          isLead: entry.id === id ? !isLead : false,
        })),
      });
      persist();
      if (worker) {
        logEvent(
          "LEAD_ASSIGNED",
          worker.name,
          isLead ? `${worker.name} is no longer the Lead` : `${worker.name} designated as Lead`,
        );
      }
    },

    openTerminal: (id) => {
      openTabFor(id);
      set({ activeTab: id });
    },

    closeTab: (id) => {
      const { openTabs, activeTab } = get();
      const nextTabs = openTabs.filter((tab) => tab !== id);
      set({
        openTabs: nextTabs,
        activeTab: activeTab === id ? COMMAND_CENTER_TAB : activeTab,
      });
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
      if (tab === COMMAND_CENTER_TAB) get().markMessagesSeen();
    },

    handleExit: (sessionId, code) => {
      const worker = get().workers.find((entry) => entry.sessionId === sessionId);
      if (!worker) return;
      clearStartingTimer(worker.id);
      patchWorker(worker.id, {
        sessionId: null,
        pid: null,
        exitCode: code,
        status: code === 0 ? "stopped" : "error",
      });
      logEvent(
        "WORKER_EXITED",
        worker.name,
        `${worker.name} exited with code ${code}`,
      );
    },

    refreshTasks: async () => {
      const { projectPath } = get();
      if (!projectPath) return;
      try {
        const tasks = await ipc.projectTasks(projectPath);
        set({ tasks: tasks.map(normalizeTask) });
      } catch {
        set({ tasks: [] });
      }
    },

    refreshMessages: async () => {
      const { projectPath } = get();
      if (!projectPath) return;
      try {
        const raw = await ipc.projectMessages(projectPath);
        set({ messages: raw.map(normalizeMessage) });
        if (get().activeTab === COMMAND_CENTER_TAB) get().markMessagesSeen();
      } catch {
        set({ messages: [] });
      }
    },

    markMessagesSeen: () => {
      const { messages, seenMessageIds } = get();
      const unread = messages
        .filter((message) => message.status === "unread" && !seenMessageIds.includes(message.id))
        .map((message) => message.id);
      if (!unread.length) return;
      set({ seenMessageIds: [...seenMessageIds, ...unread] });
    },

    /**
     * Reply to a worker message as the human operator: a protocol message
     * with `from: "lead"` addressed to the original sender. The Rust side
     * marks the replied-to message read.
     */
    replyToMessage: async (messageId, body) => {
      const { projectPath, messages } = get();
      const original = messages.find((message) => message.id === messageId);
      const trimmed = body.trim();
      if (!projectPath || !original || !trimmed) return;
      const reply: RawJson = {
        id: `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        from: "lead",
        to: original.from,
        type: original.type === "question" ? "answer" : "notification",
        subject: original.subject ? `Re: ${original.subject}` : "",
        body: trimmed,
        taskId: original.taskId,
        createdAt: new Date().toISOString(),
        status: "unread",
        replyTo: original.id,
      };
      try {
        await ipc.messagesSend(projectPath, reply);
      } catch (sendError) {
        set({ error: `Failed to send reply: ${String(sendError)}` });
        throw sendError;
      }
      logEvent("MESSAGE_SENT", "lead", `Replied to ${original.from}`);
      await get().refreshMessages();
    },

    logEvent: (type: string, actor: string, summary: string) => {
      const { projectPath, events } = get();
      const event: ActivityEvent = {
        id: newId("evt"),
        type,
        actor,
        summary,
        timestamp: new Date().toISOString(),
      };
      set({ events: [...events.slice(-299), event] });
      if (projectPath) {
        void ipc
          .eventsAppend(projectPath, event as unknown as RawJson)
          .catch(() => undefined);
      }
    },
  };
});
