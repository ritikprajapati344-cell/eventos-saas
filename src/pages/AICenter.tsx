import { useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, BriefcaseBusiness, CalendarCheck2, Copy, Download, FilePlus2, MapPin, RefreshCw, ShieldAlert, Sparkles, Ticket, TrendingUp, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import type { EventsDataSource } from "../hooks/useEventsData";
import type { TasksDataSource } from "../hooks/useTasksData";
import type { TicketingDataSource } from "../hooks/useTicketingData";
import { generateAIEventPlan, type AICenterBackendMode, type AIEventPlan } from "../lib/aiCenterClient";
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
  data: EventOSData;
  eventsData: EventsDataSource;
  setData: Dispatch<SetStateAction<EventOSData>>;
  tasksData: TasksDataSource;
  ticketingData: TicketingDataSource;
}

export default function AICenter({
  data,
  eventsData,
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
  const [toast, setToast] = useState("");
  const [createdDraftSignature, setCreatedDraftSignature] = useState("");

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
    setCreateError("");
    setShowCreateModal(true);
  };

  const cancelCreate = () => {
    if (isCreatingDraft) return;
    setCreateError("");
    setShowCreateModal(false);
  };

  const approveAndCreateEvent = async () => {
    const draft = buildDraftEvent(plan, prompt);
    const signature = createDraftSignature(draft.event, plan);

    if (isCreatingDraft) return;
    if (createdDraftSignature === signature || hasMatchingDraftEvent(data.events, draft.event)) {
      setCreateError("This AI draft already appears to be created. Open the existing event or regenerate a new plan.");
      return;
    }

    setIsCreatingDraft(true);
    setCreateError("");

    try {
      if (eventsData.isSupabaseMode) {
        const createdEvent = await eventsData.createEvent(toEventWriteInput(draft.event));

        for (const ticket of draft.tickets) {
          await ticketingData.createTicketCategory({
            checkedIn: ticket.checkedIn,
            eventId: createdEvent.id,
            inventory: ticket.inventory,
            name: ticket.name,
            price: ticket.price,
            sold: ticket.sold,
          });
        }

        for (const task of draft.tasks) {
          await tasksData.createTask({
            dueDate: task.dueDate,
            eventId: createdEvent.id,
            owner: task.owner,
            priority: task.priority,
            status: task.status,
            title: task.title,
          });
        }

        setCreatedDraftSignature(signature);
        setShowCreateModal(false);
        showToast("AI draft event created successfully.");
        navigate(`/events/${createdEvent.id}`);
        return;
      }

      const createdEvent = draft.event;
      const tickets = draft.tickets.map((ticket) => ({ ...ticket, eventId: createdEvent.id }));
      const tasks = draft.tasks.map((task) => ({ ...task, eventId: createdEvent.id }));

      setData((current) => ({
        ...current,
        events: [createdEvent, ...current.events],
        tasks: [...tasks, ...current.tasks],
        ticketCategories: [...tickets, ...current.ticketCategories],
      }));

      setCreatedDraftSignature(signature);
      setShowCreateModal(false);
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
          isCreating={isCreatingDraft}
          onOpenCreateModal={openCreateModal}
          plan={plan}
          prompt={prompt}
        />
      )}

      {showCreateModal && (
        <ConfirmCreateModal
          isCreating={isCreatingDraft}
          onCancel={cancelCreate}
          onConfirm={() => void approveAndCreateEvent()}
          plan={plan}
          prompt={prompt}
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
  isCreating,
  onOpenCreateModal,
  plan,
  prompt,
}: {
  createError: string;
  isCreating: boolean;
  onOpenCreateModal: () => void;
  plan: AIEventPlan;
  prompt: string;
}) {
  const eventType = deriveEventType(plan, prompt);
  const city = deriveCity(plan, prompt);
  const projectedTotal = plan.ticketCategories.reduce((sum, category) => sum + category.price * category.inventory, 0);

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">AI draft event preview</p>
          <h2 className="mt-1 text-xl font-semibold text-white">AI Draft Event Preview</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Review how this AI plan would map into EventOS. This is a read-only preview and does not create any records.
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
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

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <PreviewTile icon={Sparkles} label="Event Name" value={plan.eventName} />
        <PreviewTile icon={MapPin} label="Venue" value={plan.venue} />
        <PreviewTile icon={Ticket} label="Capacity" value={`${formatNumber(plan.capacity)} guests`} />
        <PreviewTile icon={CalendarCheck2} label="Event Type" value={eventType} />
        <PreviewTile icon={MapPin} label="City" value={city} />
        <PreviewTile icon={TrendingUp} label="Ticket Potential" value={`${formatCurrency(projectedTotal)} if fully sold`} />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Ticket Draft Table</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.1em] text-app-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
                <th className="px-4 py-3 font-medium">Projected Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-200">
              {plan.ticketCategories.map((category) => (
                <tr key={`${category.name}-${category.price}-${category.inventory}`}>
                  <td className="px-4 py-3 font-medium text-white">{category.name}</td>
                  <td className="px-4 py-3">{formatCurrency(category.price)}</td>
                  <td className="px-4 py-3">{formatNumber(category.inventory)}</td>
                  <td className="px-4 py-3">{formatCurrency(category.price * category.inventory)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <PreviewList title="Sponsor Suggestions" items={plan.suggestedSponsors} />
        <PreviewList title="Task Checklist" items={plan.suggestedTasks} />
        <PreviewList title="Risks" items={plan.risks} />
      </div>

      <div className="mt-5 rounded-lg border border-app-warning/25 bg-app-warning/10 p-4 text-sm leading-6 text-amber-100">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0" size={18} />
          <p>
            User approval is required before creation. Sprint 9 creates only the event, ticket categories, and task checklist. Sponsors remain suggestions.
          </p>
        </div>
      </div>
    </section>
  );
}

function ConfirmCreateModal({
  isCreating,
  onCancel,
  onConfirm,
  plan,
  prompt,
}: {
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  plan: AIEventPlan;
  prompt: string;
}) {
  const draft = buildDraftEvent(plan, prompt);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Confirm AI draft creation</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Create this event in EventOS?</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              EventOS will create one event, {formatNumber(plan.ticketCategories.length)} ticket categories, and {formatNumber(plan.suggestedTasks.length)} tasks.
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
            <SummaryItem label="Event" value={draft.event.name} />
            <SummaryItem label="Venue" value={draft.event.venue} />
            <SummaryItem label="City" value={draft.event.city || "Not specified"} />
            <SummaryItem label="Type" value={draft.event.eventType} />
            <SummaryItem label="Capacity" value={formatNumber(draft.event.capacity)} />
            <SummaryItem label="Expected Revenue" value={formatCurrency(draft.event.expectedRevenue)} />
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

function deriveEventType(plan: AIEventPlan, prompt: string) {
  const text = `${plan.eventName} ${plan.venue} ${prompt}`.toLowerCase();
  const eventTypes = [
    { label: "Comedy Show", terms: ["comedy", "comedian", "stand-up", "standup"] },
    { label: "Concert", terms: ["concert", "music", "singer", "band", "dj"] },
    { label: "Corporate Event", terms: ["corporate", "conference", "summit", "offsite"] },
    { label: "College Fest", terms: ["college", "campus", "student", "fest"] },
    { label: "Conference", terms: ["conference", "seminar", "expo", "workshop"] },
    { label: "Live Event", terms: ["live", "show", "gala", "festival"] },
  ];

  return eventTypes.find((type) => type.terms.some((term) => text.includes(term)))?.label ?? "Live Event";
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

function buildDraftEvent(plan: AIEventPlan, prompt: string) {
  const idSeed = Date.now();
  const eventId = `ai-event-${idSeed}`;
  const city = deriveCity(plan, prompt);
  const event: EventItem = {
    archived: false,
    capacity: Math.max(1, Math.round(plan.capacity)),
    city: city === "Not specified" ? "" : city,
    date: getDefaultEventDate(),
    eventTime: "19:00",
    eventType: toEventType(deriveEventType(plan, prompt)),
    expectedExpense: 0,
    expectedRevenue: Math.max(0, Math.round(plan.revenueForecast || getProjectedTicketRevenue(plan))),
    files: [],
    id: eventId,
    mainArtist: "",
    name: plan.eventName.trim() || "AI Draft Event",
    notes: "Created from AI Center draft preview.",
    owner: "AI Center",
    progress: 0,
    status: "Planning",
    ticketPrice: 0,
    ticketsSold: 0,
    venue: plan.venue.trim() || "Venue to be confirmed",
  };

  const tickets: TicketCategory[] = plan.ticketCategories.map((category, index) => ({
    checkedIn: 0,
    eventId,
    id: `ai-ticket-${idSeed}-${index}`,
    inventory: Math.max(1, Math.round(category.inventory)),
    name: category.name.trim() || `Category ${index + 1}`,
    price: Math.max(0, Math.round(category.price)),
    sold: 0,
    status: "Not Started",
  }));

  const tasks: Task[] = plan.suggestedTasks.map((task, index) => ({
    dueDate: getTaskDueDate(index),
    eventId,
    id: `ai-task-${idSeed}-${index}`,
    owner: "AI Center",
    priority: index < 2 ? "High" : index < 5 ? "Medium" : "Low",
    status: "Open",
    title: task.trim() || `AI task ${index + 1}`,
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

function createDraftSignature(event: EventItem, plan: AIEventPlan) {
  return [
    event.name,
    event.venue,
    event.city,
    event.capacity,
    event.eventType,
    plan.ticketCategories.map((category) => `${category.name}:${category.price}:${category.inventory}`).join("|"),
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}
