import { CalendarRange } from "lucide-react";
import type { EventItem } from "../types";

export const ALL_EVENTS_FILTER = "all";
export const UNASSIGNED_EVENTS_FILTER = "unassigned";

interface EventFilterProps {
  events: EventItem[];
  onChange: (value: string) => void;
  value: string;
}

export function EventFilter({ events, onChange, value }: EventFilterProps) {
  const sortedEvents = [...events].sort((left, right) => {
    if (left.archived !== right.archived) return Number(left.archived) - Number(right.archived);
    return left.date.localeCompare(right.date) || left.name.localeCompare(right.name);
  });

  return (
    <div className="glass-panel flex min-w-0 flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/12 text-blue-200">
          <CalendarRange size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Event context</p>
          <p className="mt-0.5 text-xs text-app-muted">Filter this workspace view by linked event.</p>
        </div>
      </div>

      <select
        aria-label="Filter by event"
        className="dashboard-input h-10 w-full min-w-0 text-sm sm:w-[min(100%,22rem)]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value={ALL_EVENTS_FILTER}>All events</option>
        <option value={UNASSIGNED_EVENTS_FILTER}>Workspace-wide / Unassigned</option>
        {sortedEvents.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name} - {formatEventDate(event.date)}{event.archived ? " (Archived)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export function matchesEventFilter(eventId: string | undefined, filter: string) {
  if (filter === ALL_EVENTS_FILTER) return true;
  if (filter === UNASSIGNED_EVENTS_FILTER) return !eventId;
  return eventId === filter;
}

function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Date TBC";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
