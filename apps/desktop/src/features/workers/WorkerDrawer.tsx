import { AnimatePresence, motion } from "framer-motion";
import { Crown, Play, RotateCw, Square, Terminal, Trash2, X } from "lucide-react";
import type { Worker } from "../../lib/types";
import { STATUS_META } from "../../lib/status";

export interface WorkerDrawerProps {
  worker: Worker | null;
  onClose: () => void;
  onOpenTerminal: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onRemove: (id: string) => void;
  onSetLead: (id: string) => void;
}

const actionButton =
  "flex items-center justify-center gap-2 rounded-md border border-edge bg-panel-2 px-3 py-2 text-xs font-medium text-ink transition-colors duration-150 hover:border-edge-2 disabled:opacity-40";
const dangerButton =
  "flex items-center justify-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger/20";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-faint">{label}</span>
      <span className="min-w-0 break-words text-xs text-ink/90">{children}</span>
    </div>
  );
}

export function WorkerDrawer({
  worker,
  onClose,
  onOpenTerminal,
  onStart,
  onStop,
  onRestart,
  onRemove,
  onSetLead,
}: WorkerDrawerProps) {
  return (
    <AnimatePresence>
      {worker && (
        <>
          <motion.div
            key="drawer-backdrop"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer-panel"
            className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-edge bg-panel shadow-2xl"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`Worker details for ${worker.name}`}
          >
            <div className="flex items-start justify-between border-b border-edge px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[worker.status].dot}`} />
                  <h2 className="truncate text-sm font-semibold text-ink">{worker.name}</h2>
                  {worker.isLead && (
                    <span className="flex items-center gap-1 rounded border border-review/30 bg-review/10 px-1.5 py-0.5 text-[10px] font-semibold text-review">
                      <Crown className="h-3 w-3" />
                      LEAD
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">{worker.role}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close worker details"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-3">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_META[worker.status].chip}`}>
                  {STATUS_META[worker.status].label}
                </span>
              </div>

              <div className="divide-y divide-edge/60 rounded-lg border border-edge bg-panel-2/40 px-3 py-1">
                <DetailRow label="Command">
                  <span className="font-mono">
                    {worker.command}
                    {worker.args.length > 0 ? ` ${worker.args.join(" ")}` : ""}
                  </span>
                </DetailRow>
                <DetailRow label="Directory">
                  <span className="font-mono text-[11px]">{worker.cwd ?? "project root"}</span>
                </DetailRow>
                <DetailRow label="Session">
                  {worker.sessionId ? (
                    <span className="font-mono text-[11px] text-ok">
                      live{worker.pid != null ? ` · pid ${worker.pid}` : ""}
                    </span>
                  ) : worker.exitCode != null ? (
                    <span className="text-danger">exited with code {worker.exitCode}</span>
                  ) : (
                    <span className="text-faint">not running</span>
                  )}
                </DetailRow>
                <DetailRow label="Joined">
                  {new Date(worker.createdAt).toLocaleString()}
                </DetailRow>
                <DetailRow label="Capabilities">
                  {worker.capabilities.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {worker.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="rounded border border-edge bg-panel px-1.5 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {capability}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-faint">none declared</span>
                  )}
                </DetailRow>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-edge px-4 py-3">
              {worker.sessionId ? (
                <button type="button" className={actionButton} onClick={() => onOpenTerminal(worker.id)}>
                  <Terminal className="h-3.5 w-3.5" /> Open Terminal
                </button>
              ) : (
                <button type="button" className={actionButton} onClick={() => onStart(worker.id)}>
                  <Play className="h-3.5 w-3.5" /> Start
                </button>
              )}
              <button
                type="button"
                className={actionButton}
                disabled={!worker.sessionId && worker.exitCode === null && worker.status !== "error"}
                onClick={() => onRestart(worker.id)}
              >
                <RotateCw className="h-3.5 w-3.5" /> Restart
              </button>
              <button
                type="button"
                className={actionButton}
                disabled={!worker.sessionId}
                onClick={() => onStop(worker.id)}
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
              <button type="button" className={actionButton} onClick={() => onSetLead(worker.id)}>
                <Crown className="h-3.5 w-3.5" /> {worker.isLead ? "Unset Lead" : "Set as Lead"}
              </button>
              <button
                type="button"
                className={`${dangerButton} col-span-2`}
                onClick={() => onRemove(worker.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove from team
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
