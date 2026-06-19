import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, BriefcaseBusiness, CalendarCheck2, Copy, Download, FilePlus2, MapPin, Plus, RefreshCw, ShieldAlert, Sparkles, Ticket, Trash2, TrendingUp, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import type { ActivitiesDataSource } from "../hooks/useActivitiesData";
import type { EventsDataSource } from "../hooks/useEventsData";
import type { TasksDataSource } from "../hooks/useTasksData";
import type { TicketingDataSource } from "../hooks/useTicketingData";
import { getCopilotInsights } from "../intelligence/eventCopilot";
import { calculateEventWorkspace } from "../intelligence/eventWorkspace";
import { buildExecutiveInsights } from "../intelligence/executiveSummary";
import { generateAIEventPlan, type AICenterBackendMode, type AIEventPlan } from "../lib/aiCenterClient";
import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventItem, EventOSData, EventType, Task, TicketCategory } from "../types";
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
} satisfies AIEventPlan;

interface AICenterProps {
  activitiesData: ActivitiesDataSource;
  data: EventOSData;
  eventsData: EventsDataSource;
  financeTransactions: FinanceTransactionRecord[];
  setData: Dispatch<SetStateAction<EventOSData>>;
  tasksData: TasksDataSource;
  ticketingData: TicketingDataSource;
}

interface EditableDraftTicket {
  id: string;
  inventory: string;
  name: string;
  price: string;
}

interface EditableDraftTask {
  id: string;
  title: string;
}

interface EditableDraft {
  capacity: string;
  city: string;
  eventName: string;
  eventType: EventType;
  expectedRevenue: string;
  tasks: EditableDraftTask[];
  tickets: EditableDraftTicket[];
  venue: string;
}

