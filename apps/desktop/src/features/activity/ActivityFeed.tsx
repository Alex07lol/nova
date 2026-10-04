import { useEffect, useRef } from "react";
import type { ActivityEvent } from "../../lib/types";
import { eventColor } from "../../lib/status";

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-faint">
        Activity will appear here as workers start, message, and finish work.
      </p>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-1">
      <ul className="space-y-0.5">
        {events.map((event) => (
          <li key={event.id} className="flex items-baseline gap-2 rounded px-1 py-0.5 text-xs hover:bg-panel-2/50">
            <span className="shrink-0 font-mono text-[10px] text-faint">
              {formatTime(event.timestamp)}
            </span>
            <span className={`shrink-0 font-medium ${eventColor(event.type)}`}>
              {event.actor}
            </span>
            <span className="min-w-0 break-words text-ink/80">{event.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
