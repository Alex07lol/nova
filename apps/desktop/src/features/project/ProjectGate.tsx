import { useState } from "react";
import { FolderOpen, Terminal } from "lucide-react";
import * as ipc from "../../lib/ipc";
import { useTeamStore } from "../../stores/team-store";

const KNOWN_TOOLS = ["claude", "codex", "agy", "opencode", "aider", "gemini", "custom…"];

export function ProjectGate() {
  const openProject = useTeamStore((state) => state.openProject);
  const error = useTeamStore((state) => state.error);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const path = await ipc.pickProjectFolder();
      if (path) await openProject(path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-base p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-edge-2 bg-gradient-to-br from-accent/25 to-accent-2/25 shadow-lg shadow-accent/5">
        <Terminal className="h-7 w-7 text-accent" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
        Build with your AI team.
      </h1>
      <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-muted">
        Connect your terminal coding tools and orchestrate them from one
        workspace. One command center, real interactive terminals, shared
        tasks and state.
      </p>

      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="mt-8 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 px-6 py-3 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent/25 disabled:opacity-50"
      >
        <FolderOpen className="h-4 w-4" />
        {busy ? "Opening…" : "Open Project"}
      </button>

      {error && (
        <p className="mt-4 max-w-md rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-center text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
        {KNOWN_TOOLS.map((tool) => (
          <span
            key={tool}
            className="rounded-md border border-edge bg-panel px-2.5 py-1 font-mono text-[11px] text-faint"
          >
            {tool}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-faint/70">
        Any interactive terminal program works — the orchestrator never replaces your tools.
      </p>
    </div>
  );
}
