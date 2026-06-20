import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, BriefcaseBusiness, CalendarCheck2, Copy, Download, FilePlus2, MapPin, Plus, RefreshCw, ShieldAlert, Sparkles, Ticket, Trash2, TrendingUp, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import type { ActivitiesDataSource } from "../hooks/useActivitiesData";
import type { EventsDataSource } from "../hooks/useEventsData";
import type { TasksDataSource } from "../hooks/useTasksData";
import type { TicketingDataSource } from "../hooks/useTicketingData";
import { useAuth } from "../hooks/useAuth";
import { getCopilotInsights } from "../intelligence/eventCopilot";
import { calculateEventWorkspace } from "../intelligence/eventWorkspace";
import { buildExecutiveInsights } from "../intelligence/executiveSummary";
import { generateAIEventPlan, type AICenterBackendMode, type AIEventPlan } from "../lib/aiCenterClient";
import { createWorkspaceTimelineItem, deleteWorkspaceTimelineItem } from "../lib/timelineRepository";
import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventItem, EventOSData, EventType, Task, TicketCategory, TimelineItem } from "../types";
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

const AI_EXECUTION_HISTORY_STORAGE_KEY = "eventos-ai-execution-history-v1";

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

interface AIActionProposal {
  id: string;
  impact: "High" | "Medium" | "Low";
  reason: string;
  source: "Event" | "Workspace";
  title: string;
}

interface AITaskDraft {
  description: string;
  dueDate: string;
  id: string;
  priority: "High" | "Medium" | "Low";
  sourceProposal: string;
  targetEvent: string;
  title: string;
}

interface AIExecutionHistoryEntry {
  createdAt: string;
  entryType?: "tasks" | "timeline";
  id: string;
  source: "AI Center";
  status: "Success" | "Undone";
  targetEvent: string;
  taskCount: number;
  taskIds?: string[];
  taskTitles: string[];
  timelineDraftIds?: string[];
  timelineItemCount?: number;
  timelineItemIds?: string[];
  timelineItemTitles?: string[];
  undoneAt?: string;
}

type AIApprovalQueueStatus = "Proposed" | "Approved" | "Executed" | "Undone" | "Failed";

interface AIApprovalQueueItem {
  id: string;
  impact: "High" | "Medium" | "Low";
  source: "AI Center" | "Event" | "Workspace";
  status: AIApprovalQueueStatus;
  targetEvent: string;
  title: string;
}

interface SponsorActionDraft {
  expectedImpact: "High" | "Medium" | "Low";
  id: string;
  reason: string;
  targetEvent: string;
  title: string;
}

interface EventReadinessAction {
  id: string;
  priority: "High" | "Medium" | "Low";
  reason: string;
  targetEvent: string;
  title: string;
}

type IntelligenceTestStatus = "Pass" | "Warning" | "Needs Data";

interface IntelligenceHealthCheck {
  id: string;
  reason: string;
  sourceSystem: string;
  status: IntelligenceTestStatus;
  testName: string;
}

interface TimelineDraft {
  description: string;
  id: string;
  phase: string;
  priority: "High" | "Medium" | "Low";
  sourceSignal: string;
  targetEvent: string;
  title: string;
}

type TimelineExecutionDraft = TimelineDraft;

