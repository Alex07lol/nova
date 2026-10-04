import { motion } from "framer-motion";
import { LayoutGrid, Plus, X } from "lucide-react";
import { COMMAND_CENTER_TAB, selectUnreadMessageCount, useTeamStore } from "../../stores/team-store";
import { STATUS_META } from "../../lib/status";

export function TabStrip({ onAddWorker }: { onAddWorker: () => void }) {
  const workers = useTeamStore((state) => state.workers);
  const openTabs = useTeamStore((state) => state.openTabs);
  const activeTab = useTeamStore((state) => state.activeTab);
  const setActiveTab = useTeamStore((state) => state.setActiveTab);
  const closeTab = useTeamStore((state) => state.closeTab);
  const unreadMessages = useTeamStore(selectUnreadMessageCount);

  const tabbedWorkers = openTabs
    .map((id) => workers.find((worker) => worker.id === id))
    .filter((worker): worker is NonNullable<typeof worker> => worker !== undefined);

  const tabClass = (active: boolean) =>
    `relative flex h-9 min-w-0 items-center gap-2 border-b-2 px-3 text-xs transition-colors duration-150 ${
      active
        ? "border-accent text-ink"
        : "border-transparent text-muted hover:border-edge-2 hover:text-ink/80"
    }`;

  return (
    <nav
      className="flex h-9 shrink-0 items-stretch border-b border-edge bg-panel px-1"
      aria-label="Terminal tabs"
    >
      <button
        type="button"
        onClick={() => setActiveTab(COMMAND_CENTER_TAB)}
        className={tabClass(activeTab === COMMAND_CENTER_TAB)}
      >
        <LayoutGrid className="h-3.5 w-3.5 text-faint" />
        <span className="font-semibold tracking-[0.12em]">COMMAND CENTER</span>
        {unreadMessages > 0 && (
          <span
            title={`${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`}
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-warn/15 px-1 text-[10px] font-semibold text-warn"
          >
            {unreadMessages > 9 ? "9+" : unreadMessages}
          </span>
        )}
        {activeTab === COMMAND_CENTER_TAB && (
          <motion.span
            layoutId="tab-indicator"
            className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
          />
        )}
      </button>

      {tabbedWorkers.map((worker) => {
        const active = activeTab === worker.id;
        return (
          <button
            key={worker.id}
            type="button"
            onClick={() => setActiveTab(worker.id)}
            className={`${tabClass(active)} group`}
            title={`${worker.name} — ${worker.role}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[worker.status].dot}`} />
            <span className="max-w-[140px] truncate font-mono text-[11px] uppercase tracking-wide">
              {worker.name}
            </span>
            <span
              role="button"
              aria-label={`Close ${worker.name} terminal tab`}
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(worker.id);
              }}
              className="ml-1 hidden h-4 w-4 items-center justify-center rounded text-faint hover:bg-panel-2 hover:text-ink group-hover:flex"
            >
              <X className="h-3 w-3" />
            </span>
            {active && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddWorker}
        aria-label="Add team member"
        title="Add team member"
        className="ml-1 flex h-9 w-9 items-center justify-center text-faint transition-colors duration-150 hover:text-accent"
      >
        <Plus className="h-4 w-4" />
      </button>
    </nav>
  );
}
