import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Terminal, X } from "lucide-react";
import * as ipc from "./lib/ipc";
import { COMMAND_CENTER_TAB, useTeamStore } from "./stores/team-store";
import { isRunning, STATUS_META } from "./lib/status";
import { ProjectGate } from "./features/project/ProjectGate";
import { StartupSequence } from "./features/shell/StartupSequence";
import { TabStrip } from "./features/shell/TabStrip";
import { CommandCenter } from "./features/command-center/CommandCenter";
import { TerminalPane } from "./features/terminals/TerminalPane";
import { AddWorkerModal } from "./features/workers/AddWorkerModal";
import { WorkerDrawer } from "./features/workers/WorkerDrawer";

function Shell() {
  const projectPath = useTeamStore((state) => state.projectPath);
  const projectName = useTeamStore((state) => state.projectName);
  const workers = useTeamStore((state) => state.workers);
  const openTabs = useTeamStore((state) => state.openTabs);
  const activeTab = useTeamStore((state) => state.activeTab);
  const events = useTeamStore((state) => state.events);
  const error = useTeamStore((state) => state.error);
  const setError = useTeamStore((state) => state.setError);
  const addWorker = useTeamStore((state) => state.addWorker);
  const startWorker = useTeamStore((state) => state.startWorker);
  const stopWorker = useTeamStore((state) => state.stopWorker);
  const restartWorker = useTeamStore((state) => state.restartWorker);
  const removeWorker = useTeamStore((state) => state.removeWorker);
  const setLead = useTeamStore((state) => state.setLead);
  const openTerminal = useTeamStore((state) => state.openTerminal);

  const [addOpen, setAddOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [startupDone, setStartupDone] = useState(false);

  // Re-show the startup sequence only when a different project is opened.
  useEffect(() => {
    setStartupDone(false);
  }, [projectPath]);

  // Auto-dismiss transient errors.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error, setError]);

  const activeCount = workers.filter((worker) => isRunning(worker.status)).length;
  const lastEvent = events[events.length - 1];
  const drawerWorker = workers.find((worker) => worker.id === drawerId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Title bar */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-edge bg-panel px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-edge-2 bg-gradient-to-br from-accent/25 to-accent-2/25">
          <Terminal className="h-3.5 w-3.5 text-accent" />
        </div>
        <span className="text-[11px] font-semibold tracking-[0.22em] text-ink">AI DEV TEAM</span>
        <span className="text-edge-2">|</span>
        <span className="truncate text-xs text-muted">
          <span className="text-ink/80">{projectName}</span>
          <span className="ml-2 hidden font-mono text-[10px] text-faint lg:inline">{projectPath}</span>
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${activeCount > 0 ? "bg-ok animate-pulse-soft" : "bg-faint"}`} />
          {activeCount} ACTIVE
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-md border border-edge bg-panel-2 px-2.5 py-1 text-[11px] font-medium text-ink transition-colors duration-150 hover:border-edge-2"
        >
          + Add Worker
        </button>
      </header>

      <TabStrip onAddWorker={() => setAddOpen(true)} />

      {/* Content area. All open panes stay mounted (hidden) so terminal
          scrollback and process streams survive tab switches. */}
      <main className="relative min-h-0 flex-1">
        <div className={activeTab === COMMAND_CENTER_TAB ? "absolute inset-0" : "hidden"}>
          <CommandCenter onAddWorker={() => setAddOpen(true)} onOpenDrawer={setDrawerId} />
        </div>
        {openTabs.map((workerId) => {
          const worker = workers.find((entry) => entry.id === workerId);
          if (!worker) return null;
          return (
            <div
              key={workerId}
              className={activeTab === workerId ? "absolute inset-0" : "hidden"}
            >
              <TerminalPane
                sessionId={worker.sessionId}
                command={worker.command}
                args={worker.args}
                pid={worker.pid}
                exitCode={worker.exitCode}
                active={activeTab === workerId}
              />
            </div>
          );
        })}
      </main>

      {/* Status bar */}
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-edge bg-panel px-3 text-[10px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className={`h-1 w-1 rounded-full ${activeCount > 0 ? "bg-ok" : "bg-faint"}`} />
          {activeCount > 0 ? "TEAM ACTIVE" : "TEAM IDLE"}
        </span>
        {lastEvent && (
          <span className="min-w-0 truncate">
            {lastEvent.actor}: {lastEvent.summary}
          </span>
        )}
        <span className="ml-auto font-mono">{activeCount} live session{activeCount === 1 ? "" : "s"}</span>
      </footer>

      <AddWorkerModal
        open={addOpen}
        projectRoot={projectPath ?? ""}
        onClose={() => setAddOpen(false)}
        onAdd={async (draft) => {
          await addWorker(draft);
        }}
      />

      <WorkerDrawer
        worker={drawerWorker}
        onClose={() => setDrawerId(null)}
        onOpenTerminal={(id) => {
          openTerminal(id);
          setDrawerId(null);
        }}
        onStart={(id) => void startWorker(id)}
        onStop={(id) => void stopWorker(id)}
        onRestart={(id) => void restartWorker(id)}
        onRemove={(id) => {
          void removeWorker(id);
          setDrawerId(null);
        }}
        onSetLead={setLead}
      />

      {/* Transient error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error-toast"
            className="fixed bottom-10 right-4 z-[70] flex max-w-sm items-start gap-2 rounded-lg border border-danger/40 bg-panel px-3 py-2.5 shadow-xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            role="alert"
          >
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META.error.dot}`} />
            <p className="text-xs leading-relaxed text-ink/90">{error}</p>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError(null)}
              className="ml-1 text-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!startupDone && (
        <StartupSequence
          projectName={projectName ?? "project"}
          workerCount={workers.length}
          onDone={() => setStartupDone(true)}
        />
      )}
    </div>
  );
}

export default function App() {
  const projectPath = useTeamStore((state) => state.projectPath);
  const handleExit = useTeamStore((state) => state.handleExit);

  // Single global exit listener drives worker status transitions.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void ipc
      .listenPtyExit((payload) => handleExit(payload.id, payload.code))
      .then((un) => {
        if (disposed) un();
        else unlisten = un;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleExit]);

  return projectPath ? <Shell /> : <ProjectGate />;
}
