import { useState } from "react";
import { BrainCircuit, BriefcaseBusiness, CalendarCheck2, Copy, Download, MapPin, RefreshCw, Sparkles, Ticket, TrendingUp } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { generateAIEventPlan, type AICenterBackendMode, type AIEventPlan } from "../lib/aiCenterClient";
import { formatCurrency, formatNumber } from "../utils/finance";

const mockPlan = {
  capacity: 1500,
  eventName: "AI-Powered Gala Night",
  revenueForecast: 4200000,
  suggestedSponsors: ["HDFC Bank", "Reliance Retail", "JK Cement", "Local hospitality partner"],
  suggestedTasks: [
    "Finalize venue layout and access plan",
    "Prepare sponsor proposal deck",
    "Confirm artist green room requirements",
    "Create ticket launch calendar",
    "Assign vendor payment follow-ups",
  ],
  ticketCategories: [
    { name: "Sofa", price: 15000, inventory: 120 },
    { name: "Gold", price: 5000, inventory: 500 },
    { name: "Silver", price: 2500, inventory: 700 },
    { name: "Student Pass", price: 999, inventory: 180 },
  ],
  venue: "Premium indoor auditorium",
  risks: ["Venue hold may expire before confirmation", "Sponsor decisions can take longer than ticket launch timelines", "Premium ticket demand needs strong artist positioning"],
};

export default function AICenter() {
  const [backendMode, setBackendMode] = useState<AICenterBackendMode | "frontend-fallback">("frontend-fallback");
  const [backendMessage, setBackendMessage] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<AIEventPlan>(mockPlan);
  const [planActionMessage, setPlanActionMessage] = useState("");

  const generatePreview = async () => {
    setIsGenerating(true);
    setBackendMessage("");
    setFallbackMessage("");
    setPlanActionMessage("");

    try {
      const response = await generateAIEventPlan(prompt.trim() || "Create a premium EventOS event plan.");
      setPlan(response.plan);
      setBackendMode(response.mode);
      setBackendMessage(response.message);
      setFallbackMessage(response.warning ?? "");
    } catch {
      setPlan(mockPlan);
      setBackendMode("frontend-fallback");
      setFallbackMessage("AI Center backend is not reachable locally yet. Showing the built-in mock preview.");
    } finally {
      setHasPreview(true);
      setIsGenerating(false);
    }
  };

  const copyPlan = async () => {
    const planText = formatPlanForExport(plan);

    try {
      await navigator.clipboard.writeText(planText);
      setPlanActionMessage("Plan copied to clipboard.");
    } catch {
      setPlanActionMessage("Clipboard access was blocked by the browser. Use Download Plan instead.");
    }
  };

  const downloadPlan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([formatPlanForExport(plan)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `event-plan-${today}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setPlanActionMessage("Plan downloaded as a text file.");
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
                Describe the event concept, audience, city, budget, artist, or sponsor goals. Gemini runs only inside the Supabase Edge Function.
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
              This sprint calls the Supabase Edge Function when available. If Gemini is unavailable, EventOS keeps a safe read-only fallback.
            </p>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isGenerating}
              onClick={() => void generatePreview()}
              type="button"
            >
              <Sparkles size={17} />
              {isGenerating ? "Generating..." : "Generate Event Plan"}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">AI plan preview</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Generated Event Plan</h2>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <span className="inline-flex self-start rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium text-blue-100 sm:self-auto">
                {getModeLabel(backendMode)}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 transition hover:border-app-primary/40 hover:bg-app-primary/10 focus:outline-none focus:ring-2 focus:ring-app-primary/35"
                  onClick={() => void copyPlan()}
                  type="button"
                >
                  <Copy size={16} />
                  Copy Plan
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 transition hover:border-app-primary/40 hover:bg-app-primary/10 focus:outline-none focus:ring-2 focus:ring-app-primary/35"
                  onClick={downloadPlan}
                  type="button"
                >
                  <Download size={16} />
                  Download Plan
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGenerating}
                  onClick={() => void generatePreview()}
                  type="button"
                >
                  <RefreshCw className={isGenerating ? "animate-spin" : ""} size={16} />
                  {isGenerating ? "Regenerating..." : "Regenerate Plan"}
                </button>
              </div>
            </div>
          </div>

          {(backendMessage || fallbackMessage) && (
            <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${backendMessage ? "border-app-success/30 bg-app-success/10 text-green-100" : "border-app-warning/30 bg-app-warning/10 text-amber-100"}`}>
              {backendMessage || fallbackMessage}
            </p>
          )}

          {planActionMessage && (
            <p className="mt-4 rounded-lg border border-app-primary/25 bg-app-primary/10 px-3 py-2 text-sm text-blue-100">
              {planActionMessage}
            </p>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <PreviewTile icon={Sparkles} label="Event Name" value={plan.eventName} />
            <PreviewTile icon={MapPin} label="Venue" value={plan.venue} />
            <PreviewTile icon={Ticket} label="Capacity" value={`${formatNumber(plan.capacity)} guests`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <PreviewList title="Ticket Categories" items={plan.ticketCategories.map(formatTicketCategory)} />
            <PreviewTile icon={TrendingUp} label="Revenue Forecast" value={`${formatCurrency(plan.revenueForecast)} projected gross revenue`} />
            <PreviewList title="Suggested Sponsors" items={plan.suggestedSponsors} />
            <PreviewList title="Suggested Tasks" items={plan.suggestedTasks} />
            <PreviewList title="Risks" items={plan.risks} />
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

function formatTicketCategory(category: AIEventPlan["ticketCategories"][number]) {
  return `${category.name} - ${formatCurrency(category.price)} - ${formatNumber(category.inventory)} inventory`;
}

function formatPlanForExport(plan: AIEventPlan) {
  const lines = [
    "EventOS AI Event Plan",
    "",
    `Event Name: ${plan.eventName}`,
    `Venue: ${plan.venue}`,
    `Capacity: ${formatNumber(plan.capacity)} guests`,
    `Revenue Forecast: ${formatCurrency(plan.revenueForecast)}`,
    "",
    "Ticket Categories:",
    ...plan.ticketCategories.map((category) => `- ${category.name}: ${formatCurrency(category.price)}, ${formatNumber(category.inventory)} inventory`),
    "",
    "Suggested Sponsors:",
    ...plan.suggestedSponsors.map((sponsor) => `- ${sponsor}`),
    "",
    "Suggested Tasks:",
    ...plan.suggestedTasks.map((task) => `- ${task}`),
    "",
    "Risks:",
    ...plan.risks.map((risk) => `- ${risk}`),
  ];

  return `${lines.join("\n")}\n`;
}

function getModeLabel(mode: AICenterBackendMode | "frontend-fallback") {
  const labels: Record<AICenterBackendMode | "frontend-fallback", string> = {
    "frontend-fallback": "Frontend fallback",
    "gemini": "Gemini",
    "gemini-fallback": "Gemini fallback",
    "missing-secret": "Missing secret",
    "mock-backend": "Mock backend",
  };
  return labels[mode];
}
