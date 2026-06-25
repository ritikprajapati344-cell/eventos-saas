import {
  ArrowRight,
  Building2,
  Crown,
  FileText,
  Mic,
  Music2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { EventOSData } from "../types";
import { formatCurrency, formatNumber } from "../utils/finance";

interface EventOSAIProps {
  data: EventOSData;
}

const suggestedPrompts = [
  {
    description: "Build a comedy blueprint with tickets, sponsors, timeline, and risk.",
    icon: Mic,
    label: "Create Comedy Show",
    prompt: "Create a 1500-seat comedy show with a premium ticketing plan.",
  },
  {
    description: "Plan ceremonies, vendors, guest flow, and readiness checkpoints.",
    icon: Crown,
    label: "Plan Wedding",
    prompt: "Plan a luxury wedding event with vendor and guest coordination.",
  },
  {
    description: "Shape artist logistics, ticket tiers, sponsors, and launch timing.",
    icon: Music2,
    label: "Plan Concert",
    prompt: "Plan a concert with tiered tickets, sponsor categories, and show-day tasks.",
  },
  {
    description: "Create a business event blueprint for audience, agenda, and sponsors.",
    icon: Building2,
    label: "Corporate Event",
    prompt: "Create a corporate event plan with finance and sponsor strategy.",
  },
  {
    description: "Prepare sponsor categories, outreach priorities, and pitch direction.",
    icon: Users,
    label: "Find Sponsors",
    prompt: "Find sponsor opportunities for my upcoming event.",
  },
  {
    description: "Map revenue targets, ticket tiers, and risk signals.",
    icon: TrendingUp,
    label: "Revenue Strategy",
    prompt: "Create a revenue strategy for an event with ticket and sponsor income.",
  },
];

export default function EventOSAI({ data }: EventOSAIProps) {
  const activeEvents = data.events.filter((event) => !event.archived);
  const expectedRevenue = activeEvents.reduce((sum, event) => sum + event.expectedRevenue, 0);
  const openTasks = data.tasks.filter((task) => task.status !== "Done").length;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-app-primary/25 bg-slate-950/62 p-4 shadow-premium sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />
        <div className="absolute right-0 top-0 hidden h-56 w-56 rounded-full bg-app-primary/10 blur-3xl lg:block" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-100">
              <Sparkles size={14} />
              EventOS AI
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              Your AI Event Operating System
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              What would you like to create today?
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-premium backdrop-blur-xl sm:p-4">
              <label className="sr-only" htmlFor="eventos-ai-command">
                Describe the event you want to create
              </label>
              <textarea
                className="min-h-36 w-full resize-none rounded-lg border border-white/10 bg-slate-950/72 p-4 text-base leading-7 text-white outline-none transition placeholder:text-app-muted focus:border-app-primary/70 focus:ring-2 focus:ring-app-primary/25"
                id="eventos-ai-command"
                placeholder="Describe the event you want to create..."
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-app-muted">
                  UI shell only. Blueprint generation will be connected in a later approved sprint.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-300 opacity-70"
                    disabled
                    type="button"
                  >
                    <Mic size={17} />
                    Voice
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45"
                    type="button"
                  >
                    Generate Blueprint
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium backdrop-blur-xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Workspace Snapshot</p>
            <div className="mt-4 grid gap-3">
              <SnapshotCard label="Active Events" value={formatNumber(activeEvents.length)} />
              <SnapshotCard label="Open Tasks" value={formatNumber(openTasks)} />
              <SnapshotCard label="Expected Revenue" value={formatCurrency(expectedRevenue)} />
            </div>
          </aside>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Suggested prompts</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Start with a proven event command</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suggestedPrompts.map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium transition duration-200 hover:border-app-primary/45 hover:bg-app-primary/10"
                key={item.label}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/10 text-blue-100">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{item.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-app-muted">{item.description}</p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2 text-sm leading-6 text-slate-300">
                  {item.prompt}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-center shadow-premium sm:p-7">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/10 text-blue-100">
          <FileText size={22} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">No blueprints yet.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-app-muted">
          Your AI-generated event blueprints will appear here.
        </p>
      </section>
    </div>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