export default function AICenter({
  activitiesData,
  data,
  eventsData,
  financeTransactions,
  setData,
  tasksData,
  ticketingData,
}: AICenterProps) {
  const navigate = useNavigate();
  const [backendMode, setBackendMode] = useState<AICenterBackendMode | "frontend-fallback">("frontend-fallback");
  const [backendMessage, setBackendMessage] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [prompt, setPrompt] = useState("");
  const [hasPreview, setHasPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<AIEventPlan>(mockPlan);
  const [planActionMessage, setPlanActionMessage] = useState("");
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [draft, setDraft] = useState<EditableDraft | null>(null);
  const [toast, setToast] = useState("");
  const [createdDraftSignature, setCreatedDraftSignature] = useState("");
  const [selectedAnalysisEventId, setSelectedAnalysisEventId] = useState("");
  const [analyzedEventId, setAnalyzedEventId] = useState("");
  const workspaceInsights = useMemo(
    () => buildExecutiveInsights(data, financeTransactions, "the workspace"),
    [data, financeTransactions],
  );
  const analysisEventId = selectedAnalysisEventId || data.events[0]?.id || "";
  const analyzedEvent = useMemo(
    () => data.events.find((event) => event.id === analyzedEventId),
    [analyzedEventId, data.events],
  );
  const analyzedWorkspace = useMemo(
    () => (analyzedEventId ? calculateEventWorkspace(data, analyzedEventId) : null),
    [analyzedEventId, data],
  );
  const eventAnalysis = useMemo(
    () => (analyzedEvent && analyzedWorkspace ? getCopilotInsights(analyzedEvent, analyzedWorkspace) : null),
    [analyzedEvent, analyzedWorkspace],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const generatePreview = async () => {
    setIsGenerating(true);
    setBackendMessage("");
    setFallbackMessage("");
    setPlanActionMessage("");
    setShowDraftPreview(false);
    setCreateError("");
    setCreatedDraftSignature("");
    setCreateSummary("");
    setDraft(null);

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

  const openCreateModal = () => {
    if (!draft) return;
    const validation = validateEditableDraft(draft);
    if (!validation.isValid) {
      setCreateError(validation.errors[0]);
      return;
    }

    setCreateError("");
    setCreateSummary("");
    setShowCreateModal(true);
  };

  const cancelCreate = () => {
    if (isCreatingDraft) return;
    setCreateError("");
    setCreateSummary("");
    setShowCreateModal(false);
  };

  const approveAndCreateEvent = async () => {
    if (!draft) {
      setCreateError("Create a draft preview before creating an event.");
      return;
    }

    const validation = validateEditableDraft(draft);
    if (!validation.isValid) {
      setCreateError(validation.errors[0]);
      return;
    }

    const records = buildDraftEvent(draft);
    const signature = createDraftSignature(records.event, draft);
    const provider = getProviderLabel(backendMode);

    if (isCreatingDraft) return;
    if (createdDraftSignature === signature || hasMatchingDraftEvent(data.events, records.event)) {
      setCreateError("This AI draft already appears to be created. Open the existing event or regenerate a new plan.");
      return;
    }

    setIsCreatingDraft(true);
    setCreateError("");

    try {
      if (eventsData.isSupabaseMode) {
        const createdEvent = await eventsData.createEvent(toEventWriteInput(records.event));

        for (const ticket of records.tickets) {
          await ticketingData.createTicketCategory({
            checkedIn: ticket.checkedIn,
            eventId: createdEvent.id,
            inventory: ticket.inventory,
            name: ticket.name,
            price: ticket.price,
            sold: ticket.sold,
          });
        }

        for (const task of records.tasks) {
          await tasksData.createTask({
            dueDate: task.dueDate,
            eventId: createdEvent.id,
            owner: task.owner,
            priority: task.priority,
            status: task.status,
            title: task.title,
          });
        }

        await recordAICreationActivity(activitiesData, setData, {
          eventId: createdEvent.id,
          eventName: createdEvent.name,
          provider,
          taskCount: records.tasks.length,
          ticketCount: records.tickets.length,
        });

        setCreatedDraftSignature(signature);
        setShowCreateModal(false);
        setCreateSummary(buildSuccessSummary(1, records.tickets.length, records.tasks.length));
        showToast("AI draft event created successfully.");
        navigate(`/events/${createdEvent.id}`);
        return;
      }

      const createdEvent = records.event;
      const tickets = records.tickets.map((ticket) => ({ ...ticket, eventId: createdEvent.id }));
      const tasks = records.tasks.map((task) => ({ ...task, eventId: createdEvent.id }));

      setData((current) => ({
        ...current,
        events: [createdEvent, ...current.events],
        tasks: [...tasks, ...current.tasks],
        ticketCategories: [...tickets, ...current.ticketCategories],
      }));
      await recordAICreationActivity(activitiesData, setData, {
        eventId: createdEvent.id,
        eventName: createdEvent.name,
        provider,
        taskCount: tasks.length,
        ticketCount: tickets.length,
      });

      setCreatedDraftSignature(signature);
      setShowCreateModal(false);
      setCreateSummary(buildSuccessSummary(1, tickets.length, tasks.length));
      showToast("AI draft event created successfully.");
      navigate(`/events/${createdEvent.id}`);
    } catch (error) {
      setCreateError(getErrorMessage(error, "Unable to create the AI draft event. Please try again."));
    } finally {
      setIsCreatingDraft(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Command Center"
        description="Plan events faster with AI-powered event strategy."
      />

      <WorkspaceIntelligence insights={workspaceInsights} />

      <ExistingEventAnalyzer
        analysis={eventAnalysis}
        analyzedEvent={analyzedEvent}
        eventId={analysisEventId}
        events={data.events}
        onAnalyze={() => setAnalyzedEventId(analysisEventId)}
        onChangeEvent={setSelectedAnalysisEventId}
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
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-app-primary/35 bg-app-primary/15 px-3 text-sm font-medium text-blue-100 transition hover:border-app-primary/60 hover:bg-app-primary/20 focus:outline-none focus:ring-2 focus:ring-app-primary/35"
                  onClick={() => {
                    setCreateError("");
                    setDraft(createEditableDraft(plan, prompt));
                    setShowDraftPreview(true);
                  }}
                  type="button"
                >
                  <FilePlus2 size={16} />
                  Create Draft Event
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

      {hasPreview && showDraftPreview && (
        <DraftEventPreview
          createError={createError}
          createSummary={createSummary}
          draft={draft}
          isCreating={isCreatingDraft}
          onOpenCreateModal={openCreateModal}
          onUpdateDraft={setDraft}
          risks={plan.risks}
          sponsorSuggestions={plan.suggestedSponsors}
        />
      )}

      {showCreateModal && (
        <ConfirmCreateModal
          isCreating={isCreatingDraft}
          onCancel={cancelCreate}
          onConfirm={() => void approveAndCreateEvent()}
          draft={draft}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-app-success/30 bg-app-success/15 px-4 py-3 text-sm font-medium text-green-100 shadow-glow">
          {toast}
        </div>
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

function ExistingEventAnalyzer({
  analysis,
  analyzedEvent,
  eventId,
  events,
  onAnalyze,
  onChangeEvent,
}: {
  analysis: ReturnType<typeof getCopilotInsights> | null;
  analyzedEvent?: EventItem;
  eventId: string;
  events: EventItem[];
  onAnalyze: () => void;
  onChangeEvent: (eventId: string) => void;
}) {
  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Analyze Existing Event</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Event Copilot analysis</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Select an event and run the centralized Copilot intelligence layer. This is read-only and creates no records.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <select
            className="dashboard-input h-11 min-w-0 flex-1 lg:w-72"
            disabled={events.length === 0}
            onChange={(event) => onChangeEvent(event.target.value)}
            value={eventId}
          >
            {events.length === 0 ? (
              <option value="">No events available</option>
            ) : events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!eventId}
            onClick={onAnalyze}
            type="button"
          >
            <Sparkles size={17} />
            Run Analysis
          </button>
        </div>
      </div>

      {!analysis || !analyzedEvent ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          {events.length === 0 ? "Create an event first, then return here to analyze it with AI Center." : "Choose an event and run analysis to see Event Copilot insights."}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Analyzing</p>
            <p className="mt-1 break-words text-lg font-semibold text-white">{analyzedEvent.name}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WorkspaceMetric
              helper="Overall event health from current EventOS signals"
              icon={Sparkles}
              title="Event Health Score"
              tone={analysis.readiness.tone}
              value={`${analysis.healthScore}/100`}
            />
            <WorkspaceMetric
              helper={analysis.readiness.summary}
              icon={CalendarCheck2}
              title="Event Readiness Score"
              tone={analysis.readiness.tone}
              value={`${analysis.readiness.score}/100`}
            />
            <WorkspaceMetric
              helper={analysis.revenueAdvisor.suggestedAction}
              icon={TrendingUp}
              title="Revenue Advisor"
              tone={analysis.revenueAdvisor.tone}
              value={formatCurrency(analysis.revenueAdvisor.revenueGap)}
            />
            <WorkspaceMetric
              helper={analysis.ticket.helper}
              icon={Ticket}
              title="Ticket Health"
              tone={analysis.ticket.tone}
              value={analysis.ticket.value}
            />
            <WorkspaceMetric
              helper={`${formatNumber(analysis.taskRiskAdvisor.overdueTasks)} overdue, ${formatNumber(analysis.taskRiskAdvisor.highPriorityPending)} high-priority pending`}
              icon={CalendarCheck2}
              title="Task Risk"
              tone={analysis.taskRiskAdvisor.tone}
              value={analysis.taskRiskAdvisor.riskLevel}
            />
            <WorkspaceMetric
              helper={`Sponsor gap: ${formatCurrency(analysis.sponsorAdvisor.sponsorGap)}`}
              icon={BriefcaseBusiness}
              title="Sponsor Opportunity"
              tone={analysis.sponsorAdvisor.tone}
              value={formatCurrency(analysis.sponsorAdvisor.opportunityValue)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <WorkspaceList title="AI Recommendations" count={analysis.recommendations.length}>
              {analysis.recommendations.map((recommendation) => (
                <li key={recommendation} className="flex gap-2 rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-sm leading-6 text-slate-200">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-primary" />
                  <span className="min-w-0 break-words">{recommendation}</span>
                </li>
              ))}
            </WorkspaceList>
            <WorkspaceList title="Priority Actions" count={analysis.priorityActions.length}>
              {analysis.priorityActions.map((action) => (
                <li key={action} className="flex gap-2 rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-sm leading-6 text-slate-200">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-warning" />
                  <span className="min-w-0 break-words">{action}</span>
                </li>
              ))}
            </WorkspaceList>
          </div>
        </div>
      )}
    </section>
  );
}

function WorkspaceIntelligence({ insights }: { insights: ReturnType<typeof buildExecutiveInsights> }) {
  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Workspace Intelligence</p>
          <h2 className="mt-1 text-xl font-semibold text-white">AI workspace command view</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Read-only executive intelligence from current EventOS workspace data.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium text-blue-100">
          No records are created
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <WorkspaceMetric
          helper={insights.healthSummary}
          icon={Sparkles}
          title="Workspace Health Score"
          tone={insights.healthScore >= 75 ? "success" : insights.healthScore >= 50 ? "warning" : "danger"}
          value={`${insights.healthScore}/100`}
        />
        <WorkspaceMetric
          helper="Expected event revenue not yet covered by current signals"
          icon={TrendingUp}
          title="Revenue At Risk"
          tone={insights.revenueAtRisk > 0 ? "warning" : "success"}
          value={formatCurrency(insights.revenueAtRisk)}
        />
        <WorkspaceMetric
          helper={`${formatNumber(insights.sponsorPipeline.activeDeals)} active deals, ${formatNumber(insights.sponsorPipeline.conversionRate)}% conversion`}
          icon={BriefcaseBusiness}
          title="Sponsor Pipeline Health"
          tone={insights.sponsorPipeline.tone}
          value={`${insights.sponsorPipeline.healthScore}/100`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <WorkspaceList title="Top Risk Events" count={insights.topRiskEvents.length}>
          {insights.topRiskEvents.length === 0 ? (
            <WorkspaceEmpty text="No high-risk events flagged." />
          ) : insights.topRiskEvents.map((event) => (
            <li key={event.id} className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium text-white">{event.name}</p>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${event.riskScore >= 70 ? "border-app-danger/30 bg-app-danger/12 text-red-100" : "border-app-warning/30 bg-app-warning/12 text-amber-100"}`}>
                  {event.riskScore}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-app-muted">{event.reason}</p>
            </li>
          ))}
        </WorkspaceList>

        <WorkspaceList title="Upcoming Critical Tasks" count={insights.criticalTasks.length}>
          {insights.criticalTasks.length === 0 ? (
            <WorkspaceEmpty text="No upcoming critical tasks flagged." />
          ) : insights.criticalTasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium text-white">{task.title}</p>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${task.priority === "High" ? "border-app-danger/30 bg-app-danger/12 text-red-100" : task.priority === "Medium" ? "border-app-warning/30 bg-app-warning/12 text-amber-100" : "border-app-success/30 bg-app-success/12 text-green-100"}`}>
                  {task.priority}
                </span>
              </div>
              <p className="mt-2 text-xs text-app-muted">Due {task.dueDate} - {task.status}</p>
            </li>
          ))}
        </WorkspaceList>

        <WorkspaceList title="AI Executive Summary" count={insights.summary.length}>
          {insights.summary.length === 0 ? (
            <WorkspaceEmpty text="No executive summary signals yet." />
          ) : insights.summary.map((item) => (
            <li key={item} className="flex gap-2 rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-sm leading-6 text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-primary" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </WorkspaceList>
      </div>
    </section>
  );
}

function WorkspaceMetric({
  helper,
  icon: Icon,
  title,
  tone,
  value,
}: {
  helper: string;
  icon: typeof Sparkles;
  title: string;
  tone: "danger" | "primary" | "success" | "warning";
  value: string;
}) {
  const toneClass = tone === "success"
    ? "border-app-success/25 bg-app-success/10 text-green-100"
    : tone === "warning"
      ? "border-app-warning/25 bg-app-warning/10 text-amber-100"
      : tone === "primary"
        ? "border-app-primary/25 bg-app-primary/10 text-blue-100"
        : "border-app-danger/25 bg-app-danger/10 text-red-100";

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{title}</p>
          <p className="mt-2 break-words text-2xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm leading-5 text-app-muted">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function WorkspaceList({ children, count, title }: { children: ReactNode; count: number; title: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{title}</p>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200">{formatNumber(count)}</span>
      </div>
      <ul className="mt-3 space-y-2">{children}</ul>
    </article>
  );
}

function WorkspaceEmpty({ text }: { text: string }) {
  return (
    <li className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-3 text-sm text-app-muted">
      {text}
    </li>
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

function DraftEventPreview({
  createError,
  createSummary,
  draft,
  isCreating,
  onOpenCreateModal,
  onUpdateDraft,
  risks,
  sponsorSuggestions,
}: {
  createError: string;
  createSummary: string;
  draft: EditableDraft | null;
  isCreating: boolean;
  onOpenCreateModal: () => void;
  onUpdateDraft: Dispatch<SetStateAction<EditableDraft | null>>;
  risks: string[];
  sponsorSuggestions: string[];
}) {
  if (!draft) return null;

  const validation = validateEditableDraft(draft);
  const projectedTotal = getDraftTicketRevenue(draft);
  const updateDraft = (nextDraft: EditableDraft) => onUpdateDraft(nextDraft);
  const updateField = (field: keyof Omit<EditableDraft, "tasks" | "tickets">, value: string) => {
    updateDraft({ ...draft, [field]: value });
  };
  const updateTicket = (ticketId: string, field: keyof Omit<EditableDraftTicket, "id">, value: string) => {
    updateDraft({
      ...draft,
      tickets: draft.tickets.map((ticket) => (
        ticket.id === ticketId ? { ...ticket, [field]: value } : ticket
      )),
    });
  };
  const addTicket = () => {
    updateDraft({
      ...draft,
      tickets: [
        ...draft.tickets,
        { id: `draft-ticket-${Date.now()}`, inventory: "0", name: "New Category", price: "0" },
      ],
    });
  };
  const removeTicket = (ticketId: string) => {
    updateDraft({ ...draft, tickets: draft.tickets.filter((ticket) => ticket.id !== ticketId) });
  };
  const updateTask = (taskId: string, title: string) => {
    updateDraft({
      ...draft,
      tasks: draft.tasks.map((task) => (task.id === taskId ? { ...task, title } : task)),
    });
  };
  const addTask = () => {
    updateDraft({
      ...draft,
      tasks: [...draft.tasks, { id: `draft-task-${Date.now()}`, title: "New task" }],
    });
  };
  const removeTask = (taskId: string) => {
    updateDraft({ ...draft, tasks: draft.tasks.filter((task) => task.id !== taskId) });
  };

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">AI draft event preview</p>
          <h2 className="mt-1 text-xl font-semibold text-white">AI Draft Event Preview</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Review and edit before creating. Nothing is saved until you confirm.
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating || !validation.isValid}
            onClick={onOpenCreateModal}
            type="button"
          >
            <FilePlus2 size={17} />
            {isCreating ? "Creating..." : "Approve & Create Event"}
          </button>
          <span className="text-xs text-app-muted">Creates event, tickets, and tasks only.</span>
        </div>
      </div>

      {createError && (
        <p className="mt-4 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 py-2 text-sm text-red-100">
          {createError}
        </p>
      )}

      {createSummary && (
        <p className="mt-4 rounded-lg border border-app-success/30 bg-app-success/10 px-3 py-2 text-sm text-green-100">
          {createSummary}
        </p>
      )}

      {validation.errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-sm text-amber-100">
          <p className="font-medium">Please fix before creating:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DraftField label="Event Name" value={draft.eventName} onChange={(value) => updateField("eventName", value)} />
        <DraftField label="Venue" value={draft.venue} onChange={(value) => updateField("venue", value)} />
        <DraftField label="City" value={draft.city} onChange={(value) => updateField("city", value)} />
        <DraftField label="Capacity" min="1" type="number" value={draft.capacity} onChange={(value) => updateField("capacity", value)} />
        <DraftField label="Expected Revenue" min="0" type="number" value={draft.expectedRevenue} onChange={(value) => updateField("expectedRevenue", value)} />
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-app-muted">Event Type</span>
          <select
            className="dashboard-input mt-2 h-11 w-full"
            onChange={(event) => updateDraft({ ...draft, eventType: event.target.value as EventType })}
            value={draft.eventType}
          >
            {eventTypeOptions.map((eventType) => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Editable Ticket Draft Table</p>
            <p className="mt-1 text-sm text-slate-200">Total projected ticket revenue: {formatCurrency(projectedTotal)}</p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 transition hover:border-app-primary/40 hover:bg-app-primary/10"
            onClick={addTicket}
            type="button"
          >
            <Plus size={16} />
            Add Ticket
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.1em] text-app-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
                <th className="px-4 py-3 font-medium">Projected Revenue</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-200">
              {draft.tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-4 py-3">
                    <input
                      className="dashboard-input h-10 w-full"
                      onChange={(event) => updateTicket(ticket.id, "name", event.target.value)}
                      value={ticket.name}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="dashboard-input h-10 w-full"
                      min="0"
                      onChange={(event) => updateTicket(ticket.id, "price", event.target.value)}
                      type="number"
                      value={ticket.price}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="dashboard-input h-10 w-full"
                      min="0"
                      onChange={(event) => updateTicket(ticket.id, "inventory", event.target.value)}
                      type="number"
                      value={ticket.inventory}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{formatCurrency(getTicketDraftRevenue(ticket))}</td>
                  <td className="px-4 py-3">
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 text-xs font-medium text-red-100 transition hover:bg-app-danger/15"
                      onClick={() => removeTicket(ticket.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <PreviewList title="Sponsor Suggestions" items={sponsorSuggestions} />
        <EditableTaskList
          onAdd={addTask}
          onRemove={removeTask}
          onUpdate={updateTask}
          tasks={draft.tasks}
        />
        <PreviewList title="Risks" items={risks} />
      </div>

      <div className="mt-5 rounded-lg border border-app-warning/25 bg-app-warning/10 p-4 text-sm leading-6 text-amber-100">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0" size={18} />
          <p>
            User approval is required before creation. This creates only the edited event draft, ticket categories, and task checklist. Sponsors remain suggestions.
          </p>
        </div>
      </div>
    </section>
  );
}

function ConfirmCreateModal({
  draft,
  isCreating,
  onCancel,
  onConfirm,
}: {
  draft: EditableDraft | null;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!draft) return null;

  const records = buildDraftEvent(draft);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Confirm AI draft creation</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Create this event in EventOS?</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              EventOS will create one event, {formatNumber(draft.tickets.length)} ticket categories, and {formatNumber(draft.tasks.length)} tasks.
            </p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:border-app-primary/40 hover:text-white"
            disabled={isCreating}
            onClick={onCancel}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <SummaryItem label="Event" value={records.event.name} />
            <SummaryItem label="Venue" value={records.event.venue} />
            <SummaryItem label="City" value={records.event.city || "Not specified"} />
            <SummaryItem label="Type" value={records.event.eventType} />
            <SummaryItem label="Capacity" value={formatNumber(records.event.capacity)} />
            <SummaryItem label="Expected Revenue" value={formatCurrency(records.event.expectedRevenue)} />
          </dl>
        </div>

        <div className="mt-5 rounded-lg border border-app-warning/25 bg-app-warning/10 p-3 text-sm leading-6 text-amber-100">
          Sponsors, artists, vendors, and finance records will not be created in this sprint.
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            onClick={onConfirm}
            type="button"
          >
            <FilePlus2 size={17} />
            {isCreating ? "Creating..." : "Confirm & Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-white">{value}</dd>
    </div>
  );
}

function DraftField({
  label,
  min,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  min?: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <input
        className="dashboard-input mt-2 h-11 w-full"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function EditableTaskList({
  onAdd,
  onRemove,
  onUpdate,
  tasks,
}: {
  onAdd: () => void;
  onRemove: (taskId: string) => void;
  onUpdate: (taskId: string, title: string) => void;
  tasks: EditableDraftTask[];
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Editable Task Checklist</p>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-100 transition hover:border-app-primary/40 hover:bg-app-primary/10"
          onClick={onAdd}
          type="button"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex gap-2">
            <input
              className="dashboard-input h-10 min-w-0 flex-1"
              onChange={(event) => onUpdate(task.id, event.target.value)}
              value={task.title}
            />
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-app-danger/30 bg-app-danger/10 text-red-100 transition hover:bg-app-danger/15"
              onClick={() => onRemove(task.id)}
              title="Remove task"
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-app-muted">
            No tasks in this draft yet.
          </p>
        )}
      </div>
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
    "fallback": "Safe fallback",
    "frontend-fallback": "Frontend fallback",
    "gemini": "Gemini",
    "gemini-backup": "Gemini backup",
    "gemini-fallback": "Gemini fallback",
    "groq": "Groq",
    "missing-secret": "Missing secret",
    "mock-backend": "Mock backend",
  };
  return labels[mode];
}

const eventTypeOptions: EventType[] = [
  "Comedy Show",
  "Concert",
  "Corporate Event",
  "College Fest",
  "Conference",
  "Custom",
];

function deriveEventType(plan: AIEventPlan, prompt: string) {
  const text = `${plan.eventName} ${plan.venue} ${prompt}`.toLowerCase();
  const eventTypes = [
    { label: "Comedy Show", terms: ["comedy", "comedian", "stand-up", "standup"] },
    { label: "Concert", terms: ["concert", "music", "singer", "band", "dj"] },
    { label: "Corporate Event", terms: ["corporate", "conference", "summit", "offsite"] },
    { label: "College Fest", terms: ["college", "campus", "student", "fest"] },
    { label: "Conference", terms: ["conference", "seminar", "expo", "workshop"] },
    { label: "Custom", terms: ["live", "show", "gala", "festival"] },
  ];

  return eventTypes.find((type) => type.terms.some((term) => text.includes(term)))?.label ?? "Custom";
}

function deriveCity(plan: AIEventPlan, prompt: string) {
  const text = `${plan.eventName} ${plan.venue} ${prompt}`.toLowerCase();
  const cities = [
    "Ahmedabad",
    "Bengaluru",
    "Chennai",
    "Delhi",
    "Gandhidham",
    "Hyderabad",
    "Jaipur",
    "Kolkata",
    "Mumbai",
    "Pune",
    "Rajkot",
    "Surat",
    "Vadodara",
  ];

  return cities.find((city) => text.includes(city.toLowerCase())) ?? "Not specified";
}

function createEditableDraft(plan: AIEventPlan, prompt: string): EditableDraft {
  const city = deriveCity(plan, prompt);
  return {
    capacity: String(Math.max(1, Math.round(plan.capacity))),
    city: city === "Not specified" ? "" : city,
    eventName: plan.eventName.trim() || "AI Draft Event",
    eventType: toEventType(deriveEventType(plan, prompt)),
    expectedRevenue: String(Math.max(0, Math.round(plan.revenueForecast || getProjectedTicketRevenue(plan)))),
    tasks: plan.suggestedTasks.map((task, index) => ({
      id: `draft-task-${Date.now()}-${index}`,
      title: task.trim() || `AI task ${index + 1}`,
    })),
    tickets: plan.ticketCategories.map((category, index) => ({
      id: `draft-ticket-${Date.now()}-${index}`,
      inventory: String(Math.max(0, Math.round(category.inventory))),
      name: category.name.trim() || `Category ${index + 1}`,
      price: String(Math.max(0, Math.round(category.price))),
    })),
    venue: plan.venue.trim() || "Venue to be confirmed",
  };
}

function buildDraftEvent(draft: EditableDraft) {
  const idSeed = Date.now();
  const eventId = `ai-event-${idSeed}`;
  const event: EventItem = {
    archived: false,
    capacity: Math.max(1, Math.round(toDraftNumber(draft.capacity))),
    city: draft.city.trim(),
    date: getDefaultEventDate(),
    eventTime: "19:00",
    eventType: draft.eventType,
    expectedExpense: 0,
    expectedRevenue: Math.max(0, Math.round(toDraftNumber(draft.expectedRevenue))),
    files: [],
    id: eventId,
    mainArtist: "",
    name: draft.eventName.trim(),
    notes: "Created from AI Center draft preview.",
    owner: "AI Center",
    progress: 0,
    status: "Planning",
    ticketPrice: 0,
    ticketsSold: 0,
    venue: draft.venue.trim(),
  };

  const tickets: TicketCategory[] = draft.tickets.map((category, index) => ({
    checkedIn: 0,
    eventId,
    id: `ai-ticket-${idSeed}-${index}`,
    inventory: Math.max(0, Math.round(toDraftNumber(category.inventory))),
    name: category.name.trim() || `Category ${index + 1}`,
    price: Math.max(0, Math.round(toDraftNumber(category.price))),
    sold: 0,
    status: "Not Started",
  }));

  const tasks: Task[] = draft.tasks.map((task, index) => ({
    dueDate: getTaskDueDate(index),
    eventId,
    id: `ai-task-${idSeed}-${index}`,
    owner: "AI Center",
    priority: index < 2 ? "High" : index < 5 ? "Medium" : "Low",
    status: "Open",
    title: task.title.trim() || `AI task ${index + 1}`,
  }));

  return { event, tasks, tickets };
}

function toEventWriteInput(event: EventItem) {
  return {
    archived: event.archived,
    capacity: event.capacity,
    city: event.city,
    date: event.date,
    eventTime: event.eventTime,
    eventType: event.eventType,
    expectedExpense: event.expectedExpense,
    expectedRevenue: event.expectedRevenue,
    mainArtist: event.mainArtist,
    name: event.name,
    notes: event.notes,
    owner: event.owner,
    status: event.status,
    venue: event.venue,
  };
}

function createDraftSignature(event: EventItem, draft: EditableDraft) {
  return [
    event.name,
    event.venue,
    event.city,
    event.capacity,
    event.eventType,
    draft.tickets.map((category) => `${category.name}:${category.price}:${category.inventory}`).join("|"),
  ].join("::").toLowerCase();
}

function hasMatchingDraftEvent(events: EventItem[], draftEvent: EventItem) {
  return events.some((event) => (
    normalizeText(event.name) === normalizeText(draftEvent.name)
    && normalizeText(event.venue) === normalizeText(draftEvent.venue)
    && Number(event.capacity) === Number(draftEvent.capacity)
  ));
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getProjectedTicketRevenue(plan: AIEventPlan) {
  return plan.ticketCategories.reduce((sum, category) => sum + category.price * category.inventory, 0);
}

function getDraftTicketRevenue(draft: EditableDraft) {
  return draft.tickets.reduce((sum, ticket) => sum + getTicketDraftRevenue(ticket), 0);
}

function getTicketDraftRevenue(ticket: EditableDraftTicket) {
  return Math.max(0, toDraftNumber(ticket.price)) * Math.max(0, toDraftNumber(ticket.inventory));
}

function validateEditableDraft(draft: EditableDraft) {
  const errors: string[] = [];

  if (!draft.eventName.trim()) errors.push("Event name is required.");
  if (!draft.venue.trim()) errors.push("Venue is required.");
  if (toDraftNumber(draft.capacity) <= 0) errors.push("Capacity must be greater than 0.");
  if (draft.tickets.length === 0) errors.push("At least one ticket category is required.");

  draft.tickets.forEach((ticket, index) => {
    const label = ticket.name.trim() || `Ticket category ${index + 1}`;
    if (!ticket.name.trim()) errors.push(`Ticket category ${index + 1} name is required.`);
    if (toDraftNumber(ticket.price) < 0) errors.push(`${label} price must be 0 or more.`);
    if (toDraftNumber(ticket.inventory) < 0) errors.push(`${label} inventory must be 0 or more.`);
  });

  return {
    errors,
    isValid: errors.length === 0,
  };
}

function toDraftNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : -1;
}

function getDefaultEventDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function getTaskDueDate(index: number) {
  const date = new Date();
  date.setDate(date.getDate() + Math.min(index + 1, 14));
  return date.toISOString().slice(0, 10);
}

function toEventType(value: string): EventType {
  const allowedTypes: EventType[] = [
    "Comedy Show",
    "Concert",
    "Corporate Event",
    "College Fest",
    "Conference",
    "Custom",
  ];
  return allowedTypes.includes(value as EventType) ? value as EventType : "Custom";
}

async function recordAICreationActivity(
  activitiesData: ActivitiesDataSource,
  setData: Dispatch<SetStateAction<EventOSData>>,
  details: {
    eventId: string;
    eventName: string;
    provider: string;
    taskCount: number;
    ticketCount: number;
  },
) {
  const message = buildActivityMessage(
    details.eventName,
    details.provider,
    details.ticketCount,
    details.taskCount,
  );
  const activity = {
    entity: "AI Center",
    entityId: details.eventId,
    eventId: details.eventId,
    message,
    metadata: {
      action: "ai-created",
      provider: details.provider,
      source: "ai-center",
      taskCount: details.taskCount,
      ticketCategoryCount: details.ticketCount,
    },
    type: "Event" as const,
  };

  if (activitiesData.isSupabaseMode) {
    try {
      await activitiesData.createActivity(activity);
    } catch (error) {
      throw new Error(`Event was created, but activity logging failed: ${getErrorMessage(error, "Unable to save activity.")}`);
    }
    return;
  }

  setData((current) => ({
    ...current,
    activities: [{
      ...activity,
      id: `activity-${Date.now()}`,
      time: "Just now",
    }, ...current.activities],
  }));
}

function buildActivityMessage(eventName: string, provider: string, ticketCount: number, taskCount: number) {
  return `AI Center created event ${eventName} using ${provider} (${ticketCount} ticket categories, ${taskCount} tasks)`;
}

function buildSuccessSummary(eventCount: number, ticketCount: number, taskCount: number) {
  return `Created ${eventCount} event, ${ticketCount} ticket categories, and ${taskCount} tasks.`;
}

function getProviderLabel(mode: AICenterBackendMode | "frontend-fallback") {
  const labels: Record<AICenterBackendMode | "frontend-fallback", string> = {
    "fallback": "Safe fallback",
    "frontend-fallback": "Frontend fallback",
    "gemini": "Gemini",
    "gemini-backup": "Gemini backup",
    "gemini-fallback": "Gemini fallback",
    "groq": "Groq",
    "missing-secret": "Missing secret",
    "mock-backend": "Mock backend",
  };
  return labels[mode];
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}
