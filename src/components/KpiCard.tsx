import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger";
}

const tones = {
  primary: "bg-app-primary/14 text-blue-200 border-app-primary/30",
  success: "bg-app-success/14 text-green-200 border-app-success/30",
  warning: "bg-app-warning/14 text-amber-200 border-app-warning/30",
  danger: "bg-app-danger/14 text-red-200 border-app-danger/30",
};

export function KpiCard({ title, value, helper, icon: Icon, tone = "primary" }: KpiCardProps) {
  return (
    <article className="glass-panel min-h-[126px] min-w-0 animate-fade-up rounded-lg p-4 transition duration-200 hover:-translate-y-1 hover:border-white/20">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-app-muted">{title}</p>
          <p className="mt-2 truncate text-lg font-semibold tracking-normal text-white xl:text-xl">{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{helper}</p>
    </article>
  );
}
