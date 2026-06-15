import { CalendarDays, Globe2 } from "lucide-react";
import type { EventItem } from "../types";

interface EventContextChipProps {
  className?: string;
  event?: EventItem;
}

export function EventContextChip({ className = "", event }: EventContextChipProps) {
  if (!event) {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-400/20 bg-slate-500/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 ${className}`}
        title="This record is not assigned to a specific event."
      >
        <Globe2 className="shrink-0" size={12} />
        <span className="truncate">Workspace-wide</span>
      </span>
    );
  }

  const eventDate = formatEventDate(event.date);
  const tooltip = [event.name, eventDate, event.venue].filter(Boolean).join(" - ");

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-app-primary/25 bg-app-primary/12 px-2.5 py-1 text-[11px] font-medium text-blue-100 ${className}`}
      title={tooltip}
    >
      <CalendarDays className="shrink-0 text-app-primary" size={12} />
      <span className="truncate">{event.name}</span>
    </span>
  );
}

function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
