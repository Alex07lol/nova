import { Crown, Play, RotateCw, Square, Terminal, Trash2 } from "lucide-react";
import type { Worker } from "../../lib/types";
import { STATUS_META } from "../../lib/status";

export interface WorkerCardProps {
  worker: Worker;
  onOpenTerminal: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenDrawer: (id: string) => void;
}

const iconButton =
  "flex h-7 w-7 items-center justify-center rounded-md border border-edge text-muted transition-colors duration-150 hover:border-edge-2 hover:text-ink disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-muted";

export function WorkerCard({
  worker,
  onOpenTerminal,
  onStart,
  onStop,
  onRestart,
  onRemove,
  onOpenDrawer,
}: WorkerCardProps) {
  const meta = STATUS_META[worker.status];
  const running = worker.sessionId !== null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDrawer(worker.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpenDrawer(worker.id);
      }}
      className="group cursor-pointer rounded-lg border border-edge bg-panel-2/60 p-3 transition-colors duration-150 hover:border-edge-2"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <span className="truncate text-sm font-medium text-ink">{worker.name}</span>
        {worker.isLead && (
          <span className="flex items-center gap-1 rounded border border-review/30 bg-review/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-review">
            <Crown className="h-3 w-3" />
            LEAD
          </span>
        )}
        <span className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-1.5 pl-4 text-xs text-muted">
        <span className="text-ink/70">{worker.role}</span>
        <span className="mx-1.5 text-edge-2">·</span>
        <span className="font-mono text-[11px] text-muted">
          {worker.command}
          {worker.args.length > 0 ? ` ${worker.args.join(" ")}` : ""}
        </span>
      </div>

      {worker.exitCode !== null && !running && (
        <div className="mt-1 pl-4 text-[11px] text-danger">
          last exit code {worker.exitCode}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5 opacity-70 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          className={iconButton}
          title="Open terminal"
          aria-label={`Open terminal for ${worker.name}`}
          onClick={(event) => {
            event.stopPropagation();
            if (running) onOpenTerminal(worker.id);
            else onStart(worker.id);
          }}
        >
          {running ? <Terminal className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className={iconButton}
          title={running ? "Stop" : "Stopped"}
          aria-label={`Stop ${worker.name}`}
          disabled={!running}
          onClick={(event) => {
            event.stopPropagation();
            onStop(worker.id);
          }}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={iconButton}
          title="Restart"
          aria-label={`Restart ${worker.name}`}
          disabled={worker.command.length === 0}
          onClick={(event) => {
            event.stopPropagation();
            onRestart(worker.id);
          }}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:border-danger/40 hover:text-danger`}
          title="Remove from team"
          aria-label={`Remove ${worker.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(worker.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