type ExecutableProposal = AIActionProposal & {
  targetEvent?: string;
};

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
  const { workspaceId } = useAuth();
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
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [approvedProposalIds, setApprovedProposalIds] = useState<string[]>([]);
  const [selectedSponsorDraftIds, setSelectedSponsorDraftIds] = useState<string[]>([]);
  const [approvedSponsorDraftIds, setApprovedSponsorDraftIds] = useState<string[]>([]);
  const [selectedTimelineDraftIds, setSelectedTimelineDraftIds] = useState<string[]>([]);
  const [approvedTimelineDraftIds, setApprovedTimelineDraftIds] = useState<string[]>([]);
  const [createdExecutionDraftIds, setCreatedExecutionDraftIds] = useState<string[]>([]);
  const [createdTimelineDraftIds, setCreatedTimelineDraftIds] = useState<string[]>([]);
  const [executionEventId, setExecutionEventId] = useState("");
  const [showTaskCreateConfirm, setShowTaskCreateConfirm] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState("");
  const [taskCreateMessage, setTaskCreateMessage] = useState("");
  const [showTimelineCreateConfirm, setShowTimelineCreateConfirm] = useState(false);
  const [isCreatingTimelineItems, setIsCreatingTimelineItems] = useState(false);
  const [timelineCreateError, setTimelineCreateError] = useState("");
  const [timelineCreateMessage, setTimelineCreateMessage] = useState("");
  const [executionHistory, setExecutionHistory] = useState<AIExecutionHistoryEntry[]>(loadExecutionHistory);
  const [undoExecutionId, setUndoExecutionId] = useState("");
  const [isUndoingTasks, setIsUndoingTasks] = useState(false);
  const [taskUndoError, setTaskUndoError] = useState("");
  const [taskUndoMessage, setTaskUndoMessage] = useState("");
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
  const timelineTargetEventName = analyzedEvent?.name ?? "Selected event";
  const timelineDrafts = useMemo(
    () => (eventAnalysis ? buildTimelineDrafts(eventAnalysis, timelineTargetEventName) : []),
    [eventAnalysis, timelineTargetEventName],
  );
  const actionProposals = useMemo(
    () => buildAIActionProposals(workspaceInsights, eventAnalysis, analyzedEvent),
    [workspaceInsights, eventAnalysis, analyzedEvent],
  );
  const sponsorActionDrafts = useMemo(
    () => buildSponsorActionDrafts(workspaceInsights, eventAnalysis, analyzedEvent),
    [workspaceInsights, eventAnalysis, analyzedEvent],
  );
  const approvedActionProposals = useMemo(
    () => actionProposals.filter((proposal) => approvedProposalIds.includes(proposal.id)),
    [actionProposals, approvedProposalIds],
  );
  const approvedSponsorActionDrafts = useMemo(
    () => sponsorActionDrafts.filter((draft) => approvedSponsorDraftIds.includes(draft.id)),
    [approvedSponsorDraftIds, sponsorActionDrafts],
  );
  const approvedTimelineDrafts = useMemo(
    () => timelineDrafts.filter((draft) => approvedTimelineDraftIds.includes(draft.id)),
    [approvedTimelineDraftIds, timelineDrafts],
  );
  const executionProposals = useMemo(
    () => [
      ...approvedActionProposals,
      ...approvedSponsorActionDrafts.map(toExecutableSponsorProposal),
    ],
    [approvedActionProposals, approvedSponsorActionDrafts],
  );
  const executionDrafts = useMemo(
    () => buildExecutionTaskDrafts(executionProposals),
    [executionProposals],
  );
  const creatableExecutionDrafts = useMemo(
    () => executionDrafts.filter((draft) => !createdExecutionDraftIds.includes(draft.id)),
    [createdExecutionDraftIds, executionDrafts],
  );
  const creatableTimelineDrafts = useMemo(
    () => approvedTimelineDrafts.filter((draft) => !createdTimelineDraftIds.includes(draft.id)),
    [approvedTimelineDrafts, createdTimelineDraftIds],
  );
  const executionTargetEventName = data.events.find((event) => event.id === executionEventId)?.name ?? "";
  const approvalQueueItems = useMemo(
    () => buildAIApprovalQueueItems({
      actionProposals,
      analyzedEventName: analyzedEvent?.name,
      approvedProposalIds,
      approvedSponsorDraftIds,
      approvedTimelineDraftIds,
      createdExecutionDraftIds,
      createdTimelineDraftIds,
      executionHistory,
      executionTargetEventName,
      sponsorActionDrafts,
      timelineDrafts,
    }),
    [
      actionProposals,
      analyzedEvent?.name,
      approvedProposalIds,
      approvedSponsorDraftIds,
      approvedTimelineDraftIds,
      createdExecutionDraftIds,
      createdTimelineDraftIds,
      executionHistory,
      executionTargetEventName,
      sponsorActionDrafts,
      timelineDrafts,
    ],
  );

  useEffect(() => {
    const activeProposalIds = new Set(actionProposals.map((proposal) => proposal.id));
    const activeExecutionDraftIds = new Set(executionDrafts.map((draft) => draft.id));
    setSelectedProposalIds((current) => current.filter((proposalId) => activeProposalIds.has(proposalId)));
    setApprovedProposalIds((current) => current.filter((proposalId) => activeProposalIds.has(proposalId)));
    setCreatedExecutionDraftIds((current) => current.filter((proposalId) => activeExecutionDraftIds.has(proposalId)));
  }, [actionProposals, executionDrafts]);

  useEffect(() => {
    const activeSponsorDraftIds = new Set(sponsorActionDrafts.map((draft) => draft.id));
    setSelectedSponsorDraftIds((current) => current.filter((draftId) => activeSponsorDraftIds.has(draftId)));
    setApprovedSponsorDraftIds((current) => current.filter((draftId) => activeSponsorDraftIds.has(draftId)));
  }, [sponsorActionDrafts]);

  useEffect(() => {
    const activeTimelineDraftIds = new Set(timelineDrafts.map((draft) => draft.id));
    setSelectedTimelineDraftIds((current) => current.filter((draftId) => activeTimelineDraftIds.has(draftId)));
    setApprovedTimelineDraftIds((current) => current.filter((draftId) => activeTimelineDraftIds.has(draftId)));
    setCreatedTimelineDraftIds((current) => current.filter((draftId) => activeTimelineDraftIds.has(draftId)));
  }, [timelineDrafts]);

  useEffect(() => {
    if (data.events.length === 0) {
      setExecutionEventId("");
      return;
    }

    const preferredEventId = analyzedEventId || data.events[0]?.id || "";
    setExecutionEventId((current) => (
      current && data.events.some((event) => event.id === current) ? current : preferredEventId
    ));
  }, [analyzedEventId, data.events]);

  useEffect(() => {
    saveExecutionHistory(executionHistory);
  }, [executionHistory]);

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

  const openTaskCreateConfirm = () => {
    setTaskCreateError("");
    setTaskCreateMessage("");

    if (creatableExecutionDrafts.length === 0) {
      setTaskCreateError("There are no new approved task drafts to create.");
      return;
    }

    if (!executionEventId) {
      setTaskCreateError("Select an event before creating tasks.");
      return;
    }

    setShowTaskCreateConfirm(true);
  };

  const cancelTaskCreate = () => {
    if (isCreatingTasks) return;
    setTaskCreateError("");
    setShowTaskCreateConfirm(false);
  };

  const openTimelineCreateConfirm = () => {
    setTimelineCreateError("");
    setTimelineCreateMessage("");

    if (!analyzedEvent) {
      setTimelineCreateError("Analyze an event before creating timeline items.");
      return;
    }

    if (creatableTimelineDrafts.length === 0) {
      setTimelineCreateError("There are no new approved timeline drafts to create.");
      return;
    }

    setShowTimelineCreateConfirm(true);
  };

  const cancelTimelineCreate = () => {
    if (isCreatingTimelineItems) return;
    setTimelineCreateError("");
    setShowTimelineCreateConfirm(false);
  };

  const openUndoExecutionConfirm = (entryId: string) => {
    setTaskUndoError("");
    setTaskUndoMessage("");

    const entry = executionHistory.find((historyEntry) => historyEntry.id === entryId);
    if (!entry) {
      setTaskUndoError("Unable to find this execution history entry.");
      return;
    }

    if (entry.status === "Undone") {
      setTaskUndoError("This AI execution has already been undone.");
      return;
    }

    if (getExecutionUndoIds(entry).length === 0) {
      setTaskUndoError("Undo unavailable for this older entry.");
      return;
    }

    setUndoExecutionId(entryId);
  };

  const cancelUndoExecution = () => {
    if (isUndoingTasks) return;
    setTaskUndoError("");
    setUndoExecutionId("");
  };

  const undoExecutionTasks = async () => {
    if (isUndoingTasks) return;

    const entry = executionHistory.find((historyEntry) => historyEntry.id === undoExecutionId);
    if (!entry) {
      setTaskUndoError("Unable to find this execution history entry.");
      return;
    }

    if (entry.status === "Undone") {
      setTaskUndoError("This AI execution has already been undone.");
      return;
    }

    const undoIds = getExecutionUndoIds(entry);
    if (undoIds.length === 0) {
      setTaskUndoError("Undo unavailable for this older entry.");
      return;
    }

    setIsUndoingTasks(true);
    setTaskUndoError("");
    setTaskUndoMessage("");

    try {
      if (getExecutionEntryType(entry) === "timeline") {
        if (eventsData.isSupabaseMode) {
          if (!workspaceId) throw new Error("No authenticated EventOS workspace is available.");
          for (const timelineItemId of undoIds) {
            await deleteWorkspaceTimelineItem(workspaceId, timelineItemId);
          }
        } else {
          const timelineItemIdsToRemove = new Set(undoIds);
          setData((current) => ({
            ...current,
            timeline: current.timeline.filter((item) => !timelineItemIdsToRemove.has(item.id)),
          }));
        }
      } else if (tasksData.isSupabaseMode) {
        for (const taskId of undoIds) {
          await tasksData.deleteTask(taskId);
        }
      } else {
        const taskIdsToRemove = new Set(undoIds);
        setData((current) => ({
          ...current,
          tasks: current.tasks.filter((task) => !taskIdsToRemove.has(task.id)),
        }));
      }

      setExecutionHistory((current) => current.map((historyEntry) => (
        historyEntry.id === entry.id
          ? { ...historyEntry, status: "Undone", undoneAt: new Date().toISOString() }
          : historyEntry
      )));
      setTaskUndoMessage(getUndoSuccessMessage(entry, undoIds.length));
      setUndoExecutionId("");
    } catch (error) {
      setTaskUndoError(getErrorMessage(error, getUndoErrorMessage(entry)));
    } finally {
      setIsUndoingTasks(false);
    }
  };

  const createApprovedTasks = async () => {
    if (isCreatingTasks) return;

    const selectedEvent = data.events.find((event) => event.id === executionEventId);
    if (!selectedEvent) {
      setTaskCreateError("Select an event before creating tasks.");
      return;
    }

    if (creatableExecutionDrafts.length === 0) {
      setTaskCreateError("There are no new approved task drafts to create.");
      return;
    }

    setIsCreatingTasks(true);
    setTaskCreateError("");
    setTaskCreateMessage("");

    const successfulDraftIds: string[] = [];

    try {
      const createdTasks: Task[] = [];

      if (tasksData.isSupabaseMode) {
        for (const draft of creatableExecutionDrafts) {
          const createdTask = await tasksData.createTask({
            dueDate: draft.dueDate,
            eventId: selectedEvent.id,
            owner: "AI Center",
            priority: draft.priority,
            status: "Open",
            title: draft.title,
          });
          createdTasks.push(createdTask);
          successfulDraftIds.push(draft.id);
        }
      } else {
        const idSeed = Date.now();
        const localTasks: Task[] = creatableExecutionDrafts.map((draft, index) => ({
          dueDate: draft.dueDate,
          eventId: selectedEvent.id,
          id: `ai-execution-task-${idSeed}-${index}`,
          owner: "AI Center",
          priority: draft.priority,
          status: "Open",
          title: draft.title,
        }));

        setData((current) => ({
          ...current,
          tasks: [...localTasks, ...current.tasks],
        }));
        createdTasks.push(...localTasks);
        successfulDraftIds.push(...creatableExecutionDrafts.map((draft) => draft.id));
      }

      setCreatedExecutionDraftIds((current) => Array.from(new Set([
        ...current,
        ...successfulDraftIds,
      ])));
      setExecutionHistory((current) => [
        {
          createdAt: new Date().toISOString(),
          id: `execution-${Date.now()}`,
          source: "AI Center",
          status: "Success",
          targetEvent: selectedEvent.name,
          taskCount: createdTasks.length,
          taskIds: createdTasks.map((task) => task.id),
          taskTitles: createdTasks.map((task) => task.title),
        },
        ...current,
      ]);
      setTaskCreateMessage(`${createdTasks.length} tasks created successfully.`);
      setShowTaskCreateConfirm(false);
    } catch (error) {
      if (successfulDraftIds.length > 0) {
        setCreatedExecutionDraftIds((current) => Array.from(new Set([
          ...current,
          ...successfulDraftIds,
        ])));
      }
      setTaskCreateError(getErrorMessage(error, "Unable to create tasks from approved drafts."));
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const createApprovedTimelineItems = async () => {
    if (isCreatingTimelineItems) return;

    if (!analyzedEvent) {
      setTimelineCreateError("Analyze an event before creating timeline items.");
      return;
    }

    if (creatableTimelineDrafts.length === 0) {
      setTimelineCreateError("There are no new approved timeline drafts to create.");
      return;
    }

    setIsCreatingTimelineItems(true);
    setTimelineCreateError("");
    setTimelineCreateMessage("");

    const successfulDraftIds: string[] = [];

    try {
      const createdTimelineItems: TimelineItem[] = [];

      if (eventsData.isSupabaseMode) {
        if (!workspaceId) throw new Error("No authenticated EventOS workspace is available.");
        for (const draft of creatableTimelineDrafts) {
          const createdItem = await createWorkspaceTimelineItem(workspaceId, toTimelineWriteInput(draft, analyzedEvent));
          createdTimelineItems.push(createdItem);
          successfulDraftIds.push(draft.id);
        }
      } else {
        const idSeed = Date.now();
        const localTimelineItems: TimelineItem[] = creatableTimelineDrafts.map((draft, index) => ({
          ...toTimelineWriteInput(draft, analyzedEvent),
          id: `ai-execution-timeline-${idSeed}-${index}`,
        }));

        setData((current) => ({
          ...current,
          timeline: [...localTimelineItems, ...current.timeline],
        }));
        createdTimelineItems.push(...localTimelineItems);
        successfulDraftIds.push(...creatableTimelineDrafts.map((draft) => draft.id));
      }

      setCreatedTimelineDraftIds((current) => Array.from(new Set([
        ...current,
        ...successfulDraftIds,
      ])));
      setExecutionHistory((current) => [
        {
          createdAt: new Date().toISOString(),
          entryType: "timeline",
          id: `timeline-execution-${Date.now()}`,
          source: "AI Center",
          status: "Success",
          targetEvent: analyzedEvent.name,
          taskCount: 0,
          taskIds: [],
          taskTitles: [],
          timelineDraftIds: successfulDraftIds,
          timelineItemCount: createdTimelineItems.length,
          timelineItemIds: createdTimelineItems.map((item) => item.id),
          timelineItemTitles: createdTimelineItems.map((item) => item.title),
        },
        ...current,
      ]);
      setTimelineCreateMessage(`${createdTimelineItems.length} timeline items created successfully.`);
      setShowTimelineCreateConfirm(false);
    } catch (error) {
      if (successfulDraftIds.length > 0) {
        setCreatedTimelineDraftIds((current) => Array.from(new Set([
          ...current,
          ...successfulDraftIds,
        ])));
      }
      setTimelineCreateError(getErrorMessage(error, "Unable to create timeline items from approved drafts."));
    } finally {
      setIsCreatingTimelineItems(false);
    }
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

      <EventReadinessActionPlan
        analysis={eventAnalysis}
        analyzedEvent={analyzedEvent}
      />

      <FinanceRiskExplainer
        analysis={eventAnalysis}
        analyzedEvent={analyzedEvent}
        scoped={analyzedWorkspace}
      />

      <IntelligenceTestSuite
        analyzedEvent={analyzedEvent}
        eventAnalysis={eventAnalysis}
        financeReady={Boolean(eventAnalysis && analyzedWorkspace && analyzedEvent)}
        sponsorActionDrafts={sponsorActionDrafts}
        timelineDrafts={timelineDrafts}
        workspaceInsights={workspaceInsights}
      />

      <TimelineDraftBuilder
        approvedDraftIds={approvedTimelineDraftIds}
        drafts={timelineDrafts}
        hasAnalysis={Boolean(eventAnalysis)}
        onApproveSelected={() => {
          setApprovedTimelineDraftIds((current) => Array.from(new Set([...current, ...selectedTimelineDraftIds])));
        }}
        onToggleDraft={(draftId) => {
          setSelectedTimelineDraftIds((current) => (
            current.includes(draftId)
              ? current.filter((selectedId) => selectedId !== draftId)
              : [...current, draftId]
          ));
        }}
        selectedDraftIds={selectedTimelineDraftIds}
      />

      <AIActionProposals
        approvedProposalIds={approvedProposalIds}
        onApproveSelected={() => {
          setApprovedProposalIds((current) => Array.from(new Set([...current, ...selectedProposalIds])));
        }}
        onToggleProposal={(proposalId) => {
          setSelectedProposalIds((current) => (
            current.includes(proposalId)
              ? current.filter((selectedId) => selectedId !== proposalId)
              : [...current, proposalId]
          ));
        }}
        proposals={actionProposals}
        selectedProposalIds={selectedProposalIds}
      />

      <SponsorActionDrafts
        approvedDraftIds={approvedSponsorDraftIds}
        drafts={sponsorActionDrafts}
        onApproveSelected={() => {
          setApprovedSponsorDraftIds((current) => Array.from(new Set([...current, ...selectedSponsorDraftIds])));
        }}
        onToggleDraft={(draftId) => {
          setSelectedSponsorDraftIds((current) => (
            current.includes(draftId)
              ? current.filter((selectedId) => selectedId !== draftId)
              : [...current, draftId]
          ));
        }}
        selectedDraftIds={selectedSponsorDraftIds}
      />

      <AIApprovalQueue items={approvalQueueItems} />

      <ExecutionPreview
        createdDraftIds={createdExecutionDraftIds}
        createdTimelineDraftIds={createdTimelineDraftIds}
        drafts={executionDrafts}
        error={taskCreateError}
        events={data.events}
        isCreating={isCreatingTasks}
        isCreatingTimelineItems={isCreatingTimelineItems}
        message={taskCreateMessage}
        onChangeEvent={setExecutionEventId}
        onCreateTasks={openTaskCreateConfirm}
        onCreateTimelineItems={openTimelineCreateConfirm}
        selectedEventId={executionEventId}
        timelineDrafts={approvedTimelineDrafts}
        timelineError={timelineCreateError}
        timelineMessage={timelineCreateMessage}
      />

      <ExecutionHistory
        error={taskUndoError}
        history={executionHistory}
        message={taskUndoMessage}
        onUndo={openUndoExecutionConfirm}
        undoingEntryId={isUndoingTasks ? undoExecutionId : ""}
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

      {showTaskCreateConfirm && (
        <ConfirmCreateTasksModal
          draftCount={creatableExecutionDrafts.length}
          eventName={data.events.find((event) => event.id === executionEventId)?.name ?? "selected event"}
          isCreating={isCreatingTasks}
          onCancel={cancelTaskCreate}
          onConfirm={() => void createApprovedTasks()}
        />
      )}

      {showTimelineCreateConfirm && (
        <ConfirmCreateTimelineItemsModal
          draftCount={creatableTimelineDrafts.length}
          eventName={analyzedEvent?.name ?? "selected event"}
          isCreating={isCreatingTimelineItems}
          onCancel={cancelTimelineCreate}
          onConfirm={() => void createApprovedTimelineItems()}
        />
      )}

      {undoExecutionId && (
        <ConfirmUndoTasksModal
          entry={executionHistory.find((historyEntry) => historyEntry.id === undoExecutionId)}
          isUndoing={isUndoingTasks}
          onCancel={cancelUndoExecution}
          onConfirm={() => void undoExecutionTasks()}
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

function EventReadinessActionPlan({
  analysis,
  analyzedEvent,
}: {
  analysis: ReturnType<typeof getCopilotInsights> | null;
  analyzedEvent?: EventItem;
}) {
  const targetEvent = analyzedEvent?.name ?? "Selected event";
  const risks = analysis ? buildEventReadinessRisks(analysis) : [];
  const actions = analysis ? buildEventReadinessActions(analysis, targetEvent) : [];

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Event Readiness Action Plan</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Readiness recommendations</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Read-only event readiness plan assembled from the selected event's existing Copilot intelligence.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
          No execution flow
        </span>
      </div>

      {!analysis || !analyzedEvent ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          Run analysis for an event to generate a readiness action plan.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WorkspaceMetric
              helper="Readiness score from current event signals"
              icon={CalendarCheck2}
              title="Readiness Score"
              tone={analysis.readiness.tone}
              value={`${analysis.readiness.score}/100`}
            />
            <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:col-span-1 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Readiness Summary</p>
              <p className="mt-3 break-words text-lg font-semibold text-white">{analysis.readiness.summary}</p>
              <p className="mt-2 text-sm leading-6 text-app-muted">Target Event: {targetEvent}</p>
            </article>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Top Risks</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
            {risks.map((risk) => (
              <article key={risk.title} className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getReadinessToneClass(risk.tone)}`}>
                  {risk.label}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-white">{risk.title}</h3>
                <p className="mt-2 break-words text-sm leading-6 text-app-muted">{risk.reason}</p>
              </article>
            ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Recommended Actions</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Read-only next steps</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
                Recommendation
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {actions.map((action) => (
                <article key={action.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(action.priority)}`}>
                      {action.priority} priority
                    </span>
                    <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                      Source: Event Readiness Plan
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200">
                      Status: Recommendation
                    </span>
                  </div>
                  <h4 className="mt-4 break-words text-base font-semibold text-white">{action.title}</h4>
                  <p className="mt-2 break-words text-sm leading-6 text-app-muted">{action.reason}</p>
                  <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-slate-400">
                    Target Event: <span className="normal-case tracking-normal text-slate-200">{action.targetEvent}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
function FinanceRiskExplainer({
  analysis,
  analyzedEvent,
  scoped,
}: {
  analysis: ReturnType<typeof getCopilotInsights> | null;
  analyzedEvent?: EventItem;
  scoped: ReturnType<typeof calculateEventWorkspace> | null;
}) {
  const targetEvent = analyzedEvent?.name ?? "Selected event";
  const finance = analysis && scoped && analyzedEvent ? buildFinanceRiskExplainer(analysis, scoped, targetEvent) : null;

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Finance Risk Explainer</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Financial risk signals</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Read-only finance interpretation built from the selected event's current revenue, sponsor, ticket, and expense signals.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
          Recommendation only
        </span>
      </div>

      {!finance ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          Run analysis for an event to see finance risk signals.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WorkspaceMetric
              helper="Financial health from existing EventOS revenue, expense, sponsor, and ticket signals"
              icon={TrendingUp}
              title="Financial Health Score"
              tone={finance.tone}
              value={`${finance.score}/100`}
            />
            <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4 md:col-span-1 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Financial Summary</p>
              <p className="mt-3 break-words text-lg font-semibold text-white">{finance.summary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FinanceSignal label="Expected revenue" value={formatCurrency(finance.expectedRevenue)} />
                <FinanceSignal label="Recorded revenue" value={formatCurrency(finance.recordedRevenue)} />
                <FinanceSignal label="Actual expense" value={formatCurrency(finance.actualExpense)} />
                <FinanceSignal label="Actual profit" value={formatCurrency(finance.actualProfit)} />
              </div>
              <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-slate-400">
                Target Event: <span className="normal-case tracking-normal text-slate-200">{targetEvent}</span>
              </p>
            </article>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Financial Risks</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {finance.risks.map((risk) => (
                <article key={risk.title} className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getReadinessToneClass(risk.tone)}`}>
                    {risk.label}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-white">{risk.title}</h3>
                  <p className="mt-2 break-words text-sm leading-6 text-app-muted">{risk.reason}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Financial Recommendations</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Read-only actions to consider</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
                {formatNumber(finance.recommendations.length)} recommendations
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {finance.recommendations.map((recommendation) => (
                <article key={recommendation.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(recommendation.severity)}`}>
                      {recommendation.severity} severity
                    </span>
                    <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                      Source: Finance Risk Explainer
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200">
                      Status: Recommendation
                    </span>
                  </div>
                  <h4 className="mt-4 break-words text-base font-semibold text-white">{recommendation.title}</h4>
                  <p className="mt-2 break-words text-sm leading-6 text-app-muted">{recommendation.reason}</p>
                  <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-slate-400">
                    Target Event: <span className="normal-case tracking-normal text-slate-200">{recommendation.targetEvent}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FinanceSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function buildFinanceRiskExplainer(
  analysis: ReturnType<typeof getCopilotInsights>,
  scoped: ReturnType<typeof calculateEventWorkspace>,
  targetEvent: string,
) {
  const expectedRevenue = analysis.revenueAdvisor.expectedRevenue;
  const recordedRevenue = analysis.revenueAdvisor.recordedRevenue;
  const revenueGap = Math.max(analysis.revenueAdvisor.revenueGap, 0);
  const sponsorGap = Math.max(analysis.sponsorAdvisor.sponsorGap, 0);
  const expensePressure = scoped.expectedExpense > 0 ? scoped.actualExpense / scoped.expectedExpense : scoped.actualExpense > 0 ? 1 : 0;
  const profitPressure = scoped.actualProfit < 0 || scoped.expectedProfit < 0;
  const revenueProgress = expectedRevenue > 0 ? Math.min(recordedRevenue / expectedRevenue, 1) : recordedRevenue > 0 ? 1 : 0;
  const score = clampFinanceScore(
    48
      + revenueProgress * 34
      + (scoped.actualProfit > 0 ? 10 : 0)
      - (expensePressure > 1 ? 14 : expensePressure > 0.8 ? 7 : 0)
      - (revenueGap > 0 ? 10 : 0)
      - (sponsorGap > 0 ? 8 : 0)
      - (analysis.ticket.tone === "danger" ? 10 : analysis.ticket.tone === "warning" ? 5 : 0)
      - (profitPressure ? 12 : 0),
  );
  const tone: "danger" | "primary" | "success" | "warning" = score >= 75 ? "success" : score >= 55 ? "primary" : score >= 40 ? "warning" : "danger";
  const risks = buildFinanceRisks(analysis, scoped);
  const recommendations = buildFinanceRecommendations(analysis, scoped, targetEvent);

  return {
    actualExpense: scoped.actualExpense,
    actualProfit: scoped.actualProfit,
    expectedRevenue,
    recordedRevenue,
    recommendations,
    risks,
    score,
    summary: getFinanceSummary(analysis, scoped, revenueGap, expensePressure, profitPressure),
    tone,
  };
}

function buildFinanceRisks(
  analysis: ReturnType<typeof getCopilotInsights>,
  scoped: ReturnType<typeof calculateEventWorkspace>,
) {
  const risks: Array<{ label: string; reason: string; title: string; tone: "danger" | "primary" | "success" | "warning" }> = [];

  if (analysis.revenueAdvisor.revenueGap > 0) {
    risks.push({
      label: "Revenue gap",
      reason: `${formatCurrency(analysis.revenueAdvisor.revenueGap)} remains between projected and recorded income. ${analysis.revenueAdvisor.suggestedAction}`,
      title: "Revenue gap",
      tone: analysis.revenueAdvisor.tone,
    });
  }

  if (analysis.sponsorAdvisor.sponsorGap > 0 || analysis.sponsorAdvisor.opportunityValue > 0) {
    risks.push({
      label: analysis.sponsorAdvisor.sponsorGap > 0 ? "Sponsor gap" : "Sponsor upside",
      reason: `Sponsor gap is ${formatCurrency(analysis.sponsorAdvisor.sponsorGap)} with ${formatCurrency(analysis.sponsorAdvisor.opportunityValue)} estimated opportunity still available.`,
      title: "Sponsor dependency",
      tone: analysis.sponsorAdvisor.tone,
    });
  }

  if (scoped.actualExpense > scoped.expectedExpense && scoped.actualExpense > 0) {
    risks.push({
      label: "Expense pressure",
      reason: `Actual expenses are ${formatCurrency(scoped.actualExpense)}, above expected expenses of ${formatCurrency(scoped.expectedExpense)}.`,
      title: "Expense pressure",
      tone: "warning",
    });
  }

  if (analysis.ticket.tone === "danger" || analysis.ticket.tone === "warning") {
    risks.push({
      label: analysis.ticket.value,
      reason: analysis.ticket.helper,
      title: "Ticket sales weakness",
      tone: analysis.ticket.tone,
    });
  }

  if (scoped.actualProfit < 0 || scoped.expectedProfit < 0) {
    risks.push({
      label: "Profit risk",
      reason: `Current actual profit is ${formatCurrency(scoped.actualProfit)} and expected profit is ${formatCurrency(scoped.expectedProfit)}.`,
      title: "Profit risk",
      tone: "danger",
    });
  }

  if (risks.length === 0) {
    risks.push({
      label: "Stable",
      reason: "No major finance risk is flagged by the current event revenue, expense, sponsor, and ticket signals.",
      title: "Strong financial position",
      tone: "success",
    });
  }

  return risks.slice(0, 5);
}

function buildFinanceRecommendations(
  analysis: ReturnType<typeof getCopilotInsights>,
  scoped: ReturnType<typeof calculateEventWorkspace>,
  targetEvent: string,
) {
  const recommendations: Array<{ id: string; reason: string; severity: AIActionProposal["impact"]; targetEvent: string; title: string }> = [];
  const addRecommendation = (recommendation: { id: string; reason: string; severity: AIActionProposal["impact"]; targetEvent: string; title: string }) => {
    if (!recommendations.some((item) => item.id === recommendation.id)) recommendations.push(recommendation);
  };

  if (analysis.sponsorAdvisor.sponsorGap > 0 || analysis.sponsorAdvisor.opportunityValue > 0) {
    addRecommendation({
      id: "finance-increase-sponsor-outreach",
      reason: `Sponsor opportunity is ${formatCurrency(analysis.sponsorAdvisor.opportunityValue)} and the current sponsor gap is ${formatCurrency(analysis.sponsorAdvisor.sponsorGap)}.`,
      severity: analysis.sponsorAdvisor.sponsorGap > 0 ? "High" : "Medium",
      targetEvent,
      title: "Increase sponsor outreach",
    });
  }

  if (scoped.actualExpense > scoped.expectedExpense && scoped.actualExpense > 0) {
    addRecommendation({
      id: "finance-review-expenses",
      reason: `Actual expenses are running above expected expense exposure by ${formatCurrency(Math.max(scoped.actualExpense - scoped.expectedExpense, 0))}.`,
      severity: "High",
      targetEvent,
      title: "Review expenses",
    });
  }

  if (analysis.ticket.tone === "danger" || analysis.ticket.tone === "warning") {
    addRecommendation({
      id: "finance-improve-ticket-conversion",
      reason: analysis.ticket.helper,
      severity: analysis.ticket.tone === "danger" ? "High" : "Medium",
      targetEvent,
      title: "Improve ticket conversion",
    });
  }

  if (scoped.actualProfit < 0 || scoped.expectedProfit < 0) {
    addRecommendation({
      id: "finance-reduce-cost-exposure",
      reason: `Profit is under pressure with actual profit at ${formatCurrency(scoped.actualProfit)} and expected profit at ${formatCurrency(scoped.expectedProfit)}.`,
      severity: "High",
      targetEvent,
      title: "Reduce cost exposure",
    });
  }

  if (analysis.revenueAdvisor.revenueGap > 0) {
    addRecommendation({
      id: "finance-improve-payment-collection",
      reason: analysis.revenueAdvisor.suggestedAction,
      severity: analysis.revenueAdvisor.revenueGap > analysis.revenueAdvisor.expectedRevenue * 0.35 ? "High" : "Medium",
      targetEvent,
      title: "Improve payment collection",
    });
  }

  if (recommendations.length === 0) {
    addRecommendation({
      id: "finance-maintain-review-cadence",
      reason: "Finance signals look stable. Keep monitoring revenue, expense, ticket, and sponsor movement as the event progresses.",
      severity: "Low",
      targetEvent,
      title: "Maintain finance review cadence",
    });
  }

  return recommendations.slice(0, 5);
}

function getFinanceSummary(
  analysis: ReturnType<typeof getCopilotInsights>,
  scoped: ReturnType<typeof calculateEventWorkspace>,
  revenueGap: number,
  expensePressure: number,
  profitPressure: boolean,
) {
  if (!profitPressure && revenueGap <= 0 && scoped.actualProfit >= 0) return "Strong financial position";
  if (scoped.actualExpense > scoped.actualRevenue && scoped.actualExpense > 0) return "Expenses growing faster than income";
  if (profitPressure || expensePressure > 1) return "Profit margin under pressure";
  if (revenueGap > 0) return "Revenue target at risk";
  if (analysis.revenueAdvisor.recordedRevenue >= analysis.revenueAdvisor.expectedRevenue && analysis.revenueAdvisor.expectedRevenue > 0) return "Revenue target on track";
  return "Finance signals need continued review";
}

function clampFinanceScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function IntelligenceTestSuite({
  analyzedEvent,
  eventAnalysis,
  financeReady,
  sponsorActionDrafts,
  timelineDrafts,
  workspaceInsights,
}: {
  analyzedEvent?: EventItem;
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null;
  financeReady: boolean;
  sponsorActionDrafts: SponsorActionDraft[];
  timelineDrafts: TimelineDraft[];
  workspaceInsights: ReturnType<typeof buildExecutiveInsights>;
}) {
  const tests = buildIntelligenceHealthChecks({
    analyzedEvent,
    eventAnalysis,
    financeReady,
    sponsorActionDrafts,
    timelineDrafts,
    workspaceInsights,
  });
  const counts = getIntelligenceTestCounts(tests);

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Intelligence Test Suite</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Read-only intelligence coverage checks</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Validates the AI Center intelligence outputs currently available on this page and highlights where more event data is needed.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
          No writes or execution
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <IntelligenceSummaryCard label="Passed Tests" value={counts.Pass} tone="success" />
        <IntelligenceSummaryCard label="Warnings" value={counts.Warning} tone="warning" />
        <IntelligenceSummaryCard label="Needs Data" value={counts["Needs Data"]} tone="primary" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((test) => (
          <article key={test.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getIntelligenceTestStatusClass(test.status)}`}>
                Status: {test.status}
              </span>
              <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                Source System: {test.sourceSystem}
              </span>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.12em] text-app-muted">Test Name</p>
            <h3 className="mt-1 break-words text-base font-semibold text-white">{test.testName}</h3>
            <p className="mt-4 text-xs uppercase tracking-[0.12em] text-app-muted">Reason</p>
            <p className="mt-1 break-words text-sm leading-6 text-app-muted">{test.reason}</p>
            <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-slate-400">
              Source System: <span className="normal-case tracking-normal text-slate-200">{test.sourceSystem}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function IntelligenceSummaryCard({ label, tone, value }: { label: string; tone: "primary" | "success" | "warning"; value: number }) {
  const toneClass = tone === "success"
    ? "border-app-success/25 bg-app-success/10 text-green-100"
    : tone === "warning"
      ? "border-app-warning/25 bg-app-warning/10 text-amber-100"
      : "border-app-primary/25 bg-app-primary/10 text-blue-100";

  return (
    <article className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(value)}</p>
    </article>
  );
}

function buildIntelligenceHealthChecks({
  analyzedEvent,
  eventAnalysis,
  financeReady,
  sponsorActionDrafts,
  timelineDrafts,
  workspaceInsights,
}: {
  analyzedEvent?: EventItem;
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null;
  financeReady: boolean;
  sponsorActionDrafts: SponsorActionDraft[];
  timelineDrafts: TimelineDraft[];
  workspaceInsights: ReturnType<typeof buildExecutiveInsights>;
}): IntelligenceHealthCheck[] {
  return [
    buildWorkspaceIntelligenceCheck(workspaceInsights),
    buildEventIntelligenceCheck(analyzedEvent, eventAnalysis),
    buildSponsorIntelligenceCheck(workspaceInsights, eventAnalysis, sponsorActionDrafts),
    buildTimelineIntelligenceCheck(analyzedEvent, timelineDrafts),
    buildFinanceIntelligenceCheck(analyzedEvent, financeReady),
  ];
}

function buildWorkspaceIntelligenceCheck(workspaceInsights: ReturnType<typeof buildExecutiveInsights>): IntelligenceHealthCheck {
  if (workspaceInsights.summary.length > 0) {
    return {
      id: "workspace-intelligence",
      reason: workspaceInsights.revenueAtRisk > 0
        ? `Revenue forecast available with ${formatCurrency(workspaceInsights.revenueAtRisk)} currently at risk.`
        : "Workspace health and executive summary signals are available.",
      sourceSystem: "Workspace Intelligence",
      status: "Pass",
      testName: "Workspace Intelligence",
    };
  }

  return {
    id: "workspace-intelligence",
    reason: "Add workspace events, finance, sponsor, ticket, or task data to generate stronger executive intelligence.",
    sourceSystem: "Workspace Intelligence",
    status: "Needs Data",
    testName: "Workspace Intelligence",
  };
}

function buildEventIntelligenceCheck(
  analyzedEvent: EventItem | undefined,
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null,
): IntelligenceHealthCheck {
  if (!analyzedEvent) {
    return {
      id: "event-intelligence",
      reason: "No selected event. Choose an event and run analysis to validate event-level intelligence.",
      sourceSystem: "Event Analyzer",
      status: "Warning",
      testName: "Event Intelligence",
    };
  }

  return {
    id: "event-intelligence",
    reason: eventAnalysis
      ? `Event analysis is available for ${analyzedEvent.name}.`
      : `Select Run Analysis for ${analyzedEvent.name} to populate event intelligence outputs.`,
    sourceSystem: "Event Analyzer",
    status: eventAnalysis ? "Pass" : "Warning",
    testName: "Event Intelligence",
  };
}

function buildSponsorIntelligenceCheck(
  workspaceInsights: ReturnType<typeof buildExecutiveInsights>,
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null,
  sponsorActionDrafts: SponsorActionDraft[],
): IntelligenceHealthCheck {
  if (sponsorActionDrafts.length > 0) {
    return {
      id: "sponsor-intelligence",
      reason: `${formatNumber(sponsorActionDrafts.length)} sponsor action ${sponsorActionDrafts.length === 1 ? "draft is" : "drafts are"} generated from current sponsor signals.`,
      sourceSystem: "Sponsor Action Drafts",
      status: "Pass",
      testName: "Sponsor Intelligence",
    };
  }

  if (workspaceInsights.sponsorPipeline.activeDeals > 0 || eventAnalysis?.sponsorAdvisor.opportunityValue) {
    return {
      id: "sponsor-intelligence",
      reason: "Sponsor intelligence is available, but no sponsor action drafts are currently generated.",
      sourceSystem: "Sponsor Action Drafts",
      status: "Warning",
      testName: "Sponsor Intelligence",
    };
  }

  return {
    id: "sponsor-intelligence",
    reason: "No sponsor pipeline data is available yet.",
    sourceSystem: "Sponsor Action Drafts",
    status: "Needs Data",
    testName: "Sponsor Intelligence",
  };
}

function buildTimelineIntelligenceCheck(analyzedEvent: EventItem | undefined, timelineDrafts: TimelineDraft[]): IntelligenceHealthCheck {
  if (timelineDrafts.length > 0) {
    return {
      id: "timeline-intelligence",
      reason: `${formatNumber(timelineDrafts.length)} timeline ${timelineDrafts.length === 1 ? "draft is" : "drafts are"} generated for the selected event.`,
      sourceSystem: "Timeline Draft Builder",
      status: "Pass",
      testName: "Timeline Intelligence",
    };
  }

  return {
    id: "timeline-intelligence",
    reason: analyzedEvent ? "Timeline drafts have not been generated for this event yet." : "Select and analyze an event to generate timeline drafts.",
    sourceSystem: "Timeline Draft Builder",
    status: analyzedEvent ? "Warning" : "Needs Data",
    testName: "Timeline Intelligence",
  };
}

function buildFinanceIntelligenceCheck(analyzedEvent: EventItem | undefined, financeReady: boolean): IntelligenceHealthCheck {
  if (financeReady) {
    return {
      id: "finance-intelligence",
      reason: "Financial score generated from the selected event's existing finance, ticket, sponsor, and expense signals.",
      sourceSystem: "Finance Risk Explainer",
      status: "Pass",
      testName: "Finance Intelligence",
    };
  }

  return {
    id: "finance-intelligence",
    reason: analyzedEvent ? "Run analysis to generate finance risk signals for the selected event." : "No selected event for finance risk validation.",
    sourceSystem: "Finance Risk Explainer",
    status: analyzedEvent ? "Warning" : "Needs Data",
    testName: "Finance Intelligence",
  };
}

function getIntelligenceTestCounts(tests: IntelligenceHealthCheck[]) {
  return tests.reduce<Record<IntelligenceTestStatus, number>>((counts, test) => ({
    ...counts,
    [test.status]: counts[test.status] + 1,
  }), {
    "Needs Data": 0,
    Pass: 0,
    Warning: 0,
  });
}

function getIntelligenceTestStatusClass(status: IntelligenceTestStatus) {
  if (status === "Pass") return "border-app-success/30 bg-app-success/12 text-green-100";
  if (status === "Warning") return "border-app-warning/30 bg-app-warning/12 text-amber-100";
  return "border-app-primary/30 bg-app-primary/12 text-blue-100";
}

function TimelineDraftBuilder({
  approvedDraftIds,
  drafts,
  hasAnalysis,
  onApproveSelected,
  onToggleDraft,
  selectedDraftIds,
}: {
  approvedDraftIds: string[];
  drafts: TimelineDraft[];
  hasAnalysis: boolean;
  onApproveSelected: () => void;
  onToggleDraft: (draftId: string) => void;
  selectedDraftIds: string[];
}) {
  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Timeline Draft Builder</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Readiness timeline drafts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Select timeline recommendations, approve them, then review them in Execution Preview before creating timeline items.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
            {formatNumber(selectedDraftIds.length)} selected
          </span>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={selectedDraftIds.length === 0}
            onClick={onApproveSelected}
            type="button"
          >
            <CalendarCheck2 size={16} />
            Approve Timeline Drafts
          </button>
        </div>
      </div>

      {!hasAnalysis ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          Run analysis for an event to generate read-only timeline drafts.
        </div>
      ) : drafts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          No timeline drafts are needed for this event yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => {
            const isApproved = approvedDraftIds.includes(draft.id);
            const isSelected = selectedDraftIds.includes(draft.id);

            return (
              <article key={draft.id} className={`rounded-lg border p-4 transition ${isSelected ? "border-app-primary/50 bg-app-primary/10" : "border-white/10 bg-white/[0.035]"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    checked={isSelected}
                    className="mt-1 h-4 w-4 rounded border-app-primary/50 bg-slate-950 text-app-primary focus:ring-app-primary/45"
                    onChange={() => onToggleDraft(draft.id)}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(draft.priority)}`}>
                        {draft.priority} priority
                      </span>
                      <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                        Source: AI Center
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isApproved ? "border-app-success/30 bg-app-success/12 text-green-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                        Status: {isApproved ? "Approved" : "Draft Only"}
                      </span>
                    </span>
                  </span>
                </label>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Timeline Item Title</dt>
                    <dd className="mt-1 break-words text-base font-semibold text-white">{draft.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Suggested Date / Phase</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-white">{draft.phase}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Description</dt>
                    <dd className="mt-1 break-words text-sm leading-6 text-slate-200">{draft.description}</dd>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Source Signal</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-white">{draft.sourceSignal}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Target Event</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-white">{draft.targetEvent}</dd>
                    </div>
                  </div>
                </dl>
              </article>
            );
          })}
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

function AIActionProposals({
  approvedProposalIds,
  onApproveSelected,
  onToggleProposal,
  proposals,
  selectedProposalIds,
}: {
  approvedProposalIds: string[];
  onApproveSelected: () => void;
  onToggleProposal: (proposalId: string) => void;
  proposals: AIActionProposal[];
  selectedProposalIds: string[];
}) {
  const selectedCount = selectedProposalIds.length;
  const approvedSelectedCount = selectedProposalIds.filter((proposalId) => approvedProposalIds.includes(proposalId)).length;
  const approvalStatus = approvedSelectedCount > 0
    ? "Approved — Execution coming in Sprint 18E"
    : "Ready for Sprint 18E execution";

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">AI Action Proposals</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Suggested next moves</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Read-only proposals assembled from Workspace Intelligence and Event Analyzer outputs.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={selectedCount === 0}
            onClick={onApproveSelected}
            type="button"
          >
            <ShieldAlert size={16} />
            Approve Selected Actions
          </button>
          <p className="text-xs text-app-muted">Approval workflow coming in Sprint 18D.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-app-primary/20 bg-app-primary/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100">Selected Actions</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(selectedCount)}</p>
          <p className="mt-1 text-sm text-app-muted">Total selected actions: {formatNumber(selectedCount)}</p>
        </div>
        <div className="rounded-lg border border-app-warning/25 bg-app-warning/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-100">Approval status</p>
          <p className="mt-2 break-words text-base font-semibold text-white">{approvalStatus}</p>
          <p className="mt-1 text-sm text-app-muted">Approved actions are not executed yet. Execution starts in Sprint 18E.</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          No action proposals yet. Add workspace data or run event analysis to surface proposal-ready actions.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((proposal) => (
            <article
              key={proposal.id}
              className={`rounded-lg border p-4 transition ${selectedProposalIds.includes(proposal.id) ? "border-app-primary/45 bg-app-primary/10" : "border-white/10 bg-white/[0.035]"}`}
            >
              <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
                <input
                  checked={selectedProposalIds.includes(proposal.id)}
                  className="h-4 w-4 rounded border-app-primary/45 bg-slate-950 text-app-primary focus:ring-app-primary/35"
                  onChange={() => onToggleProposal(proposal.id)}
                  type="checkbox"
                />
                <span className="text-sm font-medium text-slate-100">Select action</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(proposal.impact)}`}>
                  {proposal.impact} impact
                </span>
                <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                  {proposal.source}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${approvedProposalIds.includes(proposal.id) ? "border-app-success/30 bg-app-success/12 text-green-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                  {approvedProposalIds.includes(proposal.id) ? "Approved — Execution coming in Sprint 18E" : "Proposal only"}
                </span>
              </div>
              <h3 className="mt-4 break-words text-base font-semibold text-white">{proposal.title}</h3>
              <p className="mt-2 break-words text-sm leading-6 text-app-muted">{proposal.reason}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SponsorActionDrafts({
  approvedDraftIds,
  drafts,
  onApproveSelected,
  onToggleDraft,
  selectedDraftIds,
}: {
  approvedDraftIds: string[];
  drafts: SponsorActionDraft[];
  onApproveSelected: () => void;
  onToggleDraft: (draftId: string) => void;
  selectedDraftIds: string[];
}) {
  const selectedCount = selectedDraftIds.length;
  const approvedSelectedCount = selectedDraftIds.filter((draftId) => approvedDraftIds.includes(draftId)).length;
  const approvalStatus = approvedSelectedCount > 0
    ? "Approved for task execution"
    : "Ready for task draft approval";

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Sponsor Action Drafts</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Sponsor task draft approvals</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Sponsor actions are converted only into task drafts. Sponsor records are never created or updated here.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={selectedCount === 0}
            onClick={onApproveSelected}
            type="button"
          >
            <ShieldAlert size={16} />
            Approve Sponsor Drafts
          </button>
          <p className="text-xs text-app-muted">Approved sponsor drafts appear in Execution Preview as tasks.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-app-primary/20 bg-app-primary/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100">Selected Sponsor Drafts</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(selectedCount)}</p>
          <p className="mt-1 text-sm text-app-muted">Total selected sponsor actions: {formatNumber(selectedCount)}</p>
        </div>
        <div className="rounded-lg border border-app-warning/25 bg-app-warning/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-100">Sponsor approval status</p>
          <p className="mt-2 break-words text-base font-semibold text-white">{approvalStatus}</p>
          <p className="mt-1 text-sm text-app-muted">Execution creates tasks only. No sponsor data is changed.</p>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 p-4 text-sm leading-6 text-app-muted">
          No sponsor action drafts yet. Analyze an event or add sponsor pipeline data to see AI Center suggestions here.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {drafts.map((draft) => {
            const isSelected = selectedDraftIds.includes(draft.id);
            const isApproved = approvedDraftIds.includes(draft.id);

            return (
              <article key={draft.id} className={`rounded-lg border p-4 transition ${isSelected ? "border-app-primary/45 bg-app-primary/10" : "border-white/10 bg-white/[0.035]"}`}>
                <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
                  <input
                    checked={isSelected}
                    className="h-4 w-4 rounded border-app-primary/45 bg-slate-950 text-app-primary focus:ring-app-primary/35"
                    onChange={() => onToggleDraft(draft.id)}
                    type="checkbox"
                  />
                  <span className="text-sm font-medium text-slate-100">Select sponsor action</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(draft.expectedImpact)}`}>
                    {draft.expectedImpact} impact
                  </span>
                  <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                    Source: AI Center
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isApproved ? "border-app-success/30 bg-app-success/12 text-green-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                    Status: {isApproved ? "Approved" : "Draft Only"}
                  </span>
                </div>
                <h3 className="mt-4 break-words text-base font-semibold text-white">{draft.title}</h3>
                <p className="mt-2 break-words text-sm leading-6 text-app-muted">{draft.reason}</p>
                <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-slate-400">
                  Target Event: <span className="normal-case tracking-normal text-slate-200">{draft.targetEvent}</span>
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AIApprovalQueue({ items }: { items: AIApprovalQueueItem[] }) {
  const queueStatuses: AIApprovalQueueStatus[] = ["Proposed", "Approved", "Executed", "Undone", "Failed"];
  const counts = getApprovalQueueCounts(items);

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">AI Approval Queue</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Action status board</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Read-only queue assembled from proposals, approvals, execution drafts, and execution history.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
          UI aggregation only
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ApprovalQueueCount label="Proposed" value={counts.Proposed} />
        <ApprovalQueueCount label="Approved" value={counts.Approved} />
        <ApprovalQueueCount label="Executed" value={counts.Executed} />
        <ApprovalQueueCount label="Undone" value={counts.Undone} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        {queueStatuses.map((status) => {
          const statusItems = items.filter((item) => item.status === status);

          return (
            <article key={status} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-app-muted">{status}</p>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getApprovalQueueStatusClass(status)}`}>
                  {formatNumber(statusItems.length)}
                </span>
              </div>

              {statusItems.length === 0 ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/25 px-3 py-3 text-sm text-app-muted">
                  No {status.toLowerCase()} items.
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {statusItems.map((item) => (
                    <li key={item.id} className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getProposalImpactClass(item.impact)}`}>
                          {item.impact}
                        </span>
                        <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2 py-1 text-xs font-medium text-blue-100">
                          Source: {item.source}
                        </span>
                      </div>
                      <p className="mt-3 break-words text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 break-words text-xs leading-5 text-app-muted">Target Event: {item.targetEvent}</p>
                      <p className="mt-1 text-xs text-app-muted">Status: {item.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ApprovalQueueCount({ label, value }: { label: AIApprovalQueueStatus; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label} count</p>
      <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}

function ExecutionPreview({
  createdDraftIds,
  createdTimelineDraftIds,
  drafts,
  error,
  events,
  isCreating,
  isCreatingTimelineItems,
  message,
  onChangeEvent,
  onCreateTasks,
  onCreateTimelineItems,
  selectedEventId,
  timelineDrafts,
  timelineError,
  timelineMessage,
}: {
  createdDraftIds: string[];
  createdTimelineDraftIds: string[];
  drafts: AITaskDraft[];
  error: string;
  events: EventItem[];
  isCreating: boolean;
  isCreatingTimelineItems: boolean;
  message: string;
  onChangeEvent: (eventId: string) => void;
  onCreateTasks: () => void;
  onCreateTimelineItems: () => void;
  selectedEventId: string;
  timelineDrafts: TimelineExecutionDraft[];
  timelineError: string;
  timelineMessage: string;
}) {
  const pendingDrafts = drafts.filter((draft) => !createdDraftIds.includes(draft.id));
  const pendingTimelineDrafts = timelineDrafts.filter((draft) => !createdTimelineDraftIds.includes(draft.id));

  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Execution Preview</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Approved AI execution drafts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Review approved task and timeline drafts before creating real EventOS records. Timeline drafts create timeline items only.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <select
            className="dashboard-input h-10 min-w-0 sm:w-64"
            disabled={events.length === 0 || isCreating}
            onChange={(event) => onChangeEvent(event.target.value)}
            value={selectedEventId}
          >
            {events.length === 0 ? (
              <option value="">No events available</option>
            ) : events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingDrafts.length === 0 || !selectedEventId || isCreating}
            onClick={onCreateTasks}
            type="button"
          >
            <CalendarCheck2 size={16} />
            {isCreating ? "Creating..." : "Create Tasks"}
          </button>
        </div>
      </div>

      {(message || error) && (
        <p className={`mt-5 rounded-lg border px-3 py-2 text-sm ${message ? "border-app-success/30 bg-app-success/10 text-green-100" : "border-app-danger/30 bg-app-danger/10 text-red-100"}`}>
          {message || error}
        </p>
      )}

      {drafts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          Approve one or more AI Action Proposals to preview task drafts here.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => (
            <article key={`${draft.sourceProposal}-${draft.title}`} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              {(() => {
                const isCreated = createdDraftIds.includes(draft.id);
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(draft.priority)}`}>
                        {draft.priority} priority
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isCreated ? "border-app-success/30 bg-app-success/12 text-green-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                        {isCreated ? "Created" : "Draft Only"}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-3">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Draft Title</dt>
                        <dd className="mt-1 break-words text-base font-semibold text-white">{draft.title}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Draft Description</dt>
                        <dd className="mt-1 break-words text-sm leading-6 text-slate-200">{draft.description}</dd>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Suggested Priority</dt>
                          <dd className="mt-1 text-sm font-medium text-white">{draft.priority}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Suggested Due Date</dt>
                          <dd className="mt-1 text-sm font-medium text-white">{draft.dueDate}</dd>
                        </div>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Source Proposal</dt>
                        <dd className="mt-1 break-words text-sm font-medium text-white">{draft.sourceProposal}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Target Event</dt>
                        <dd className="mt-1 break-words text-sm font-medium text-white">{draft.targetEvent}</dd>
                      </div>
                    </dl>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Timeline item drafts</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Timeline drafts from approved timeline proposals</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
              These drafts create timeline items only for the analyzed event.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingTimelineDrafts.length === 0 || isCreatingTimelineItems}
            onClick={onCreateTimelineItems}
            type="button"
          >
            <CalendarCheck2 size={16} />
            {isCreatingTimelineItems ? "Creating..." : "Create Timeline Items"}
          </button>
        </div>

        {(timelineMessage || timelineError) && (
          <p className={`mt-5 rounded-lg border px-3 py-2 text-sm ${timelineMessage ? "border-app-success/30 bg-app-success/10 text-green-100" : "border-app-danger/30 bg-app-danger/10 text-red-100"}`}>
            {timelineMessage || timelineError}
          </p>
        )}

        {timelineDrafts.length === 0 ? (
          <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
            Approve timeline drafts to preview timeline item creation here.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {timelineDrafts.map((draft) => {
              const isCreated = createdTimelineDraftIds.includes(draft.id);

              return (
                <article key={`timeline-preview-${draft.id}`} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getProposalImpactClass(draft.priority)}`}>
                      {draft.priority} priority
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isCreated ? "border-app-success/30 bg-app-success/12 text-green-100" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                      Status: {isCreated ? "Created" : "Draft Only"}
                    </span>
                    <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                      Source: AI Center
                    </span>
                  </div>
                  <dl className="mt-4 space-y-3">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Timeline Item Title</dt>
                      <dd className="mt-1 break-words text-base font-semibold text-white">{draft.title}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Suggested Date / Phase</dt>
                      <dd className="mt-1 break-words text-sm font-medium text-white">{draft.phase}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Description</dt>
                      <dd className="mt-1 break-words text-sm leading-6 text-slate-200">{draft.description}</dd>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Priority</dt>
                        <dd className="mt-1 text-sm font-medium text-white">{draft.priority}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.12em] text-app-muted">Target Event</dt>
                        <dd className="mt-1 break-words text-sm font-medium text-white">{draft.targetEvent}</dd>
                      </div>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
function ExecutionHistory({
  error,
  history,
  message,
  onUndo,
  undoingEntryId,
}: {
  error: string;
  history: AIExecutionHistoryEntry[];
  message: string;
  onUndo: (entryId: string) => void;
  undoingEntryId: string;
}) {
  return (
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Execution History</p>
          <h2 className="mt-1 text-xl font-semibold text-white">AI execution audit trail</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            Local session history for tasks and timeline items created from approved AI drafts. No separate audit table is created.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200">
          Local session only
        </span>
      </div>

      {(message || error) && (
        <p className={`mt-5 rounded-lg border px-3 py-2 text-sm ${message ? "border-app-success/30 bg-app-success/10 text-green-100" : "border-app-danger/30 bg-app-danger/10 text-red-100"}`}>
          {message || error}
        </p>
      )}

      {history.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/25 px-4 py-5 text-sm leading-6 text-app-muted">
          No execution history yet. Create tasks or timeline items from approved drafts to see audit entries here.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {history.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              {(() => {
                const entryType = getExecutionEntryType(entry);
                const undoIds = getExecutionUndoIds(entry);
                const canUndo = entry.status === "Success" && undoIds.length > 0;
                const isOlderEntry = entry.status === "Success" && undoIds.length === 0;
                const isUndoing = undoingEntryId === entry.id;
                const itemCount = getExecutionItemCount(entry);
                const itemLabel = entryType === "timeline" ? "timeline items" : "tasks";
                const titles = getExecutionHistoryTitles(entry);

                return (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${entry.status === "Undone" ? "border-app-warning/30 bg-app-warning/12 text-amber-100" : "border-app-success/30 bg-app-success/12 text-green-100"}`}>
                            Status: {entry.status}
                          </span>
                          <span className="rounded-full border border-app-primary/25 bg-app-primary/10 px-2.5 py-1 text-xs font-medium text-blue-100">
                            Source: {entry.source}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200">
                            {entryType === "timeline" ? "Timeline execution" : "Task execution"}
                          </span>
                        </div>
                        <h3 className="mt-3 break-words text-base font-semibold text-white">{entry.targetEvent}</h3>
                        <p className="mt-1 text-sm text-app-muted">{formatNumber(itemCount)} {itemLabel} created</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2 text-sm text-slate-200">
                        {formatExecutionHistoryTime(entry.createdAt)} session
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {isOlderEntry ? (
                        <p className="text-sm text-app-muted">Undo unavailable for this older entry.</p>
                      ) : entry.status === "Undone" ? (
                        <p className="text-sm text-app-muted">This AI execution has already been undone.</p>
                      ) : (
                        <p className="text-sm text-app-muted">Undo removes only the {itemLabel} created by this execution.</p>
                      )}
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 text-sm font-medium text-red-100 transition hover:bg-app-danger/15 focus:outline-none focus:ring-2 focus:ring-app-danger/35 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canUndo || isUndoing}
                        onClick={() => onUndo(entry.id)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        {isUndoing ? "Undoing..." : canUndo ? entryType === "timeline" ? "Undo Timeline Items" : "Undo Tasks" : "Undo unavailable"}
                      </button>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{entryType === "timeline" ? "Timeline item titles created" : "Task titles created"}</p>
                      <ul className="mt-2 space-y-2">
                        {titles.map((title) => (
                          <li key={title} className="flex gap-2 text-sm leading-6 text-slate-200">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-success" />
                            <span className="min-w-0 break-words">{title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                );
              })()}
            </article>
          ))}
        </div>
      )}
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

function buildEventReadinessRisks(analysis: ReturnType<typeof getCopilotInsights>) {
  return [
    {
      label: analysis.taskRiskAdvisor.riskLevel,
      reason: `${formatNumber(analysis.taskRiskAdvisor.overdueTasks)} overdue tasks and ${formatNumber(analysis.taskRiskAdvisor.highPriorityPending)} high-priority pending tasks.`,
      title: "Task Risk",
      tone: analysis.taskRiskAdvisor.tone,
    },
    {
      label: analysis.revenueAdvisor.revenueGap > 0 ? "At risk" : "On track",
      reason: analysis.revenueAdvisor.suggestedAction,
      title: "Revenue Advisor",
      tone: analysis.revenueAdvisor.tone,
    },
    {
      label: analysis.sponsorAdvisor.sponsorGap > 0 ? "Gap open" : "Stable",
      reason: `Sponsor gap: ${formatCurrency(analysis.sponsorAdvisor.sponsorGap)}. Opportunity: ${formatCurrency(analysis.sponsorAdvisor.opportunityValue)}.`,
      title: "Sponsor Opportunity",
      tone: analysis.sponsorAdvisor.tone,
    },
    {
      label: analysis.ticket.value,
      reason: analysis.ticket.helper,
      title: "Ticket Health",
      tone: analysis.ticket.tone,
    },
  ];
}

function buildEventReadinessActions(
  analysis: ReturnType<typeof getCopilotInsights>,
  targetEvent: string,
): EventReadinessAction[] {
  const actions: EventReadinessAction[] = [];
  const addAction = (action: EventReadinessAction) => {
    if (!actions.some((item) => item.title === action.title && item.reason === action.reason)) actions.push(action);
  };

  if (analysis.sponsorAdvisor.sponsorGap > 0 || analysis.sponsorAdvisor.opportunityValue > 0) {
    addAction({
      id: "readiness-sponsor-follow-up",
      priority: analysis.sponsorAdvisor.sponsorGap > 0 ? "High" : "Medium",
      reason: analysis.sponsorAdvisor.suggestedCategories.length > 0 ? `Focus outreach on ${analysis.sponsorAdvisor.suggestedCategories.slice(0, 3).join(", ")} sponsor categories.` : `Sponsor gap remains ${formatCurrency(analysis.sponsorAdvisor.sponsorGap)} for this event.`,
      targetEvent,
      title: "Follow up sponsor leads",
    });
  }

  if (analysis.taskRiskAdvisor.overdueTasks > 0 || analysis.taskRiskAdvisor.highPriorityPending > 0) {
    addAction({
      id: "readiness-resolve-overdue-tasks",
      priority: analysis.taskRiskAdvisor.riskLevel === "High" ? "High" : "Medium",
      reason: `${formatNumber(analysis.taskRiskAdvisor.overdueTasks)} overdue tasks and ${formatNumber(analysis.taskRiskAdvisor.highPriorityPending)} high-priority pending tasks need attention.`,
      targetEvent,
      title: "Resolve overdue tasks",
    });
  }

  if (analysis.ticket.tone !== "success") {
    addAction({
      id: "readiness-ticket-promotion",
      priority: analysis.ticket.tone === "danger" ? "High" : "Medium",
      reason: analysis.ticket.helper,
      targetEvent,
      title: "Increase ticket promotion",
    });
  }

  if (analysis.revenueAdvisor.revenueGap > 0) {
    addAction({
      id: "readiness-revenue-review",
      priority: analysis.revenueAdvisor.tone === "danger" ? "High" : "Medium",
      reason: analysis.revenueAdvisor.suggestedAction,
      targetEvent,
      title: "Review revenue recovery plan",
    });
  }

  if (analysis.missingChecklist.some((item) => item.toLowerCase().includes("vendor"))) {
    addAction({
      id: "readiness-vendor-commitments",
      priority: "Medium",
      reason: analysis.missingChecklist.find((item) => item.toLowerCase().includes("vendor")) ?? "Vendor readiness needs review before launch.",
      targetEvent,
      title: "Review vendor commitments",
    });
  }

  analysis.priorityActions.slice(0, 2).forEach((action, index) => {
    addAction({
      id: `readiness-priority-${index}`,
      priority: index === 0 ? "High" : "Medium",
      reason: action,
      targetEvent,
      title: "Act on readiness priority",
    });
  });

  if (actions.length === 0) {
    addAction({
      id: "readiness-maintain-plan",
      priority: "Low",
      reason: analysis.readiness.summary,
      targetEvent,
      title: "Maintain readiness cadence",
    });
  }

  return actions.slice(0, 6);
}

function buildTimelineDrafts(
  analysis: ReturnType<typeof getCopilotInsights>,
  targetEvent: string,
): TimelineDraft[] {
  const drafts: TimelineDraft[] = [];
  const readinessActions = buildEventReadinessActions(analysis, targetEvent);
  const riskSignals = buildEventReadinessRisks(analysis);
  const addDraft = (draft: TimelineDraft) => {
    if (!drafts.some((item) => item.title === draft.title && item.sourceSignal === draft.sourceSignal)) drafts.push(draft);
  };

  if (analysis.sponsorAdvisor.sponsorGap > 0 || analysis.sponsorAdvisor.opportunityValue > 0) {
    addDraft({
      description: `${formatCurrency(analysis.sponsorAdvisor.sponsorGap)} sponsor gap and ${formatCurrency(analysis.sponsorAdvisor.opportunityValue)} sponsor opportunity need a focused outreach checkpoint.`,
      id: "timeline-sponsor-outreach-push",
      phase: "Sponsor pipeline phase",
      priority: analysis.sponsorAdvisor.sponsorGap > 0 ? "High" : "Medium",
      sourceSignal: "Sponsor Opportunity",
      targetEvent,
      title: "Sponsor outreach push",
    });
  }

  if (analysis.ticket.tone !== "success") {
    addDraft({
      description: analysis.ticket.helper,
      id: "timeline-ticket-promotion-checkpoint",
      phase: "Ticket sales checkpoint",
      priority: analysis.ticket.tone === "danger" ? "High" : "Medium",
      sourceSignal: "Ticket Health",
      targetEvent,
      title: "Ticket promotion checkpoint",
    });
  }

  if (analysis.taskRiskAdvisor.overdueTasks > 0 || analysis.taskRiskAdvisor.highPriorityPending > 0) {
    addDraft({
      description: `${formatNumber(analysis.taskRiskAdvisor.overdueTasks)} overdue tasks and ${formatNumber(analysis.taskRiskAdvisor.highPriorityPending)} high-priority pending tasks should be cleared before the next readiness review.`,
      id: "timeline-critical-task-clearance-window",
      phase: "Immediate operations window",
      priority: analysis.taskRiskAdvisor.riskLevel === "High" ? "High" : "Medium",
      sourceSignal: "Task Risk",
      targetEvent,
      title: "Critical task clearance window",
    });
  }

  if (analysis.revenueAdvisor.revenueGap > 0) {
    addDraft({
      description: analysis.revenueAdvisor.suggestedAction,
      id: "timeline-revenue-recovery-review",
      phase: "Revenue recovery review",
      priority: analysis.revenueAdvisor.tone === "danger" ? "High" : "Medium",
      sourceSignal: "Revenue Advisor",
      targetEvent,
      title: "Revenue recovery review",
    });
  }

  const vendorSignal = [...analysis.missingChecklist, ...analysis.priorityActions, ...analysis.recommendations]
    .find((item) => item.toLowerCase().includes("vendor"));
  if (vendorSignal) {
    addDraft({
      description: vendorSignal,
      id: "timeline-vendor-confirmation-checkpoint",
      phase: "Production confirmation phase",
      priority: "Medium",
      sourceSignal: "Event Readiness Action Plan",
      targetEvent,
      title: "Vendor confirmation checkpoint",
    });
  }

  readinessActions.slice(0, 2).forEach((action, index) => {
    addDraft({
      description: action.reason,
      id: `timeline-readiness-action-${index}`,
      phase: index === 0 ? "Next readiness review" : "Follow-up readiness review",
      priority: action.priority,
      sourceSignal: "Event Readiness Action Plan",
      targetEvent: action.targetEvent,
      title: action.title,
    });
  });

  riskSignals.slice(0, 1).forEach((risk) => {
    addDraft({
      description: risk.reason,
      id: "timeline-top-risk-review",
      phase: "Final readiness review",
      priority: risk.tone === "danger" ? "High" : risk.tone === "warning" ? "Medium" : "Low",
      sourceSignal: risk.title,
      targetEvent,
      title: "Final readiness review",
    });
  });

  if (drafts.length === 0) {
    addDraft({
      description: analysis.readiness.summary,
      id: "timeline-maintain-readiness-review",
      phase: "Weekly readiness review",
      priority: "Low",
      sourceSignal: "Event Readiness Action Plan",
      targetEvent,
      title: "Final readiness review",
    });
  }

  return drafts.slice(0, 6);
}
function getReadinessToneClass(tone: "danger" | "primary" | "success" | "warning") {
  if (tone === "success") return "border-app-success/30 bg-app-success/12 text-green-100";
  if (tone === "warning") return "border-app-warning/30 bg-app-warning/12 text-amber-100";
  if (tone === "primary") return "border-app-primary/30 bg-app-primary/12 text-blue-100";
  return "border-app-danger/30 bg-app-danger/12 text-red-100";
}
function buildAIActionProposals(
  workspaceInsights: ReturnType<typeof buildExecutiveInsights>,
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null,
  analyzedEvent?: EventItem,
): AIActionProposal[] {
  const proposals: AIActionProposal[] = [];
  const addProposal = (proposal: AIActionProposal) => {
    const key = `${proposal.title.toLowerCase()}|${proposal.reason.toLowerCase()}`;
    const exists = proposals.some((item) => `${item.title.toLowerCase()}|${item.reason.toLowerCase()}` === key);
    if (!exists) proposals.push(proposal);
  };

  workspaceInsights.topRiskEvents.slice(0, 2).forEach((event) => {
    addProposal({
      id: `workspace-risk-${event.id}`,
      impact: event.riskScore >= 70 ? "High" : "Medium",
      reason: event.reason,
      source: "Workspace",
      title: `Review risk for ${event.name}`,
    });
  });

  workspaceInsights.criticalTasks.slice(0, 2).forEach((task) => {
    addProposal({
      id: `workspace-task-${task.id}`,
      impact: task.priority === "High" ? "High" : task.priority === "Medium" ? "Medium" : "Low",
      reason: `Priority ${task.priority} task is ${task.status} and due ${task.dueDate}.`,
      source: "Workspace",
      title: `Clear critical task: ${task.title}`,
    });
  });

  if (eventAnalysis) {
    eventAnalysis.priorityActions.slice(0, 2).forEach((action, index) => {
      addProposal({
        id: `event-priority-${index}-${action}`,
        impact: "High",
        reason: action,
        source: "Event",
        title: analyzedEvent ? `Act on ${analyzedEvent.name}` : "Act on selected event",
      });
    });

    eventAnalysis.recommendations.slice(0, 2).forEach((recommendation, index) => {
      addProposal({
        id: `event-recommendation-${index}-${recommendation}`,
        impact: "Medium",
        reason: recommendation,
        source: "Event",
        title: analyzedEvent ? `Review recommendation for ${analyzedEvent.name}` : "Review event recommendation",
      });
    });
  }

  workspaceInsights.summary.slice(0, 3).forEach((summary, index) => {
    addProposal({
      id: `workspace-summary-${index}`,
      impact: index === 0 && workspaceInsights.healthScore < 50 ? "High" : workspaceInsights.healthScore < 75 ? "Medium" : "Low",
      reason: summary,
      source: "Workspace",
      title: index === 0 ? "Review workspace health" : "Review workspace signal",
    });
  });

  return proposals.slice(0, 7);
}

function getProposalImpactClass(impact: AIActionProposal["impact"]) {
  if (impact === "High") return "border-app-danger/30 bg-app-danger/12 text-red-100";
  if (impact === "Medium") return "border-app-warning/30 bg-app-warning/12 text-amber-100";
  return "border-app-success/30 bg-app-success/12 text-green-100";
}

function buildSponsorActionDrafts(
  workspaceInsights: ReturnType<typeof buildExecutiveInsights>,
  eventAnalysis: ReturnType<typeof getCopilotInsights> | null,
  analyzedEvent?: EventItem,
): SponsorActionDraft[] {
  const drafts: SponsorActionDraft[] = [];
  const addDraft = (draft: SponsorActionDraft) => {
    const key = `${draft.title.toLowerCase()}|${draft.targetEvent.toLowerCase()}`;
    const exists = drafts.some((item) => `${item.title.toLowerCase()}|${item.targetEvent.toLowerCase()}` === key);
    if (!exists) drafts.push(draft);
  };
  const workspaceTarget = "Workspace-wide";
  const eventTarget = analyzedEvent?.name ?? "Selected event";
  const sponsorPipeline = workspaceInsights.sponsorPipeline;

  if (sponsorPipeline.activeDeals > 0) {
    addDraft({
      expectedImpact: sponsorPipeline.healthScore < 45 ? "High" : "Medium",
      id: "workspace-follow-up-sponsor-leads",
      reason: `${formatNumber(sponsorPipeline.activeDeals)} active sponsor ${sponsorPipeline.activeDeals === 1 ? "deal needs" : "deals need"} follow-up to improve pipeline movement.`,
      targetEvent: workspaceTarget,
      title: "Follow up sponsor leads",
    });
  }

  if (sponsorPipeline.pipelineValue > sponsorPipeline.receivedValue) {
    addDraft({
      expectedImpact: sponsorPipeline.pipelineValue - sponsorPipeline.receivedValue > 0 ? "High" : "Medium",
      id: "workspace-review-sponsor-pipeline",
      reason: `${formatCurrency(Math.max(sponsorPipeline.pipelineValue - sponsorPipeline.receivedValue, 0))} remains between sponsor pipeline value and received sponsor revenue.`,
      targetEvent: workspaceTarget,
      title: "Review sponsor pipeline",
    });
  }

  if (sponsorPipeline.conversionRate < 50) {
    addDraft({
      expectedImpact: sponsorPipeline.activeDeals > 0 ? "High" : "Medium",
      id: "workspace-schedule-sponsor-meetings",
      reason: `Sponsor conversion is ${formatNumber(sponsorPipeline.conversionRate)}%, so near-term meetings can move conversations toward proposal and payment decisions.`,
      targetEvent: workspaceTarget,
      title: "Schedule sponsor meetings",
    });
  }

  if (eventAnalysis) {
    const advisor = eventAnalysis.sponsorAdvisor;
    if (advisor.sponsorGap > 0) {
      addDraft({
        expectedImpact: advisor.sponsorGap > 0 ? "High" : "Medium",
        id: "event-increase-sponsor-outreach",
        reason: `${formatCurrency(advisor.sponsorGap)} sponsor gap remains for ${eventTarget}. Focus outreach on the suggested sponsor categories.`,
        targetEvent: eventTarget,
        title: "Increase sponsor outreach",
      });
    }

    if (advisor.suggestedCategories.length > 0) {
      addDraft({
        expectedImpact: advisor.sponsorGap > 0 ? "High" : "Medium",
        id: "event-contact-potential-sponsors",
        reason: `Target ${advisor.suggestedCategories.slice(0, 3).join(", ")} sponsor categories for ${eventTarget}.`,
        targetEvent: eventTarget,
        title: `Contact ${formatNumber(Math.min(5, Math.max(3, advisor.suggestedCategories.length)))} potential sponsors`,
      });
    }

    if (advisor.opportunityValue > 0) {
      addDraft({
        expectedImpact: advisor.opportunityValue >= 100000 ? "High" : "Medium",
        id: "event-create-sponsorship-package",
        reason: `${formatCurrency(advisor.opportunityValue)} sponsor opportunity is available based on current event readiness and revenue signals.`,
        targetEvent: eventTarget,
        title: "Create sponsorship package",
      });
    }
  }

  if (drafts.length === 0) {
    addDraft({
      expectedImpact: "Low",
      id: "workspace-maintain-sponsor-review",
      reason: "Sponsor pipeline looks stable from the current intelligence signals. Keep a weekly review cadence before the next event milestone.",
      targetEvent: workspaceTarget,
      title: "Review sponsor pipeline",
    });
  }

  return drafts.slice(0, 6);
}

function buildAIApprovalQueueItems({
  actionProposals,
  analyzedEventName,
  approvedProposalIds,
  approvedSponsorDraftIds,
  approvedTimelineDraftIds,
  createdExecutionDraftIds,
  createdTimelineDraftIds,
  executionHistory,
  executionTargetEventName,
  sponsorActionDrafts,
  timelineDrafts,
}: {
  actionProposals: AIActionProposal[];
  analyzedEventName?: string;
  approvedProposalIds: string[];
  approvedSponsorDraftIds: string[];
  approvedTimelineDraftIds: string[];
  createdExecutionDraftIds: string[];
  createdTimelineDraftIds: string[];
  executionHistory: AIExecutionHistoryEntry[];
  executionTargetEventName: string;
  sponsorActionDrafts: SponsorActionDraft[];
  timelineDrafts: TimelineDraft[];
}): AIApprovalQueueItem[] {
  const proposalItems = actionProposals.map((proposal) => {
    const isExecuted = createdExecutionDraftIds.includes(proposal.id);
    const isApproved = approvedProposalIds.includes(proposal.id);
    const targetEvent = proposal.source === "Event"
      ? analyzedEventName || executionTargetEventName || "Selected event"
      : executionTargetEventName || "Workspace-wide";

    return {
      id: `proposal-${proposal.id}`,
      impact: proposal.impact,
      source: proposal.source,
      status: isExecuted ? "Executed" : isApproved ? "Approved" : "Proposed",
      targetEvent,
      title: proposal.title,
    } satisfies AIApprovalQueueItem;
  });

  const sponsorItems = sponsorActionDrafts.map((draft) => {
    const taskDraftId = getSponsorExecutionDraftId(draft.id);
    const isExecuted = createdExecutionDraftIds.includes(taskDraftId);
    const isApproved = approvedSponsorDraftIds.includes(draft.id);

    return {
      id: `sponsor-${draft.id}`,
      impact: draft.expectedImpact,
      source: "AI Center",
      status: isExecuted ? "Executed" : isApproved ? "Approved" : "Proposed",
      targetEvent: draft.targetEvent,
      title: draft.title,
    } satisfies AIApprovalQueueItem;
  });

  const timelineItems = timelineDrafts.map((draft) => {
    const undoneHistory = executionHistory.find((entry) => (
      getExecutionEntryType(entry) === "timeline"
      && entry.status === "Undone"
      && Boolean(entry.timelineDraftIds?.includes(draft.id))
    ));
    const isExecuted = createdTimelineDraftIds.includes(draft.id);
    const isApproved = approvedTimelineDraftIds.includes(draft.id);

    return {
      id: `timeline-${draft.id}`,
      impact: draft.priority,
      source: "AI Center",
      status: undoneHistory ? "Undone" : isExecuted ? "Executed" : isApproved ? "Approved" : "Proposed",
      targetEvent: draft.targetEvent,
      title: draft.title,
    } satisfies AIApprovalQueueItem;
  });

  const historyItems = executionHistory.map((entry) => {
    const entryType = getExecutionEntryType(entry);
    const itemCount = entryType === "timeline" ? entry.timelineItemCount ?? entry.timelineItemIds?.length ?? 0 : entry.taskCount;
    const itemLabel = entryType === "timeline" ? "timeline items" : "tasks";

    return {
      id: `history-${entry.id}`,
      impact: entry.status === "Undone" ? "Low" : "Medium",
      source: entry.source,
      status: entry.status === "Undone" ? "Undone" : "Executed",
      targetEvent: entry.targetEvent,
      title: `${formatNumber(itemCount)} AI-created ${itemLabel}`,
    } satisfies AIApprovalQueueItem;
  });

  return [...proposalItems, ...sponsorItems, ...timelineItems, ...historyItems];
}
function getApprovalQueueCounts(items: AIApprovalQueueItem[]) {
  return items.reduce<Record<AIApprovalQueueStatus, number>>((counts, item) => ({
    ...counts,
    [item.status]: counts[item.status] + 1,
  }), {
    Approved: 0,
    Executed: 0,
    Failed: 0,
    Proposed: 0,
    Undone: 0,
  });
}

function getApprovalQueueStatusClass(status: AIApprovalQueueStatus) {
  if (status === "Executed") return "border-app-success/30 bg-app-success/12 text-green-100";
  if (status === "Undone") return "border-app-warning/30 bg-app-warning/12 text-amber-100";
  if (status === "Failed") return "border-app-danger/30 bg-app-danger/12 text-red-100";
  if (status === "Approved") return "border-app-primary/30 bg-app-primary/12 text-blue-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function buildExecutionTaskDrafts(proposals: ExecutableProposal[]): AITaskDraft[] {
  return proposals.map((proposal) => ({
    description: proposal.reason,
    dueDate: getSuggestedDraftDueDate(proposal.impact),
    id: proposal.id,
    priority: proposal.impact,
    sourceProposal: proposal.title,
    targetEvent: proposal.targetEvent ?? "Selected execution event",
    title: proposal.title,
  }));
}

function toExecutableSponsorProposal(draft: SponsorActionDraft): ExecutableProposal {
  return {
    id: getSponsorExecutionDraftId(draft.id),
    impact: draft.expectedImpact,
    reason: draft.reason,
    source: "Workspace",
    targetEvent: draft.targetEvent,
    title: `Sponsor: ${draft.title}`,
  };
}

function getSponsorExecutionDraftId(draftId: string) {
  return `sponsor-action-${draftId}`;
}

function getSuggestedDraftDueDate(impact: AIActionProposal["impact"]) {
  const dueDate = new Date();
  const daysToAdd = impact === "High" ? 3 : impact === "Medium" ? 7 : 14;
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return dueDate.toISOString().slice(0, 10);
}

function toTimelineWriteInput(draft: TimelineExecutionDraft, event: EventItem) {
  return {
    date: getTimelineExecutionDate(draft, event),
    description: `${draft.description}\n\nSource signal: ${draft.sourceSignal}\nPriority: ${draft.priority}\nSource: AI Center`,
    eventId: event.id,
    status: "Upcoming" as const,
    title: draft.title,
  };
}

function getTimelineExecutionDate(draft: TimelineExecutionDraft, event: EventItem) {
  const now = new Date();
  const offsetDays = draft.priority === "High" ? 3 : draft.priority === "Medium" ? 7 : 14;
  const suggestedDate = new Date(now);
  suggestedDate.setDate(now.getDate() + offsetDays);

  const eventDate = new Date(event.date);
  const finalDate = Number.isNaN(eventDate.getTime()) || suggestedDate <= eventDate ? suggestedDate : eventDate;
  return finalDate.toISOString().slice(0, 10);
}

function getExecutionEntryType(entry: AIExecutionHistoryEntry) {
  return entry.entryType === "timeline" ? "timeline" : "tasks";
}

function getExecutionUndoIds(entry: AIExecutionHistoryEntry) {
  return getExecutionEntryType(entry) === "timeline" ? entry.timelineItemIds ?? [] : entry.taskIds ?? [];
}

function getExecutionItemCount(entry: AIExecutionHistoryEntry) {
  return getExecutionEntryType(entry) === "timeline"
    ? entry.timelineItemCount ?? entry.timelineItemIds?.length ?? 0
    : entry.taskCount;
}

function getExecutionHistoryTitles(entry: AIExecutionHistoryEntry) {
  return getExecutionEntryType(entry) === "timeline" ? entry.timelineItemTitles ?? [] : entry.taskTitles;
}

function getUndoSuccessMessage(entry: AIExecutionHistoryEntry, count: number) {
  return getExecutionEntryType(entry) === "timeline"
    ? `${count} AI-created timeline items undone successfully.`
    : `${count} AI-created tasks undone successfully.`;
}

function getUndoErrorMessage(entry: AIExecutionHistoryEntry) {
  return getExecutionEntryType(entry) === "timeline"
    ? "Unable to undo AI-created timeline items."
    : "Unable to undo AI-created tasks.";
}
function formatExecutionHistoryTime(createdAt: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function loadExecutionHistory(): AIExecutionHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const storedHistory = window.localStorage.getItem(AI_EXECUTION_HISTORY_STORAGE_KEY);
    if (!storedHistory) return [];

    const parsedHistory = JSON.parse(storedHistory);
    if (!Array.isArray(parsedHistory)) return [];

    return parsedHistory.filter(isExecutionHistoryEntry);
  } catch {
    return [];
  }
}

function saveExecutionHistory(history: AIExecutionHistoryEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AI_EXECUTION_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Keep AI Center usable even if browser storage is unavailable.
  }
}

function isExecutionHistoryEntry(value: unknown): value is AIExecutionHistoryEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<AIExecutionHistoryEntry>;
  return (
    typeof entry.createdAt === "string"
    && typeof entry.id === "string"
    && entry.source === "AI Center"
    && (entry.status === "Success" || entry.status === "Undone")
    && typeof entry.targetEvent === "string"
    && typeof entry.taskCount === "number"
    && Array.isArray(entry.taskTitles)
    && entry.taskTitles.every((title) => typeof title === "string")
    && (!entry.entryType || entry.entryType === "tasks" || entry.entryType === "timeline")
    && (!entry.taskIds || entry.taskIds.every((taskId) => typeof taskId === "string"))
    && (!entry.timelineDraftIds || entry.timelineDraftIds.every((draftId) => typeof draftId === "string"))
    && (!entry.timelineItemCount || typeof entry.timelineItemCount === "number")
    && (!entry.timelineItemIds || entry.timelineItemIds.every((itemId) => typeof itemId === "string"))
    && (!entry.timelineItemTitles || entry.timelineItemTitles.every((title) => typeof title === "string"))
    && (!entry.undoneAt || typeof entry.undoneAt === "string")
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

function ConfirmCreateTasksModal({
  draftCount,
  eventName,
  isCreating,
  onCancel,
  onConfirm,
}: {
  draftCount: number;
  eventName: string;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Confirm task creation</p>
            <h2 className="mt-1 text-xl font-semibold text-white">You are about to create {formatNumber(draftCount)} tasks.</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              These tasks will be added to {eventName}. No sponsors, vendors, artists, finance records, or event fields will be changed.
            </p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
            disabled={isCreating}
            onClick={onCancel}
            type="button"
          >
            <X size={17} />
          </button>
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
            <CalendarCheck2 size={17} />
            {isCreating ? "Creating..." : "Create Tasks"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmCreateTimelineItemsModal({
  draftCount,
  eventName,
  isCreating,
  onCancel,
  onConfirm,
}: {
  draftCount: number;
  eventName: string;
  isCreating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Confirm timeline creation</p>
            <h2 className="mt-1 text-xl font-semibold text-white">You are about to create {formatNumber(draftCount)} timeline items.</h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              These timeline items will be added to {eventName}. No tasks, sponsors, vendors, artists, finance records, or event fields will be changed.
            </p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
            disabled={isCreating}
            onClick={onCancel}
            type="button"
          >
            <X size={17} />
          </button>
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
            <CalendarCheck2 size={17} />
            {isCreating ? "Creating..." : "Create Timeline Items"}
          </button>
        </div>
      </div>
    </div>
  );
}
function ConfirmUndoTasksModal({
  entry,
  isUndoing,
  onCancel,
  onConfirm,
}: {
  entry?: AIExecutionHistoryEntry;
  isUndoing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!entry) return null;

  const entryType = getExecutionEntryType(entry);
  const undoCount = getExecutionUndoIds(entry).length || getExecutionItemCount(entry);
  const itemLabel = entryType === "timeline" ? "timeline items" : "tasks";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-danger">Confirm undo</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              You are about to undo this AI execution and remove {formatNumber(undoCount)} created {itemLabel}.
            </h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              EventOS will remove only the {itemLabel} recorded in this AI execution history entry for {entry.targetEvent}.
            </p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
            disabled={isUndoing}
            onClick={onCancel}
            type="button"
          >
            <X size={17} />
          </button>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUndoing}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-danger px-4 text-sm font-medium text-white shadow-glow transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-app-danger/45 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUndoing}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 size={17} />
            {isUndoing ? "Undoing..." : entryType === "timeline" ? "Undo Timeline Items" : "Undo Tasks"}
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
