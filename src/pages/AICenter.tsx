import { useState } from "react";
import { BrainCircuit, BriefcaseBusiness, CalendarCheck2, MapPin, Sparkles, Ticket, TrendingUp } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const mockPlan = {
  capacity: "1,500 guests",
  eventName: "AI-Powered Gala Night",
  revenueForecast: "INR 42,00,000 projected gross revenue",
  suggestedSponsors: ["HDFC Bank", "Reliance Retail", "JK Cement", "Local hospitality partner"],
  suggestedTasks: [
    "Finalize venue layout and access plan",
    "Prepare sponsor proposal deck",
    "Confirm artist green room requirements",
    "Create ticket launch calendar",
    "Assign vendor payment follow-ups",
  ],
  ticketCategories: ["Sofa - INR 15,000", "Gold - INR 5,000", "Silver - INR 2,500", "Student Pass - INR 999"],
  venue: "Premium indoor auditorium",
};

export default function AICenter() {
  const [prompt, setPrompt] = useState("");
  const [hasPreview, setHasPreview] = useState(false);

  const generatePreview = () => {
    setHasPreview(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Command Center"
        description="Plan events faster with AI-powered event strategy."
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="glass-panel rounded-lg p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/15 text-blue-200">
              <BrainCircuit size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Event Planning Prompt</h2>
              <p className="mt-1 text-sm leading-6 text-app-muted">
                Describe the event concept, audience, city, budget, artist, or sponsor goals. V2 AI integration is not connected yet.
              </p>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-300">Event brief</span>
            <textarea
              className="dashboard-input mt-2 min-h-[220px] w-full resize-y py-3 leading-6 sm:min-h-[280px]"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe your event..."
              value={prompt}
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-app-muted">
              This sprint shows a static mock preview only. No AI API request is made.
            </p>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45"
              onClick={generatePreview}
              type="button"
            >
              <Sparkles size={17} />
              Generate Event Plan
            </button>
          </div>
        </div>

        <aside className="glass-panel rounded-lg p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">V2 Foundation</p>
          <h2 className="mt-2 text-lg font-semibold text-white">What this page will power</h2>
          <div className="mt-4 grid gap-3">
            <Capability icon={CalendarCheck2} title="Planning agent" description="Generate event plans, timelines, and task checklists." />
            <Capability icon={TrendingUp} title="Revenue strategy" description="Suggest ticket tiers, sponsor angles, and forecast ideas." />
            <Capability icon={BriefcaseBusiness} title="Sponsor targeting" description="Identify sponsor categories and outreach priorities." />
          </div>
        </aside>
      </section>

      {hasPreview && (
        <section className="glass-panel rounded-lg p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Static mock preview</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Generated Event Plan</h2>
            </div>
            <span className="inline-flex self-start rounded-full border border-app-warning/30 bg-app-warning/10 px-3 py-1 text-xs font-medium text-amber-100 sm:self-auto">
              Mock only
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <PreviewTile icon={Sparkles} label="Event Name" value={mockPlan.eventName} />
            <PreviewTile icon={MapPin} label="Venue" value={mockPlan.venue} />
            <PreviewTile icon={Ticket} label="Capacity" value={mockPlan.capacity} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <PreviewList title="Ticket Categories" items={mockPlan.ticketCategories} />
            <PreviewTile icon={TrendingUp} label="Revenue Forecast" value={mockPlan.revenueForecast} />
            <PreviewList title="Suggested Sponsors" items={mockPlan.suggestedSponsors} />
            <PreviewList title="Suggested Tasks" items={mockPlan.suggestedTasks} />
          </div>
        </section>
      )}
    </div>
  );
}

function Capability({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof CalendarCheck2;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/10 text-blue-200">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-app-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/10 text-blue-200">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
          <p className="mt-2 break-words text-base font-semibold text-white">{value}</p>
        </div>
      </div>
    </article>
  );
}

function PreviewList({ items, title }: { items: string[]; title: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-200">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-primary" />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
