type BadgeTone = "blue" | "green" | "amber" | "red" | "slate";

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

const badgeTones: Record<BadgeTone, string> = {
  blue: "bg-app-primary/15 text-blue-200 border-app-primary/25",
  green: "bg-app-success/15 text-green-200 border-app-success/25",
  amber: "bg-app-warning/15 text-amber-200 border-app-warning/25",
  red: "bg-app-danger/15 text-red-200 border-app-danger/25",
  slate: "bg-slate-500/15 text-slate-200 border-slate-400/20",
};

export function StatusBadge({ label, tone = "slate" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${badgeTones[tone]}`}>
      {label}
    </span>
  );
}
