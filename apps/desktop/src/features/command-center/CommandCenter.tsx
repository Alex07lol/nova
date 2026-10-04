import React from "react";
import { Plus, Zap, Loader2 } from "lucide-react";
import {
  COMMAND_CENTER_TAB,
  selectUnreadMessageCount,
  useTeamStore,
} from "../../stores/team-store";
import { WorkerCard } from "../workers/WorkerCard";
import { ActivityFeed } from "../activity/ActivityFeed";
import { messageTypeColor } from "../../lib/status";
import type { TeamMessage } from "../../lib/types";
import { nextSelectedIndex } from "./message-keys";
import {
  flattenVisibleThreads,
  groupIntoThreads,
  hiddenMemberCount,
  visibleThreadMembers,
} from "./message-threads";
import * as ipc from "../../lib/ipc";

const panelClass = "flex min-h-0 flex-col rounded-xl border border-edge bg-panel";
const panelHeader =
  "flex h-9 shrink-0 items-center gap-2 border-b border-edge px-3 text-[11px] font-semibold tracking-[0.14em] text-faint";

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-lg border border-edge bg-panel px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

export function CommandCenter({ onAddWorker, onOpenDrawer }: { onAddWorker: () => void; onOpenDrawer: (id: string) => void }) {
  const objective = useTeamStore((state) => state.objective);
  const setObjective = useTeamStore((state) => state.setObjective);
  const workers = useTeamStore((state) => state.workers);
  const tasks = useTeamStore((state) => state.tasks);
  const events = useTeamStore((state) => state.events);
  const messages = useTeamStore((state) => state.messages);
  const unreadMessages = useTeamStore(selectUnreadMessageCount);
  const leadId = useTeamStore((state) => state.leadId);
  const projectPath = useTeamStore((state) => state.projectPath);
  const startWorker = useTeamStore((state) => state.startWorker);
  const stopWorker = useTeamStore((state) => state.stopWorker);
  const restartWorker = useTeamStore((state) => state.restartWorker);
  const removeWorker = useTeamStore((state) => state.removeWorker);
  const openTerminal = useTeamStore((state) => state.openTerminal);
  const setError = useTeamStore((state) => state.setError);

  const activeWorkers = workers.filter((worker) => worker.sessionId !== null).length;
  const lead = workers.find((worker) => worker.id === leadId);
  const replyToMessage = useTeamStore((state) => state.replyToMessage);
  const [deploying, setDeploying] = React.useState(false);
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [replySending, setReplySending] = React.useState(false);
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
  // Threads the user explicitly expanded; keyed by root id. Reset naturally
  // when a project swap recreates the component.
  const [expandedThreads, setExpandedThreads] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const messagesRef = React.useRef<HTMLDivElement | null>(null);
  const replySendingRef = React.useRef(false);

  const toggleThread = (rootId: string) => {
    setExpandedThreads((previous) => {
      const next = new Set(previous);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  // Replies nest under the message they answer (replyTo, spec §14); long
  // threads collapse to their newest two rows, and the keyboard walks rows
  // in the exact order the panel renders them — hidden rows never appear.
  const threads = groupIntoThreads(messages);
  const expanded = new Set(expandedThreads);
  if (replyingTo) {
    // An open composer must never be collapsed out of the DOM: if its
    // target row slipped behind the toggle (fresh replies arrived), keep
    // that thread expanded.
    const visibleSoFar = flattenVisibleThreads(threads, expanded);
    const targetVisible = visibleSoFar.some((entry) => entry.id === replyingTo);
    if (!targetVisible) {
      const owner = threads.find((thread) =>
        thread.members.some((entry) => entry.id === replyingTo),
      );
      if (owner) expanded.add(owner.root.id);
    }
  }
  const displayMessages = flattenVisibleThreads(threads, expanded);

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyBody("");
  };

  const openReply = (id: string) => {
    // Switching targets discards a half-typed draft; re-opening the same
    // composer keeps it.
    if (replyingTo !== id) setReplyBody("");
    setReplyingTo(id);
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyBody.trim() || replySendingRef.current) return;
    replySendingRef.current = true;
    setReplySending(true);
    try {
      await replyToMessage(messageId, replyBody);
      cancelReply();
    } catch {
      // The store already surfaced the error toast.
    } finally {
      replySendingRef.current = false;
      setReplySending(false);
    }
  };

  /** Keep the keyboard selection visible as the panel scrolls. */
  React.useEffect(() => {
    if (!selectedMessageId) return;
    const rows = messagesRef.current?.querySelectorAll<HTMLElement>("[data-message-id]");
    rows?.forEach((row) => {
      if (row.dataset.messageId === selectedMessageId) {
        row.scrollIntoView({ block: "nearest" });
      }
    });
  }, [selectedMessageId, messages.length, displayMessages.length]);

  // Keyboard triage: j/k move, r replies, Enter opens or sends, Esc cancels.
  // Re-registered every render so the handlers see fresh state. Keystrokes
  // aimed at text fields are left alone; Enter leaves buttons to their
  // native activation so a click and a keypress can never double-send.
  React.useEffect(() => {
    const closestTo = (target: EventTarget | null, selector: string): boolean => {
      const element = target as HTMLElement | null;
      return !!element?.closest?.(selector);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (closestTo(event.target, "input, textarea, select, [contenteditable='true']")) return;
      if (useTeamStore.getState().activeTab !== COMMAND_CENTER_TAB) return;

      if (event.key === "Escape" && replyingTo) {
        event.preventDefault();
        cancelReply();
        return;
      }

      if (event.key === "Enter") {
        if (closestTo(event.target, "button, a")) return; // native activation
        if (replyingTo) {
          event.preventDefault();
          void handleSendReply(replyingTo);
          return;
        }
        if (displayMessages.length > 0 && selectedMessageId) {
          const target = displayMessages.find((entry) => entry.id === selectedMessageId);
          if (target && target.from !== "lead") {
            event.preventDefault();
            openReply(target.id);
          }
        }
        return;
      }

      if (displayMessages.length === 0) return;
      const index = selectedMessageId
        ? displayMessages.findIndex((entry) => entry.id === selectedMessageId)
        : -1;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const next = nextSelectedIndex(displayMessages.length, index, event.key);
        if (next >= 0) setSelectedMessageId(displayMessages[next].id);
        return;
      }

      if (event.key === "r") {
        event.preventDefault();
        const target = index === -1 ? displayMessages[0] : displayMessages[index];
        if (!target) return;
        setSelectedMessageId(target.id);
        if (target.from !== "lead" && replyingTo !== target.id) openReply(target.id);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  /** One message's content: header, body, task ref + Reply, composer. */
  const renderMessageContent = (message: TeamMessage) => (
    <>
      <div className="flex items-baseline gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            message.status === "unread" ? "bg-warn" : "bg-transparent"
          }`}
        />
        <span
          className={`shrink-0 font-mono text-[10px] ${messageTypeColor(message.type)}`}
        >
          {message.type}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink/90">
          <span className="text-muted">{message.from}</span>
          {" → "}
          <span className="text-muted">{message.to ?? "*"}</span>
          {message.subject ? ` — ${message.subject}` : ""}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-faint">
          {formatTime(message.createdAt)}
        </span>
      </div>
      {message.body && (
        <div className="mt-1 pl-3.5 text-[11px] leading-snug text-muted">
          {message.body}
        </div>
      )}
      {(message.taskId || message.from !== "lead") && (
        <div className="mt-1 flex items-center gap-2 pl-3.5 text-[10px]">
          {message.taskId && (
            <span className="font-mono text-faint">re: {message.taskId}</span>
          )}
          {message.from !== "lead" && (
            <button
              type="button"
              onClick={() => {
                if (replyingTo === message.id) cancelReply();
                else openReply(message.id);
              }}
              className="ml-auto text-faint transition-colors hover:text-accent"
            >
              {replyingTo === message.id ? "Close" : "Reply"}
            </button>
          )}
        </div>
      )}
      {replyingTo === message.id && (
        <div className="mt-2 pl-3.5">
          <textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelReply();
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSendReply(message.id);
              }
            }}
            rows={2}
            autoFocus
            placeholder={`Reply to ${message.from} as lead… (Enter to send, Shift+Enter for a new line)`}
            className="w-full resize-none rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs leading-relaxed text-ink placeholder:text-faint/60 outline-none transition-colors duration-150 focus:border-accent/50"
            spellCheck={false}
          />
          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cancelReply}
              className="rounded-md px-2 py-1 text-[10px] text-faint transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!replyBody.trim() || replySending}
              onClick={() => void handleSendReply(message.id)}
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/20 disabled:opacity-40"
            >
              {replySending ? "Sending…" : "Send as lead"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  // Build the Lead prompt per spec §78
  const buildLeadPrompt = () => {
    const teamSummary = workers
      .map(w => `- ${w.name} (${w.role}): ${w.command} ${w.args.join(' ')} ${w.capabilities.length ? '[' + w.capabilities.join(', ') + ']' : ''}`)
      .join('\n');
    const rules = objective.split('\n').filter(l => l.trim().startsWith('-')).join('\n') || '(no explicit rules)';
    const architecture = '(shared architecture notes in .ai-team/architecture.md)';

    return `You are the Lead Engineer for this project.

PROJECT OBJECTIVE:
${objective.trim()}

TEAM:
${teamSummary || '(no team members yet)'}

PROJECT RULES:
${rules}

CURRENT ARCHITECTURE:
${architecture}

Your responsibilities:
1. Inspect the project before creating implementation tasks.
2. Break the objective into concrete tasks.
3. Assign tasks to team members based on capabilities.
4. Define dependencies.
5. Avoid duplicate work.
6. Publish important architectural/API changes through the Team Protocol.
7. Review completed work before integration.
8. Create follow-up tasks when necessary.
9. Do not modify protected branches without approval.
10. Keep the project state synchronized using the \`team\` CLI.

When creating tasks, provide:
- task ID
- title
- description
- assignee
- dependencies
- relevant files
- acceptance criteria

Use the \`team\` CLI to create tasks. Example:
  team task create "Implement auth API" --assignee agy-backend
  team task create "Auth UI" --assignee codex-ui --dep task-1
  team task complete task-1`;
  };

  const handleDeploy = async () => {
    if (!lead || !projectPath || !objective.trim()) return;
    setDeploying(true);
    setError(null);

    try {
      // Ensure the Lead worker is running
      if (!lead.sessionId) {
        await startWorker(lead.id, false);
        // Wait a bit for PTY to be ready
        await new Promise(r => setTimeout(r, 1500));
      }

      // Send the Lead prompt via PTY stdin
      const prompt = buildLeadPrompt();
      await ipc.ptyWrite(lead.sessionId!, prompt + '\n');

      // Log the event
      const { useTeamStore } = await import('../../stores/team-store');
      useTeamStore.getState().logEvent(
        'LEAD_DEPLOYED',
        lead.name,
        'Lead received deployment prompt and is analyzing the project'
      );

      // Give the Lead a moment to start responding
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      setError(`Failed to deploy team: ${String(err)}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      {/* Giant prompt — the project objective. */}
      <section>
        <div className="mb-1.5 flex items-baseline gap-2">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-faint">
            PROJECT OBJECTIVE
          </h2>
          <span className="text-[10px] text-faint/70">auto-saves to .ai-team</span>
        </div>
        <textarea
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder={
            "One gigantic project prompt for the whole team…\n\nBuild a warranty management platform.\n\nRequirements:\n- Authentication\n- Warranty registration\n- Dashboard\n\nConstraints:\n- Do not break the current API\n- Maintain TypeScript strict mode"
          }
          className="min-h-[120px] w-full resize-none rounded-xl border border-edge bg-panel px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-faint/60 outline-none transition-colors duration-150 focus:border-accent/50"
          spellCheck={false}
        />
      </section>

      {/* Stat strip */}
      <div className="flex gap-2">
        <Stat label="Active" value={`${activeWorkers} / ${workers.length}`} />
        <Stat label="Tasks" value={tasks.length} />
        <Stat label="Lead" value={lead ? lead.name : "unassigned"} />
        <Stat label="Events" value={events.length} />
      </div>

      {/* Analyze & Deploy Team — sends structured prompt to Lead */}
      <button
        type="button"
        disabled={!lead || !projectPath || !objective.trim() || deploying}
        onClick={handleDeploy}
        className="flex items-center justify-center gap-2 h-10 rounded-xl border border-edge bg-panel px-4 text-sm font-medium text-ink transition-colors duration-150 hover:border-accent/50 disabled:opacity-40 disabled:hover:border-edge"
      >
        {deploying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Deploying team…
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Analyze &amp; Deploy Team
          </>
        )}
      </button>

      {/* Four-panel cockpit */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <section className={`${panelClass} lg:max-h-[52vh]`}>
          <header className={panelHeader}>
            TEAM
            <button
              type="button"
              onClick={onAddWorker}
              aria-label="Add team member"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-md border border-edge text-muted transition-colors duration-150 hover:border-edge-2 hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {workers.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-faint">
                No team members yet. Add a worker to spawn your first terminal.
              </p>
            ) : (
              workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onOpenTerminal={openTerminal}
                  onStart={startWorker}
                  onStop={stopWorker}
                  onRestart={restartWorker}
                  onRemove={removeWorker}
                  onOpenDrawer={onOpenDrawer}
                />
              ))
            )}
          </div>
        </section>

        <section className={`${panelClass} lg:max-h-[52vh]`}>
          <header className={panelHeader}>TASKS</header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {tasks.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-faint">
                No tasks yet. Tasks created in <span className="font-mono">.ai-team/tasks/</span>{" "}
                — by the Lead or the <span className="font-mono">team</span> CLI — appear here.
              </p>
            ) : (
              <ul className="space-y-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-lg border border-edge bg-panel-2/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-edge bg-panel px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {task.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink/90">
                        {task.title}
                      </span>
                      <span className="shrink-0 rounded border border-edge bg-panel px-1.5 py-0.5 text-[10px] text-muted">
                        {task.status}
                      </span>
                    </div>
                    {(task.assignee || task.dependencies.length > 0) && (
                      <div className="mt-1 pl-1 text-[10px] text-faint">
                        {task.assignee && <span>assigned to {task.assignee}</span>}
                        {task.assignee && task.dependencies.length > 0 && <span> · </span>}
                        {task.dependencies.length > 0 && (
                          <span>depends on {task.dependencies.join(", ")}</span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={`${panelClass} lg:max-h-[52vh]`}>
          <header className={panelHeader}>
            MESSAGES
            {unreadMessages > 0 && (
              <span className="ml-1 rounded-full border border-warn/40 bg-warn/10 px-1.5 text-[10px] font-semibold text-warn">
                {unreadMessages} new
              </span>
            )}
          </header>
          <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto p-2">
            {messages.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-faint">
                No messages yet. Workers send them with the{" "}
                <span className="font-mono">team</span> CLI —{" "}
                <span className="font-mono">team message send …</span>
              </p>
            ) : (
              <ul className="space-y-1">
                {threads.map((thread) => {
                  const hiddenCount = hiddenMemberCount(thread);
                  const isExpanded = expanded.has(thread.root.id);
                  const members = visibleThreadMembers(thread, expanded);
                  return (
                    <li
                      key={thread.root.id}
                      className={`overflow-hidden rounded-lg border bg-panel-2/50 transition-colors duration-100 ${
                        thread.members.some((entry) => entry.id === selectedMessageId)
                          ? "border-accent/60"
                          : "border-edge"
                      }`}
                    >
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleThread(thread.root.id)}
                          className="w-full border-b border-edge bg-panel px-3 py-1.5 text-left text-[10px] font-medium text-faint transition-colors duration-100 hover:bg-accent/10 hover:text-accent"
                        >
                          {isExpanded
                            ? `hide ${hiddenCount} earlier`
                            : `show ${hiddenCount} earlier`}
                        </button>
                      )}
                      {members.map((message, memberIndex) => {
                        const isReply = message.id !== thread.root.id;
                        return (
                          <div
                            key={message.id}
                            data-message-id={message.id}
                            onClick={() => setSelectedMessageId(message.id)}
                            className={`px-3 py-2 transition-colors duration-100 ${
                              isReply
                                ? `ml-4 border-l-2 border-accent/30 pl-5${
                                    memberIndex > 0 ? " border-t" : ""
                                  }`
                                : ""
                            } ${selectedMessageId === message.id ? "bg-accent/10" : ""}`}
                          >
                            {isReply && (
                              <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.12em] text-faint/70">
                                ↳ reply
                              </div>
                            )}
                            {renderMessageContent(message)}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-edge px-3 py-1 text-[9px] tracking-wide text-faint/70">
            j/k move · r reply · enter send · esc cancel
          </div>
        </section>

        <section className={`${panelClass} lg:max-h-[52vh]`}>
          <header className={panelHeader}>LIVE ACTIVITY</header>
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <ActivityFeed events={events} />
          </div>
        </section>
      </div>
    </div>
  );
}
