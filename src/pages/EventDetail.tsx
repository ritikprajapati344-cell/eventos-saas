import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeIndianRupee,
  BriefcaseBusiness,
  CalendarDays,
  Download,
  Edit3,
  Eye,
  FileText,
  Mic2,
  Plus,
  ShieldCheck,
  ListChecks,
  Ticket,
  Trash2,
  TrendingUp,
  WalletCards,
  CheckCircle2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "../components/ChartCard";
import { axisStyle, chartPalette, gridStyle } from "../components/charts/ChartTheme";
import { EventPosterThumbnail } from "../components/EventPosterThumbnail";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { ActivitiesDataSource } from "../hooks/useActivitiesData";
import type { ArtistsDataSource } from "../hooks/useArtistsData";
import type { EventFilesDataSource } from "../hooks/useEventFilesData";
import type { EventsDataSource } from "../hooks/useEventsData";
import type { ExpensesDataSource } from "../hooks/useExpensesData";
import type { SponsorsDataSource } from "../hooks/useSponsorsData";
import type { TasksDataSource } from "../hooks/useTasksData";
import type { TicketingDataSource } from "../hooks/useTicketingData";
import type { TimelineDataSource } from "../hooks/useTimelineData";
import type { VendorsDataSource } from "../hooks/useVendorsData";
import type { ActivityWriteInput } from "../lib/activitiesRepository";
import {
  EVENT_FILE_MAX_SIZE,
  getAllowedEventFileMimeType,
} from "../lib/eventFilesRepository";
import type { ExpenseRecord } from "../lib/expensesRepository";
import type {
  CheckInStatus,
  ContractStatus,
  EventFile,
  EventOSData,
  EventStatus,
  PaymentStatus,
  SponsorStatus,
  TaskPriority,
  TaskStatus,
  VendorCategory,
} from "../types";
import {
  CUSTOM_EXPENSE_CATEGORY_OPTION,
  EXPENSE_CATEGORY_OPTIONS,
  getExpenseCategoryFormValues,
  resolveExpenseCategory,
} from "../utils/expenseCategories";
import { formatCurrency, formatNumber } from "../utils/finance";

interface EventDetailProps {
  activitiesData: ActivitiesDataSource;
  artistsData: ArtistsDataSource;
  data: EventOSData;
  eventFilesData: EventFilesDataSource;
  eventsData: EventsDataSource;
  expensesData: ExpensesDataSource;
  setData: Dispatch<SetStateAction<EventOSData>>;
  sponsorsData: SponsorsDataSource;
  tasksData: TasksDataSource;
  ticketingData: TicketingDataSource;
  timelineData: TimelineDataSource;
  vendorsData: VendorsDataSource;
}

type FormGroup = keyof typeof initialForms;

const sponsorStages: SponsorStatus[] = ["Lead", "Contacted", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];
const ticketPresets = ["Sofa", "Gold", "Silver", "Custom"];
const vendorCategories: VendorCategory[] = ["Sound", "Light", "Stage", "Decoration", "Security", "Food"];
const riderStatuses = ["Pending", "Received", "Approved"];
const contractStatuses = ["Draft", "Sent", "Signed", "On Hold"];
const paymentStatuses = ["Pending", "Partial", "Paid"];
const booleanOptions = ["No", "Yes"];

const initialForms = {
  ticket: { preset: "Sofa", customName: "", price: "", inventory: "", sold: "0" },
  sponsor: {
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    sponsorshipAmount: "",
    status: "Lead",
    agreementUploaded: "No",
    paymentReceived: "No",
  },
  artist: {
    name: "",
    fee: "",
    travelCost: "0",
    hotelCost: "0",
    greenRoomCost: "0",
    technicalRiderStatus: "Pending",
    contractStatus: "Draft",
    paymentStatus: "Pending",
  },
  vendor: { name: "", category: "Sound", amount: "", advancePaid: "0", status: "Pending", dueDate: "2026-06-15" },
  expense: { category: "Marketing", customCategory: "", description: "", amount: "", date: "2026-06-15" },
  file: { name: "", fileType: "PDF", uploadDate: "2026-06-15" },
  timeline: { title: "", description: "", date: "2026-06-15", status: "Upcoming" },
  task: { title: "", owner: "Ops", dueDate: "2026-06-15", priority: "Medium", status: "Open" },
};

const tooltipStyle = {
  background: "#0F172A",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  color: "#E5EEF9",
};

export default function EventDetail({
  activitiesData,
  artistsData,
  data,
  eventFilesData,
  eventsData,
  expensesData,
  setData,
  sponsorsData,
  tasksData,
  ticketingData,
  timelineData,
  vendorsData,
}: EventDetailProps) {
  const location = useLocation();
  const { eventId } = useParams();
  const event = data.events.find((item) => item.id === eventId);
  const [forms, setForms] = useState(initialForms);
  const [activityWarning, setActivityWarning] = useState(() => getNavigationActivityWarning(location.state));
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ group: FormGroup; id: string } | null>(null);
  const [fileActionId, setFileActionId] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [notesDraft, setNotesDraft] = useState(event?.notes ?? "");
  const lastSavedNotesRef = useRef(event?.notes ?? "");
  const notesSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const scoped = useMemo(() => (eventId ? calculateEventWorkspace(data, eventId) : null), [data, eventId]);

  useEffect(() => {
    setNotesDraft(event?.notes ?? "");
    lastSavedNotesRef.current = event?.notes ?? "";
  }, [event?.id]);

  useEffect(() => {
    if (!eventsData.isSupabaseMode || !eventId || !event || notesDraft === lastSavedNotesRef.current) {
      return;
    }

    const notesToSave = notesDraft;
    const timeoutId = window.setTimeout(() => {
      notesSaveQueueRef.current = notesSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (notesToSave === lastSavedNotesRef.current) return;
          await eventsData.updateEventNotes(eventId, notesToSave);
          lastSavedNotesRef.current = notesToSave;
        })
        .catch((saveError: unknown) => {
          setError(getErrorMessage(saveError, "Unable to save event notes in Supabase."));
        });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [event?.id, eventId, eventsData.isSupabaseMode, eventsData.updateEventNotes, notesDraft]);

  if (!event || !eventId || !scoped) {
    return (
      <div className="glass-panel rounded-lg p-6">
        <Link className="inline-flex items-center gap-2 text-sm text-app-primary" to="/events">
          <ArrowLeft size={16} />
          Back to Events
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">Event not found</h1>
      </div>
    );
  }

  const getExistingTicketFromForm = (form: Record<string, string>) => findTicketCategory(scoped.tickets, getTicketCategoryName(form));
  const activeTicketCategory = getExistingTicketFromForm(forms.ticket);
  const isUpdatingTicketCategory = Boolean(activeTicketCategory);

  const recordActivity = async (input: ActivityWriteInput) => {
    try {
      await activitiesData.createActivity(input);
      setActivityWarning("");
    } catch {
      setActivityWarning("The workspace change was saved, but its activity could not be recorded.");
    }
  };

  const updateForm = (group: FormGroup, field: string, value: string) => {
    if (group === "ticket" && field === "preset") {
      const existingTicket = value === "Custom" ? undefined : findTicketCategory(scoped.tickets, value);
      setForms((current) => ({
        ...current,
        ticket: {
          ...current.ticket,
          preset: value,
          customName: "",
          price: existingTicket ? String(existingTicket.price) : "",
          inventory: existingTicket ? String(existingTicket.inventory) : "",
          sold: "0",
        },
      }));
      setError("");
      return;
    }

    if (group === "ticket" && field === "customName") {
      const existingTicket = findTicketCategory(scoped.tickets, value);
      setForms((current) => ({
        ...current,
        ticket: {
          ...current.ticket,
          customName: value,
          price: existingTicket ? String(existingTicket.price) : current.ticket.price,
          inventory: existingTicket ? String(existingTicket.inventory) : current.ticket.inventory,
          sold: existingTicket ? "0" : current.ticket.sold,
        },
      }));
      setError("");
      return;
    }

    setForms((current) => ({ ...current, [group]: { ...current[group], [field]: value } }));
    setError("");
  };

  const saveGroup = async (group: FormGroup, submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const validationError = validateGroup(group, forms[group], group === "ticket" ? scoped.tickets : undefined);
    if (validationError) {
      setError(validationError);
      return;
    }

    const editId = editing?.group === group ? editing.id : undefined;

    if (isCloudReadyGroup(group) && eventsData.isSupabaseMode) {
      let activityInput: ActivityWriteInput | null = null;
      try {
        activityInput = await saveSupabaseGroup({
          artistsData,
          editId,
          eventId,
          expensesData,
          form: forms[group],
          group,
          scoped,
          sponsorsData,
          tasksData,
          ticketingData,
          timelineData,
          vendorsData,
        });
      } catch (saveError) {
        setError(getErrorMessage(saveError, `Unable to save ${group} in Supabase.`));
        return;
      }
      if (activityInput) {
        await recordActivity(activityInput);
      }
    } else {
      setData((current) => applyEventUpdate(current, eventId, group, forms[group], editId));
    }

    setForms((current) => ({ ...current, [group]: initialForms[group] }));
    setEditing(null);
    setError("");
  };

  const startEdit = (group: FormGroup, id: string, nextForm: Record<string, string>) => {
    setForms((current) => ({ ...current, [group]: { ...current[group], ...nextForm } }));
    setEditing({ group, id });
    setError("");
  };

  const cancelEdit = () => {
    if (!editing) return;
    setForms((current) => ({ ...current, [editing.group]: initialForms[editing.group] }));
    setEditing(null);
    setError("");
  };

  const deleteItem = async (group: FormGroup, id: string) => {
    if (isCloudReadyDeleteGroup(group) && eventsData.isSupabaseMode) {
      try {
        await deleteSupabaseItem(group, id, {
          artistsData,
          expensesData,
          sponsorsData,
          tasksData,
          timelineData,
          vendorsData,
        });
      } catch (deleteError) {
        setError(getErrorMessage(deleteError, `Unable to delete ${group} from Supabase.`));
        return;
      }
    } else {
      setData((current) => deleteEventItem(current, eventId, group, id));
    }

    if (editing?.id === id) cancelEdit();
    setError("");
  };

  const completeTask = async (taskId: string) => {
    if (tasksData.isSupabaseMode) {
      try {
        const completedTask = await tasksData.completeTask(taskId);
        await recordActivity({
          entity: "Events",
          entityId: completedTask.id,
          eventId,
          message: "Completed event task",
          metadata: { action: "completed", source: "event-detail" },
          type: "Task",
        });
        setError("");
      } catch (completeError) {
        setError(getErrorMessage(completeError, "Unable to complete the task in Supabase."));
      }
      return;
    }

    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status: "Done" as TaskStatus } : task)),
      activities: [{ id: `activity-${Date.now()}`, message: "Completed event task", entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
    }));
  };

  const uploadFile = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const input = changeEvent.currentTarget;
    const file = changeEvent.target.files?.[0];
    if (!file) return;

    if (eventFilesData.isSupabaseMode) {
      if (!getAllowedEventFileMimeType(file)) {
        setError("Only PDF, JPG, PNG and DOCX files can be uploaded.");
        input.value = "";
        return;
      }
      if (file.size > EVENT_FILE_MAX_SIZE) {
        setError("Event files must be 10 MB or smaller.");
        input.value = "";
        return;
      }

      eventFilesData.clearError();
      setIsUploadingFile(true);
      setError("");
      try {
        const uploadedFile = await eventFilesData.uploadFile(eventId, file);
        await recordActivity({
          entity: "Files",
          entityId: uploadedFile.id,
          eventId,
          message: `Uploaded file ${uploadedFile.name}`,
          metadata: {
            action: "uploaded",
            fileName: uploadedFile.name,
            fileType: uploadedFile.fileType,
            source: "event-detail",
          },
          type: "File",
        });
        input.value = "";
      } catch (uploadError) {
        setError(getErrorMessage(uploadError, "Unable to upload the event file."));
      } finally {
        setIsUploadingFile(false);
      }
      return;
    }

    if (!isAllowedFile(file)) {
      setError("Only PDF, JPG, PNG and DOCX files can be uploaded.");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setData((current) => ({
        ...current,
        events: current.events.map((item) =>
          item.id === eventId
            ? {
                ...item,
                files: [{
                  id: `file-${Date.now()}`,
                  name: file.name,
                  fileType: getFileTypeLabel(file),
                  uploadDate: new Date().toISOString().slice(0, 10),
                  size: file.size,
                  dataUrl,
                }, ...item.files],
              }
            : item,
        ),
        activities: [{ id: `activity-${Date.now()}`, message: `Uploaded file ${file.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
      }));
      setError("");
      input.value = "";
    };
    reader.readAsDataURL(file);
  };

  const updateNotes = (notes: string) => {
    if (eventsData.isSupabaseMode) {
      setNotesDraft(notes);
      setError("");
      return;
    }

    setData((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === eventId ? { ...item, notes } : item)),
    }));
  };

  const viewEventFile = async (file: EventFile) => {
    if (!eventFilesData.isSupabaseMode) {
      viewLocalFile(file.dataUrl);
      return;
    }

    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setError("Your browser blocked the file preview window. Allow pop-ups and try again.");
      return;
    }
    popup.opener = null;

    eventFilesData.clearError();
    setFileActionId(`view-${file.id}`);
    setError("");
    try {
      const signedUrl = await eventFilesData.createViewUrl(file);
      popup.location.replace(signedUrl);
    } catch (viewError) {
      popup.close();
      setError(getErrorMessage(viewError, "Unable to open the event file."));
    } finally {
      setFileActionId(null);
    }
  };

  const downloadEventFile = async (file: EventFile) => {
    if (!eventFilesData.isSupabaseMode) {
      downloadLocalFile(file);
      return;
    }

    eventFilesData.clearError();
    setFileActionId(`download-${file.id}`);
    setError("");
    try {
      const signedUrl = await eventFilesData.createDownloadUrl(file);
      const anchor = document.createElement("a");
      anchor.href = signedUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, "Unable to download the event file."));
    } finally {
      setFileActionId(null);
    }
  };

  const deleteFile = async (file: EventFile) => {
    if (eventFilesData.isSupabaseMode) {
      eventFilesData.clearError();
      setFileActionId(`delete-${file.id}`);
      setError("");
      try {
        await eventFilesData.deleteFile(file);
      } catch (deleteError) {
        setError(getErrorMessage(deleteError, "Unable to delete the event file."));
      } finally {
        setFileActionId(null);
      }
      return;
    }

    setData((current) => ({
      ...current,
      events: current.events.map((item) =>
        item.id === eventId ? { ...item, files: item.files.filter((itemFile) => itemFile.id !== file.id) } : item,
      ),
    }));
  };

  const visibleError = error || (eventFilesData.isSupabaseMode ? eventFilesData.error ?? "" : "");

  return (
    <div className="space-y-4">
      <PageHeader
        title={event.name}
        description={`${event.venue} - ${new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
        action={
          <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]" to="/events">
            <ArrowLeft size={16} />
            Events
          </Link>
        }
      />

      <section className="glass-panel flex min-w-0 flex-col gap-4 rounded-lg p-3 sm:flex-row sm:items-center sm:p-4">
        <EventPosterThumbnail event={event} size="header" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={event.status} tone={getEventStatusTone(event.status)} />
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
              {event.eventType}
            </span>
          </div>
          <h2 className="mt-3 break-words text-lg font-semibold text-white">{event.name}</h2>
          <div className="mt-2 grid gap-2 text-sm text-app-muted sm:grid-cols-2 xl:grid-cols-4">
            <span className="break-words">{event.venue}, {event.city}</span>
            <span>{new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at {event.eventTime}</span>
            <span>Capacity {formatNumber(event.capacity)}</span>
            <span className="break-words">Main artist {event.mainArtist || "TBC"}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <EventKpi title="Revenue" value={formatCurrency(scoped.actualRevenue)} helper="Actual ticket + sponsor" icon={BadgeIndianRupee} tone="success" />
        <EventKpi title="Expenses" value={formatCurrency(scoped.actualExpense)} helper="Paid/recorded event cost" icon={WalletCards} tone="warning" />
        <EventKpi title="Profit" value={formatCurrency(scoped.actualProfit)} helper="Actual revenue minus expense" icon={TrendingUp} tone={scoped.actualProfit >= 0 ? "success" : "danger"} />
        <EventKpi title="Ticket Revenue" value={formatCurrency(scoped.ticketRevenue)} helper={`${formatNumber(scoped.totalTicketsSold)} tickets sold`} icon={Ticket} />
        <EventKpi title="Sponsor Revenue" value={formatCurrency(scoped.sponsorRevenue)} helper="Payment received deals" icon={BriefcaseBusiness} />
      </section>

      {visibleError && <p className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 py-2 text-sm text-red-100">{visibleError}</p>}
      {activityWarning && <p className="rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-sm text-amber-100">{activityWarning}</p>}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <WorkspacePanel title="Professional Ticket Management" icon={Ticket}>
          <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-app-muted">
            Select an existing category to update it, or choose Custom to create a new category.
          </p>
          <CompactForm onSubmit={(event) => saveGroup("ticket", event)} submitLabel={isUpdatingTicketCategory ? "Update Category" : "Add Category"}>
            <Select label="Category" value={forms.ticket.preset} onChange={(value) => updateForm("ticket", "preset", value)} options={ticketPresets} />
            {forms.ticket.preset === "Custom" && <Input label="Custom Name" value={forms.ticket.customName} onChange={(value) => updateForm("ticket", "customName", value)} />}
            <Input label="Ticket Price" type="number" value={forms.ticket.price} onChange={(value) => updateForm("ticket", "price", value)} />
            <Input label="Inventory" type="number" value={forms.ticket.inventory} onChange={(value) => updateForm("ticket", "inventory", value)} />
            <Input label={isUpdatingTicketCategory ? "Additional Sold" : "Sold"} type="number" value={forms.ticket.sold} onChange={(value) => updateForm("ticket", "sold", value)} />
            {activeTicketCategory && (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300 sm:self-end">
                Current sold: <span className="font-semibold text-white">{formatNumber(activeTicketCategory.sold)}</span> / {formatNumber(activeTicketCategory.inventory)}
              </div>
            )}
          </CompactForm>
          <div className="grid gap-3 md:grid-cols-2">
            {scoped.tickets.map((ticket) => {
              const available = Math.max(ticket.inventory - ticket.sold, 0);
              const percent = ticket.inventory > 0 ? Math.min(100, Math.round((ticket.sold / ticket.inventory) * 100)) : 0;
              const status = getTicketStatus(ticket.sold, ticket.inventory);
              return (
                <article key={ticket.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{ticket.name}</p>
                      <p className="mt-1 text-sm text-app-muted">{formatCurrency(ticket.price)}</p>
                    </div>
                    <StatusBadge label={status} tone={status === "Sold Out" ? "green" : status === "Active" ? "blue" : "slate"} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-300">Sold {formatNumber(ticket.sold)} / {formatNumber(ticket.inventory)}</span>
                    <span className="text-app-muted">{formatNumber(available)} available</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-app-success" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">Revenue {formatCurrency(ticket.sold * ticket.price)}</p>
                </article>
              );
            })}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Event Financial Summary" icon={BadgeIndianRupee}>
          <SummaryRow label="Expected Revenue" value={formatCurrency(scoped.expectedRevenue)} />
          <SummaryRow label="Actual Revenue" value={formatCurrency(scoped.actualRevenue)} strong positive={scoped.actualRevenue >= scoped.expectedRevenue * 0.5} />
          <SummaryRow label="Expected Expense" value={formatCurrency(scoped.expectedExpense)} />
          <SummaryRow label="Actual Expense" value={formatCurrency(scoped.actualExpense)} danger />
          <SummaryRow label="Expected Profit" value={formatCurrency(scoped.expectedProfit)} positive={scoped.expectedProfit >= 0} danger={scoped.expectedProfit < 0} />
          <SummaryRow label="Actual Profit" value={formatCurrency(scoped.actualProfit)} strong positive={scoped.actualProfit >= 0} danger={scoped.actualProfit < 0} />
        </WorkspacePanel>
      </section>

      <section className="grid gap-4 2xl:grid-cols-3">
        <WorkspacePanel title="Sponsor Management" icon={BriefcaseBusiness}>
          <CompactForm onCancel={editing?.group === "sponsor" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("sponsor", event)} submitLabel={editing?.group === "sponsor" ? "Update Sponsor" : "Add"}>
            <Input label="Company Name" value={forms.sponsor.companyName} onChange={(value) => updateForm("sponsor", "companyName", value)} />
            <Input label="Contact Person" value={forms.sponsor.contactPerson} onChange={(value) => updateForm("sponsor", "contactPerson", value)} />
            <Input label="Phone" value={forms.sponsor.phone} onChange={(value) => updateForm("sponsor", "phone", value)} />
            <Input label="Email" type="email" value={forms.sponsor.email} onChange={(value) => updateForm("sponsor", "email", value)} />
            <Input label="Deal Amount" type="number" value={forms.sponsor.sponsorshipAmount} onChange={(value) => updateForm("sponsor", "sponsorshipAmount", value)} />
            <Select label="Status" value={forms.sponsor.status} onChange={(value) => updateForm("sponsor", "status", value)} options={sponsorStages} />
            <Select label="Agreement Uploaded" value={forms.sponsor.agreementUploaded} onChange={(value) => updateForm("sponsor", "agreementUploaded", value)} options={booleanOptions} />
            <Select label="Payment Received" value={forms.sponsor.paymentReceived} onChange={(value) => updateForm("sponsor", "paymentReceived", value)} options={booleanOptions} />
          </CompactForm>
          <RecordGrid
            emptyText="No sponsors saved yet."
            items={scoped.sponsors.map((sponsor) => ({
              id: sponsor.id,
              title: sponsor.companyName,
              meta: [sponsor.contactPerson, sponsor.phone || "No phone", sponsor.email || "No email"],
              rows: [
                ["Deal", formatCurrency(sponsor.sponsorshipAmount)],
                ["Status", sponsor.status],
                ["Agreement", sponsor.agreementUploaded ? "Uploaded" : "Pending"],
                ["Payment", sponsor.paymentReceived ? "Received" : "Pending"],
              ],
              badges: [{ label: sponsor.status, tone: sponsor.status === "Closed Won" ? "green" : sponsor.status === "Closed Lost" ? "red" : "blue" }],
              onEdit: () => startEdit("sponsor", sponsor.id, {
                companyName: sponsor.companyName,
                contactPerson: sponsor.contactPerson,
                phone: sponsor.phone || "",
                email: sponsor.email || "",
                sponsorshipAmount: String(sponsor.sponsorshipAmount),
                status: sponsor.status,
                agreementUploaded: sponsor.agreementUploaded ? "Yes" : "No",
                paymentReceived: sponsor.paymentReceived ? "Yes" : "No",
              }),
              onDelete: () => deleteItem("sponsor", sponsor.id),
            }))}
          />
          <p className="mt-3 text-sm font-semibold text-white">Total sponsor revenue: {formatCurrency(scoped.sponsorRevenue)}</p>
        </WorkspacePanel>

        <WorkspacePanel title="Artist Management" icon={Mic2}>
          <CompactForm onCancel={editing?.group === "artist" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("artist", event)} submitLabel={editing?.group === "artist" ? "Update Artist" : "Add"}>
            <Input label="Artist Name" value={forms.artist.name} onChange={(value) => updateForm("artist", "name", value)} />
            <Input label="Performance Fee" type="number" value={forms.artist.fee} onChange={(value) => updateForm("artist", "fee", value)} />
            <Input label="Travel Cost" type="number" value={forms.artist.travelCost} onChange={(value) => updateForm("artist", "travelCost", value)} />
            <Input label="Hotel Cost" type="number" value={forms.artist.hotelCost} onChange={(value) => updateForm("artist", "hotelCost", value)} />
            <Input label="Green Room Cost" type="number" value={forms.artist.greenRoomCost} onChange={(value) => updateForm("artist", "greenRoomCost", value)} />
            <Select label="Technical Rider" value={forms.artist.technicalRiderStatus} onChange={(value) => updateForm("artist", "technicalRiderStatus", value)} options={riderStatuses} />
            <Select label="Contract Status" value={forms.artist.contractStatus} onChange={(value) => updateForm("artist", "contractStatus", value)} options={contractStatuses} />
            <Select label="Payment Status" value={forms.artist.paymentStatus} onChange={(value) => updateForm("artist", "paymentStatus", value)} options={paymentStatuses} />
          </CompactForm>
          <RecordGrid
            emptyText="No artists saved yet."
            items={scoped.artists.map((artist) => ({
              id: artist.id,
              title: artist.name,
              meta: [artist.profile, artist.performanceSlot],
              rows: [
                ["Total Cost", formatCurrency(getArtistTotal(artist))],
                ["Rider", artist.technicalRiderStatus || "Pending"],
                ["Contract", artist.contractStatus],
                ["Payment", artist.paymentStatus],
              ],
              badges: [{ label: artist.paymentStatus, tone: artist.paymentStatus === "Paid" ? "green" : artist.paymentStatus === "Partial" ? "amber" : "slate" }],
              onEdit: () => startEdit("artist", artist.id, {
                name: artist.name,
                fee: String(artist.fee),
                travelCost: String(artist.travelCost),
                hotelCost: String(artist.hotelCost),
                greenRoomCost: String(artist.greenRoomCost ?? 0),
                technicalRiderStatus: artist.technicalRiderStatus || "Pending",
                contractStatus: artist.contractStatus,
                paymentStatus: artist.paymentStatus,
              }),
              onDelete: () => deleteItem("artist", artist.id),
            }))}
          />
          <p className="mt-3 text-sm font-semibold text-white">Total artist cost: {formatCurrency(scoped.artistCost)}</p>
        </WorkspacePanel>

        <WorkspacePanel title="Vendor Management" icon={ShieldCheck}>
          <CompactForm onCancel={editing?.group === "vendor" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("vendor", event)} submitLabel={editing?.group === "vendor" ? "Update Vendor" : "Add"}>
            <Input label="Vendor Name" value={forms.vendor.name} onChange={(value) => updateForm("vendor", "name", value)} />
            <Select label="Category" value={forms.vendor.category} onChange={(value) => updateForm("vendor", "category", value)} options={vendorCategories} />
            <Input label="Amount" type="number" value={forms.vendor.amount} onChange={(value) => updateForm("vendor", "amount", value)} />
            <Input label="Advance Paid" type="number" value={forms.vendor.advancePaid} onChange={(value) => updateForm("vendor", "advancePaid", value)} />
            <Input label="Due Date" type="date" value={forms.vendor.dueDate} onChange={(value) => updateForm("vendor", "dueDate", value)} />
            <Select label="Status" value={forms.vendor.status} onChange={(value) => updateForm("vendor", "status", value)} options={["Pending", "Paid"]} />
          </CompactForm>
          <RecordGrid
            emptyText="No vendors saved yet."
            items={scoped.vendors.map((vendor) => ({
              id: vendor.id,
              title: vendor.name,
              meta: [vendor.category, `Due ${new Date(vendor.dueDate).toLocaleDateString("en-IN")}`],
              rows: [
                ["Amount", formatCurrency(vendor.amount)],
                ["Advance", formatCurrency(vendor.advancePaid ?? 0)],
                ["Remaining", formatCurrency(getVendorRemaining(vendor))],
                ["Status", vendor.status],
              ],
              badges: [{ label: vendor.status, tone: vendor.status === "Paid" ? "green" : "amber" }],
              onEdit: () => startEdit("vendor", vendor.id, {
                name: vendor.name,
                category: vendor.category,
                amount: String(vendor.amount),
                advancePaid: String(vendor.advancePaid ?? 0),
                dueDate: vendor.dueDate,
                status: vendor.status,
              }),
              onDelete: () => deleteItem("vendor", vendor.id),
            }))}
          />
          <p className="mt-3 text-sm font-semibold text-white">Outstanding payments: {formatCurrency(scoped.vendorOutstanding)}</p>
        </WorkspacePanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkspacePanel title="Expenses" icon={WalletCards}>
          <CompactForm onCancel={editing?.group === "expense" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("expense", event)} submitLabel={editing?.group === "expense" ? "Update Expense" : "Add"}>
            <Select label="Category" value={forms.expense.category} onChange={(value) => updateForm("expense", "category", value)} options={EXPENSE_CATEGORY_OPTIONS} />
            {forms.expense.category === CUSTOM_EXPENSE_CATEGORY_OPTION && (
              <Input label="Custom Category" value={forms.expense.customCategory} onChange={(value) => updateForm("expense", "customCategory", value)} />
            )}
            <Input label="Description" value={forms.expense.description} onChange={(value) => updateForm("expense", "description", value)} />
            <Input label="Amount" type="number" value={forms.expense.amount} onChange={(value) => updateForm("expense", "amount", value)} />
            <Input label="Date" type="date" value={forms.expense.date} onChange={(value) => updateForm("expense", "date", value)} />
          </CompactForm>
          <RecordGrid
            emptyText="No expenses saved yet."
            items={scoped.expenses.map((expense) => ({
              id: expense.id,
              title: expense.description,
              meta: [expense.category, new Date(expense.date).toLocaleDateString("en-IN")],
              rows: [["Amount", formatCurrency(expense.amount)]],
              badges: [{ label: expense.category, tone: "amber" }],
              onEdit: () => startEdit("expense", expense.id, {
                ...getExpenseCategoryFormValues(expense.category),
                description: expense.description,
                amount: String(expense.amount),
                date: expense.date,
              }),
              onDelete: () => deleteItem("expense", expense.id),
            }))}
          />
        </WorkspacePanel>

        <WorkspacePanel title="Event-Specific Timeline" icon={CalendarDays}>
          <CompactForm onCancel={editing?.group === "timeline" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("timeline", event)} submitLabel={editing?.group === "timeline" ? "Update Timeline" : "Add"}>
            <Input label="Title" value={forms.timeline.title} onChange={(value) => updateForm("timeline", "title", value)} />
            <Input label="Description" value={forms.timeline.description} onChange={(value) => updateForm("timeline", "description", value)} />
            <Input label="Date" type="date" value={forms.timeline.date} onChange={(value) => updateForm("timeline", "date", value)} />
            <Select label="Status" value={forms.timeline.status} onChange={(value) => updateForm("timeline", "status", value)} options={["Done", "Active", "Upcoming"]} />
          </CompactForm>
          <RecordGrid
            emptyText="No timeline items saved yet."
            items={scoped.timeline.map((item) => ({
              id: item.id,
              title: item.title,
              meta: [new Date(item.date).toLocaleDateString("en-IN"), item.description],
              rows: [],
              badges: [{ label: item.status, tone: item.status === "Done" ? "green" : item.status === "Active" ? "blue" : "amber" }],
              onEdit: () => startEdit("timeline", item.id, {
                title: item.title,
                description: item.description,
                date: item.date,
                status: item.status,
              }),
              onDelete: () => deleteItem("timeline", item.id),
            }))}
          />
        </WorkspacePanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkspacePanel title="Tasks" icon={ListChecks}>
          <CompactForm onCancel={editing?.group === "task" ? cancelEdit : undefined} onSubmit={(event) => saveGroup("task", event)} submitLabel={editing?.group === "task" ? "Update Task" : "Add Task"}>
            <Input label="Task Title" value={forms.task.title} onChange={(value) => updateForm("task", "title", value)} />
            <Input label="Owner" value={forms.task.owner} onChange={(value) => updateForm("task", "owner", value)} />
            <Input label="Due Date" type="date" value={forms.task.dueDate} onChange={(value) => updateForm("task", "dueDate", value)} />
            <Select label="Priority" value={forms.task.priority} onChange={(value) => updateForm("task", "priority", value)} options={["High", "Medium", "Low"]} />
            <Select label="Status" value={forms.task.status} onChange={(value) => updateForm("task", "status", value)} options={["Open", "In Progress", "Blocked", "Done"]} />
          </CompactForm>
          <RecordGrid
            emptyText="No tasks for this event yet."
            items={scoped.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              meta: [task.owner, `Due ${new Date(task.dueDate).toLocaleDateString("en-IN")}`],
              rows: [],
              badges: [
                { label: task.priority, tone: task.priority === "High" ? "red" : task.priority === "Medium" ? "amber" : "green" },
                { label: task.status, tone: task.status === "Done" ? "green" : task.status === "Blocked" ? "red" : "blue" },
              ],
              onComplete: task.status === "Done" ? undefined : () => completeTask(task.id),
              onEdit: () => startEdit("task", task.id, {
                title: task.title,
                owner: task.owner,
                dueDate: task.dueDate,
                priority: task.priority,
                status: task.status,
              }),
              onDelete: () => deleteItem("task", task.id),
            }))}
          />
        </WorkspacePanel>

        <WorkspacePanel title="Workspace Health" icon={TrendingUp}>
          <SummaryRow label="Ticket Categories" value={formatNumber(scoped.tickets.length)} />
          <SummaryRow label="Sponsors" value={formatNumber(scoped.sponsors.length)} />
          <SummaryRow label="Artists" value={formatNumber(scoped.artists.length)} />
          <SummaryRow label="Vendors" value={formatNumber(scoped.vendors.length)} />
          <SummaryRow label="Tasks" value={formatNumber(scoped.tasks.length)} />
        </WorkspacePanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <WorkspacePanel title="Event Notes" icon={FileText}>
          <textarea
            className="min-h-40 w-full resize-y rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-white outline-none focus:border-app-primary"
            value={eventsData.isSupabaseMode ? notesDraft : event.notes}
            onChange={(changeEvent) => updateNotes(changeEvent.target.value)}
          />
          <p className="mt-2 text-xs text-app-muted">
            Notes save automatically to {eventsData.isSupabaseMode ? "your workspace" : "localStorage"}.
          </p>
        </WorkspacePanel>

        <WorkspacePanel title="Event Files" icon={FileText}>
          <label className="mb-4 block rounded-lg border border-dashed border-white/15 bg-white/[0.035] p-4 transition hover:border-app-primary/35 hover:bg-app-primary/10">
            <span className="text-sm font-medium text-white">Upload event file</span>
            <span className="mt-1 block text-xs text-app-muted">
              {eventFilesData.isSupabaseMode
                ? "PDF, JPG, PNG or DOCX, up to 10 MB. Stored securely in your workspace."
                : "PDF, JPG, PNG or DOCX. Stored locally in this browser."}
            </span>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-app-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
              disabled={isUploadingFile}
              onChange={uploadFile}
              type="file"
            />
          </label>
          <div className="space-y-2">
            {event.files.length === 0 && <p className="rounded-lg bg-white/[0.035] p-3 text-sm text-app-muted">No files uploaded yet.</p>}
            {event.files.map((file) => (
              <div key={file.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-white">{file.name}</p>
                  <p className="mt-1 break-words text-xs text-app-muted">
                    {getFileTypeDisplay(file)} - Uploaded {new Date(file.uploadDate).toLocaleDateString("en-IN")} - {formatFileSize(file.size)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <FileAction disabled={fileActionId !== null} label="View" icon={Eye} onClick={() => void viewEventFile(file)} />
                  <FileAction disabled={fileActionId !== null} label="Download" icon={Download} onClick={() => void downloadEventFile(file)} />
                  <button className="grid h-9 w-9 place-items-center rounded-lg border border-app-danger/30 bg-app-danger/10 text-red-200 transition hover:bg-app-danger/20 disabled:cursor-not-allowed disabled:opacity-50" disabled={fileActionId !== null} onClick={() => void deleteFile(file)} type="button">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </WorkspacePanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Ticket Revenue Chart" subtitle="Revenue generated by each ticket category">
          <ChartBox>
            {scoped.ticketChart.length === 0 ? <ChartEmpty text="Add ticket categories to see ticket revenue." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoped.ticketChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                  <Bar dataKey="revenue" name="Ticket Revenue" fill={chartPalette.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBox>
        </ChartCard>

        <ChartCard title="Expense Breakdown Chart" subtitle="Event expenses by category">
          <ChartBox>
            {scoped.expenseChart.length === 0 ? <ChartEmpty text="Add expenses, artists, or vendors to see cost breakdown." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scoped.expenseChart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>
                    {scoped.expenseChart.map((item, index) => (
                      <Cell key={item.name} fill={[chartPalette.blue, chartPalette.green, chartPalette.amber, chartPalette.red, chartPalette.cyan, chartPalette.violet][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartBox>
        </ChartCard>

        <ChartCard title="Sponsor Revenue Chart" subtitle="Deal value and received sponsorships">
          <ChartBox>
            {scoped.sponsorChart.length === 0 ? <ChartEmpty text="Add sponsors to see deal and received revenue." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoped.sponsorChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                  <Bar dataKey="deal" name="Deal Amount" fill={chartPalette.blue} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="received" name="Received" fill={chartPalette.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartBox>
        </ChartCard>

        <ChartCard title="Profit Trend Chart" subtitle="Expected and actual profit checkpoints">
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoped.profitTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={52} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                <Line type="monotone" dataKey="expected" name="Expected Profit" stroke={chartPalette.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="actual" name="Actual Profit" stroke={scoped.actualProfit >= 0 ? chartPalette.green : chartPalette.red} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </ChartCard>
      </section>
    </div>
  );
}

function EventKpi({ title, value, helper, icon: Icon, tone = "primary" }: { title: string; value: string; helper: string; icon: typeof Ticket; tone?: "primary" | "success" | "warning" | "danger" }) {
  const tones = {
    primary: "border-app-primary/30 bg-app-primary/14 text-blue-200",
    success: "border-app-success/30 bg-app-success/14 text-green-200",
    warning: "border-app-warning/30 bg-app-warning/14 text-amber-200",
    danger: "border-app-danger/30 bg-app-danger/14 text-red-200",
  };

  return (
    <article className="glass-panel min-w-0 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-app-muted">{title}</p>
          <p className={`mt-2 break-words text-xl font-semibold leading-tight ${tone === "danger" ? "text-app-danger" : tone === "success" ? "text-app-success" : "text-white"}`}>{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{helper}</p>
    </article>
  );
}

function WorkspacePanel({ title, icon: Icon, children }: { title: string; icon: typeof Ticket; children: React.ReactNode }) {
  return (
    <section className="glass-panel min-w-0 overflow-hidden rounded-lg p-3 sm:p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/12 text-blue-200">
          <Icon size={17} />
        </div>
        <h2 className="min-w-0 break-words text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChartBox({ children }: { children: React.ReactNode }) {
  return <div className="h-[240px] min-h-0 min-w-0 overflow-hidden sm:h-[300px]">{children}</div>;
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="grid h-full place-items-center rounded-lg border border-white/10 bg-white/[0.025] px-4 text-center text-sm text-app-muted">{text}</div>;
}

function CompactForm({
  children,
  onCancel,
  onSubmit,
  submitLabel = "Add",
}: {
  children: React.ReactNode;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
}) {
  return (
    <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      {children}
      <div className="flex flex-col gap-2 min-[420px]:flex-row sm:self-end">
        {onCancel && (
          <button className="h-10 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
        <button className="h-10 flex-1 rounded-lg bg-app-primary px-3 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500" type="submit">
          <Plus className="mr-2 inline h-4 w-4" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <input className="dashboard-input mt-2" min={type === "number" ? 0 : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <select className="dashboard-input mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function FileAction({
  disabled = false,
  label,
  icon: Icon,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  icon: typeof Eye;
  onClick: () => void;
}) {
  return (
    <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={onClick} title={label} type="button">
      <Icon size={15} />
    </button>
  );
}

interface RecordCardItem {
  id: string;
  title: string;
  meta: string[];
  rows: Array<[string, string]>;
  badges?: Array<{ label: string; tone: "blue" | "green" | "amber" | "red" | "slate" }>;
  onComplete?: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function RecordGrid({ emptyText, items }: { emptyText: string; items: RecordCardItem[] }) {
  if (items.length === 0) return <p className="rounded-lg bg-white/[0.035] p-3 text-sm text-app-muted">{emptyText}</p>;

  return (
    <div className="grid auto-rows-fr gap-3">
      {items.map((item) => (
        <article key={item.id} className="flex min-w-0 flex-col justify-between rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-300">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium leading-5 text-white">{item.title}</p>
                {item.meta.length > 0 && <p className="mt-1 break-words text-xs leading-5 text-app-muted">{item.meta.filter(Boolean).join(" - ")}</p>}
              </div>
              {item.badges && (
                <div className="flex shrink-0 flex-row flex-wrap gap-1 sm:flex-col sm:items-end">
                  {item.badges.map((badge) => <StatusBadge key={`${item.id}-${badge.label}`} label={badge.label} tone={badge.tone} />)}
                </div>
              )}
            </div>
            {item.rows.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.rows.map(([label, value]) => (
                  <div key={`${item.id}-${label}`} className="min-w-0 rounded-lg bg-slate-950/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
                    <p className="mt-1 break-words font-medium text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {item.onComplete && <IconButton label="Complete" icon={CheckCircle2} onClick={item.onComplete} />}
            <IconButton label="Edit" icon={Edit3} onClick={item.onEdit} />
            <IconButton label="Delete" icon={Trash2} danger onClick={item.onDelete} />
          </div>
        </article>
      ))}
    </div>
  );
}

function IconButton({ danger = false, icon: Icon, label, onClick }: { danger?: boolean; icon: typeof Edit3; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
        danger ? "border-app-danger/30 bg-app-danger/10 text-red-200 hover:bg-app-danger/20" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SummaryRow({ label, value, strong = false, danger = false, positive = false }: { label: string; value: string; strong?: boolean; danger?: boolean; positive?: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3">
      <span className="text-sm text-app-muted">{label}</span>
      <span className={`break-words text-right font-semibold ${danger ? "text-app-danger" : positive ? "text-app-success" : strong ? "text-white" : "text-slate-300"}`}>{value}</span>
    </div>
  );
}

function getTicketCategoryName(form: Record<string, string>) {
  return (form.preset === "Custom" ? form.customName : form.preset).trim();
}

function findTicketCategory<T extends { name: string }>(tickets: T[], name: string) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) return undefined;
  return tickets.find((ticket) => ticket.name.trim().toLowerCase() === normalizedName);
}

function getTicketStatus(sold: number, inventory: number): CheckInStatus {
  if (sold <= 0) return "Not Started";
  if (sold >= inventory) return "Sold Out";
  return "Active";
}

function getEventStatusTone(status: EventStatus) {
  const tones: Record<EventStatus, "blue" | "green" | "amber" | "red" | "slate"> = {
    Cancelled: "red",
    Completed: "slate",
    Ongoing: "green",
    Planning: "blue",
    Upcoming: "amber",
  };
  return tones[status];
}

function makeChartLabel(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length <= 1) return name.slice(0, 10);
  return words
    .slice(0, 2)
    .map((word, index) => (index === 0 ? word.slice(0, 8) : word[0]))
    .join(" ");
}

function isAllowedFile(file: File) {
  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".docx"];
  return allowedTypes.has(file.type) || allowedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
}

function getFileTypeLabel(file: File) {
  const extension = file.name.split(".").pop()?.toUpperCase();
  return extension || file.type || "File";
}

function formatFileSize(size?: number) {
  if (!size) return "Size unavailable";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeDisplay(file: EventFile) {
  const extension = file.name.split(".").pop()?.toUpperCase();
  return extension || file.fileType || "File";
}

type CloudReadyGroup = "ticket" | "sponsor" | "artist" | "vendor" | "expense" | "task" | "timeline";
type CloudReadyDeleteGroup = Exclude<CloudReadyGroup, "ticket">;

interface SupabaseSaveContext {
  artistsData: ArtistsDataSource;
  editId?: string;
  eventId: string;
  expensesData: ExpensesDataSource;
  form: Record<string, string>;
  group: CloudReadyGroup;
  scoped: ReturnType<typeof calculateEventWorkspace>;
  sponsorsData: SponsorsDataSource;
  tasksData: TasksDataSource;
  ticketingData: TicketingDataSource;
  timelineData: TimelineDataSource;
  vendorsData: VendorsDataSource;
}

interface SupabaseDeleteContext {
  artistsData: ArtistsDataSource;
  expensesData: ExpensesDataSource;
  sponsorsData: SponsorsDataSource;
  tasksData: TasksDataSource;
  timelineData: TimelineDataSource;
  vendorsData: VendorsDataSource;
}

function isCloudReadyGroup(group: FormGroup): group is CloudReadyGroup {
  return ["ticket", "sponsor", "artist", "vendor", "expense", "task", "timeline"].includes(group);
}

function isCloudReadyDeleteGroup(group: FormGroup): group is CloudReadyDeleteGroup {
  return ["sponsor", "artist", "vendor", "expense", "task", "timeline"].includes(group);
}

async function saveSupabaseGroup(context: SupabaseSaveContext) {
  const {
    artistsData,
    editId,
    eventId,
    expensesData,
    form,
    group,
    scoped,
    sponsorsData,
    tasksData,
    ticketingData,
    timelineData,
    vendorsData,
  } = context;

  if (group === "ticket") {
    const name = getTicketCategoryName(form);
    const existingTicket = findTicketCategory(scoped.tickets, name);
    const inventory = Number(form.inventory);
    const sold = Math.min((existingTicket?.sold ?? 0) + Number(form.sold || 0), inventory);
    const input = {
      checkedIn: existingTicket?.checkedIn ?? 0,
      eventId,
      inventory,
      name,
      price: Number(form.price),
      sold,
    };

    const savedTicket = existingTicket
      ? await ticketingData.updateTicketCategory(existingTicket.id, input)
      : await ticketingData.createTicketCategory(input);
    return {
      entity: "Events",
      entityId: savedTicket.id,
      eventId,
      message: `${existingTicket ? "Updated" : "Added"} ${name} ticket category`,
      metadata: { action: existingTicket ? "updated" : "created", source: "event-detail" },
      type: "Ticketing",
    } satisfies ActivityWriteInput;
  }

  if (group === "sponsor") {
    const existingSponsor = editId
      ? scoped.sponsors.find((sponsor) => sponsor.id === editId)
      : undefined;
    const input = {
      agreementUploaded: form.agreementUploaded === "Yes",
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim(),
      email: form.email.trim(),
      eventId: existingSponsor?.eventId ?? eventId,
      nextFollowUp: existingSponsor?.nextFollowUp ?? "2026-06-10",
      notes: existingSponsor?.notes ?? "Added from event workspace.",
      paymentReceived: form.paymentReceived === "Yes",
      phone: form.phone.trim(),
      sponsorshipAmount: Number(form.sponsorshipAmount),
      status: form.status as SponsorStatus,
    };

    const savedSponsor = editId
      ? await sponsorsData.updateSponsor(editId, input)
      : await sponsorsData.createSponsor(input);
    return {
      entity: "Events",
      entityId: savedSponsor.id,
      eventId,
      message: `${editId ? "Updated" : "Added"} event sponsor ${form.companyName}`,
      metadata: { action: editId ? "updated" : "created", source: "event-detail" },
      type: "Sponsor",
    } satisfies ActivityWriteInput;
  }

  if (group === "artist") {
    const existingArtist = editId
      ? scoped.artists.find((artist) => artist.id === editId)
      : undefined;
    const input = {
      contractStatus: form.contractStatus as ContractStatus,
      eventId: existingArtist?.eventId ?? eventId,
      fee: Number(form.fee),
      greenRoomCost: Number(form.greenRoomCost),
      hotelCost: Number(form.hotelCost),
      name: form.name.trim(),
      paymentStatus: form.paymentStatus as PaymentStatus,
      performanceSlot: existingArtist?.performanceSlot ?? "TBC",
      profile: existingArtist?.profile ?? "Added from event workspace.",
      technicalRiderStatus: form.technicalRiderStatus as "Pending" | "Received" | "Approved",
      travelCost: Number(form.travelCost),
    };

    const savedArtist = editId
      ? await artistsData.updateArtist(editId, input)
      : await artistsData.createArtist(input);
    return {
      entity: "Events",
      entityId: savedArtist.id,
      eventId,
      message: `${editId ? "Updated" : "Assigned"} artist ${form.name}`,
      metadata: { action: editId ? "updated" : "created", source: "event-detail" },
      type: "Artist",
    } satisfies ActivityWriteInput;
  }

  if (group === "vendor") {
    const existingVendor = editId
      ? scoped.vendors.find((vendor) => vendor.id === editId)
      : undefined;
    const input = {
      advancePaid: Number(form.advancePaid),
      amount: Number(form.amount),
      category: form.category,
      dueDate: form.dueDate,
      eventId: existingVendor?.eventId ?? eventId,
      name: form.name.trim(),
      owner: existingVendor?.owner ?? "Ops",
      status: form.status as "Pending" | "Paid",
    };

    const savedVendor = editId
      ? await vendorsData.updateVendor(editId, input)
      : await vendorsData.createVendor(input);
    return {
      entity: "Events",
      entityId: savedVendor.id,
      eventId,
      message: `${editId ? "Updated" : "Assigned"} vendor ${form.name}`,
      metadata: { action: editId ? "updated" : "created", source: "event-detail" },
      type: "Vendor",
    } satisfies ActivityWriteInput;
  }

  if (group === "expense") {
    const existingExpense = editId
      ? scoped.expenses.find((expense) => expense.id === editId) as ExpenseRecord | undefined
      : undefined;
    const input = {
      amount: Number(form.amount),
      category: resolveExpenseCategory(form.category, form.customCategory),
      date: form.date,
      description: form.description.trim(),
      eventId: existingExpense?.eventId ?? eventId,
      notes: existingExpense?.notes ?? "",
      paymentStatus: existingExpense?.paymentStatus ?? "Paid",
      vendorId: existingExpense?.vendorId,
    };

    const savedExpense = editId
      ? await expensesData.updateExpense(editId, input)
      : await expensesData.createExpense(input);
    return {
      entity: "Events",
      entityId: savedExpense.id,
      eventId,
      message: `${editId ? "Updated" : "Added"} event expense ${formatCurrency(Number(form.amount))}`,
      metadata: { action: editId ? "updated" : "created", source: "event-detail" },
      type: "Finance",
    } satisfies ActivityWriteInput;
  }

  if (group === "task") {
    const input = {
      dueDate: form.dueDate,
      eventId,
      owner: form.owner.trim(),
      priority: form.priority as TaskPriority,
      status: form.status as TaskStatus,
      title: form.title.trim(),
    };

    const savedTask = editId
      ? await tasksData.updateTask(editId, input)
      : await tasksData.createTask(input);
    return {
      entity: "Events",
      entityId: savedTask.id,
      eventId,
      message: `${editId ? "Updated" : "Added"} task ${form.title}`,
      metadata: { action: editId ? "updated" : "created", source: "event-detail" },
      type: "Task",
    } satisfies ActivityWriteInput;
  }

  const input = {
    date: form.date,
    description: form.description.trim(),
    eventId,
    status: form.status as "Done" | "Active" | "Upcoming",
    title: form.title.trim(),
  };

  if (editId) {
    await timelineData.updateTimelineItem(editId, input);
  } else {
    await timelineData.createTimelineItem(input);
  }
  return null;
}

async function deleteSupabaseItem(
  group: CloudReadyDeleteGroup,
  id: string,
  context: SupabaseDeleteContext,
) {
  if (group === "sponsor") {
    await context.sponsorsData.deleteSponsor(id);
    return;
  }
  if (group === "artist") {
    await context.artistsData.deleteArtist(id);
    return;
  }
  if (group === "vendor") {
    await context.vendorsData.deleteVendor(id);
    return;
  }
  if (group === "expense") {
    await context.expensesData.deleteExpense(id);
    return;
  }
  if (group === "task") {
    await context.tasksData.deleteTask(id);
    return;
  }
  await context.timelineData.deleteTimelineItem(id);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function getNavigationActivityWarning(state: unknown) {
  if (typeof state !== "object" || !state || !("activityWarning" in state)) return "";
  return typeof state.activityWarning === "string" ? state.activityWarning : "";
}

function viewLocalFile(dataUrl?: string) {
  if (!dataUrl) return;
  window.open(dataUrl, "_blank", "noopener,noreferrer");
}

function downloadLocalFile(file: EventFile) {
  if (!file.dataUrl) return;
  const anchor = document.createElement("a");
  anchor.href = file.dataUrl;
  anchor.download = file.name;
  anchor.click();
}

function validateGroup(group: FormGroup, form: Record<string, string>, existingTickets: Array<{ name: string; inventory: number; sold: number }> = []) {
  const required: Record<FormGroup, string[]> = {
    ticket: ["preset", "price", "inventory", "sold"],
    sponsor: ["companyName", "contactPerson", "phone", "email", "sponsorshipAmount", "status", "agreementUploaded", "paymentReceived"],
    artist: ["name", "fee", "travelCost", "hotelCost", "greenRoomCost", "technicalRiderStatus", "contractStatus", "paymentStatus"],
    vendor: ["name", "category", "amount", "advancePaid", "status", "dueDate"],
    expense: ["category", "description", "amount", "date"],
    file: ["name", "fileType", "uploadDate"],
    timeline: ["title", "description", "date", "status"],
    task: ["title", "owner", "dueDate", "priority", "status"],
  };

  for (const field of required[group]) {
    if (!form[field]?.trim()) return "Please fill all required fields.";
  }

  if (group === "expense" && form.category === CUSTOM_EXPENSE_CATEGORY_OPTION && !form.customCategory?.trim()) {
    return "Custom expense category is required.";
  }

  for (const [field, value] of Object.entries(form)) {
    if (["price", "inventory", "sold", "sponsorshipAmount", "fee", "travelCost", "hotelCost", "greenRoomCost", "amount", "advancePaid"].includes(field) && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      return "Please enter valid non-negative numbers.";
    }
  }

  if (group === "vendor" && Number(form.advancePaid) > Number(form.amount)) return "Advance paid cannot be greater than vendor amount.";

  if (group === "ticket") {
    const name = getTicketCategoryName(form);
    if (!name) return "Category name is required.";

    const price = Number(form.price);
    const inventory = Number(form.inventory);
    const addedSold = Number(form.sold);
    const existingTicket = findTicketCategory(existingTickets, name);
    const finalSold = (existingTicket?.sold ?? 0) + addedSold;

    if (price <= 0) return "Ticket price must be positive.";
    if (finalSold > inventory) return "Sold tickets cannot exceed inventory.";
    if (inventory < finalSold) return "Inventory cannot be less than sold tickets.";
  }

  return "";
}

function calculateEventWorkspace(data: EventOSData, eventId: string) {
  const event = data.events.find((item) => item.id === eventId);
  const tickets = data.ticketCategories
    .filter((ticket) => ticket.eventId === eventId)
    .map((ticket) => ({
      ...ticket,
      sold: Math.min(ticket.sold, ticket.inventory),
      status: getTicketStatus(ticket.sold, ticket.inventory),
    }));
  const sponsors = data.sponsors.filter((sponsor) => sponsor.eventId === eventId);
  const artists = data.artists.filter((artist) => artist.eventId === eventId);
  const vendors = data.vendors.filter((vendor) => vendor.eventId === eventId);
  const expenses = data.expenses.filter((expense) => expense.eventId === eventId);
  const tasks = data.tasks.filter((task) => task.eventId === eventId);
  const timeline = data.timeline.filter((item) => item.eventId === eventId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const expectedTicketRevenue = tickets.reduce((sum, ticket) => sum + ticket.inventory * ticket.price, 0);
  const ticketRevenue = tickets.reduce((sum, ticket) => sum + ticket.sold * ticket.price, 0);
  const expectedSponsorRevenue = sponsors.filter((sponsor) => sponsor.status !== "Closed Lost").reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const sponsorRevenue = sponsors.filter((sponsor) => sponsor.status === "Closed Won" && sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const artistCost = artists.reduce((sum, artist) => sum + getArtistTotal(artist), 0);
  const artistActualPaid = artists.reduce((sum, artist) => sum + getArtistPaidAmount(artist), 0);
  const vendorCost = vendors.reduce((sum, vendor) => sum + vendor.amount, 0);
  const vendorPaid = vendors.reduce((sum, vendor) => sum + (vendor.advancePaid ?? 0), 0);
  const vendorOutstanding = vendors.reduce((sum, vendor) => sum + getVendorRemaining(vendor), 0);
  const ledgerExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expectedRevenue = event?.expectedRevenue ?? expectedTicketRevenue + expectedSponsorRevenue;
  const actualRevenue = ticketRevenue + sponsorRevenue;
  const expectedExpense = event?.expectedExpense ?? artistCost + vendorCost + ledgerExpense;
  const actualExpense = artistActualPaid + vendorPaid + ledgerExpense;
  const ticketChart = tickets.map((ticket) => ({ name: makeChartLabel(ticket.name), fullName: ticket.name, revenue: ticket.sold * ticket.price }));
  const expenseMap = new Map<string, number>();
  expenses.forEach((expense) => expenseMap.set(expense.category, (expenseMap.get(expense.category) ?? 0) + expense.amount));
  artists.forEach((artist) => expenseMap.set("Artist", (expenseMap.get("Artist") ?? 0) + getArtistTotal(artist)));
  vendors.forEach((vendor) => expenseMap.set(vendor.category, (expenseMap.get(vendor.category) ?? 0) + vendor.amount));
  const expenseChart = Array.from(expenseMap, ([name, value]) => ({ name, value }));
  const sponsorChart = sponsors.map((sponsor) => ({
    name: sponsor.companyName.split(" ").slice(0, 2).join(" "),
    deal: sponsor.sponsorshipAmount,
    received: sponsor.paymentReceived ? sponsor.sponsorshipAmount : 0,
  }));
  const expectedProfit = expectedRevenue - expectedExpense;
  const actualProfit = actualRevenue - actualExpense;
  const profitTrend = [
    { label: "Plan", expected: expectedProfit, actual: 0 },
    { label: "Now", expected: expectedProfit, actual: actualProfit },
  ];

  return {
    tickets,
    sponsors,
    artists,
    vendors,
    expenses,
    tasks,
    timeline,
    expectedRevenue,
    actualRevenue,
    expectedExpense,
    actualExpense,
    expectedProfit,
    actualProfit,
    ticketRevenue,
    sponsorRevenue,
    artistCost,
    vendorOutstanding,
    totalTicketsSold: tickets.reduce((sum, ticket) => sum + ticket.sold, 0),
    ticketChart,
    expenseChart,
    sponsorChart,
    profitTrend,
  };
}

function getArtistTotal(artist: { fee: number; travelCost: number; hotelCost: number; greenRoomCost?: number }) {
  return artist.fee + artist.travelCost + artist.hotelCost + (artist.greenRoomCost ?? 0);
}

function getArtistPaidAmount(artist: { paymentStatus: PaymentStatus; fee: number; travelCost: number; hotelCost: number; greenRoomCost?: number }) {
  const total = getArtistTotal(artist);
  if (artist.paymentStatus === "Paid") return total;
  if (artist.paymentStatus === "Partial") return Math.round(total / 2);
  return 0;
}

function getVendorRemaining(vendor: { amount: number; advancePaid?: number }) {
  return Math.max(vendor.amount - (vendor.advancePaid ?? 0), 0);
}

function deleteEventItem(data: EventOSData, eventId: string, group: FormGroup, id: string): EventOSData {
  if (group === "sponsor") return { ...data, sponsors: data.sponsors.filter((item) => item.id !== id) };
  if (group === "artist") return { ...data, artists: data.artists.filter((item) => item.id !== id) };
  if (group === "vendor") return { ...data, vendors: data.vendors.filter((item) => item.id !== id) };
  if (group === "expense") return { ...data, expenses: data.expenses.filter((item) => item.id !== id) };
  if (group === "timeline") return { ...data, timeline: data.timeline.filter((item) => item.id !== id) };
  if (group === "task") return { ...data, tasks: data.tasks.filter((item) => item.id !== id) };
  if (group === "file") {
    return {
      ...data,
      events: data.events.map((event) => (event.id === eventId ? { ...event, files: event.files.filter((file) => file.id !== id) } : event)),
    };
  }
  return data;
}

function applyEventUpdate(data: EventOSData, eventId: string, group: FormGroup, form: Record<string, string>, editId?: string): EventOSData {
  const id = `${group}-${Date.now()}`;

  if (group === "ticket") {
    const name = getTicketCategoryName(form);
    const existingTicket = findTicketCategory(data.ticketCategories.filter((ticket) => ticket.eventId === eventId), name);
    const addedSold = Number(form.sold || 0);
    const nextTickets = existingTicket
      ? data.ticketCategories.map((ticket) =>
          ticket.id === existingTicket.id
            ? {
                ...ticket,
                name,
                price: form.price.trim() ? Number(form.price) : ticket.price,
                inventory: form.inventory.trim() ? Number(form.inventory) : ticket.inventory,
                sold: Math.min(ticket.sold + addedSold, form.inventory.trim() ? Number(form.inventory) : ticket.inventory),
                status: getTicketStatus(Math.min(ticket.sold + addedSold, form.inventory.trim() ? Number(form.inventory) : ticket.inventory), form.inventory.trim() ? Number(form.inventory) : ticket.inventory),
              }
            : ticket,
        )
      : [{
          id,
          eventId,
          name,
          price: Number(form.price),
          inventory: Number(form.inventory),
          sold: Math.min(addedSold, Number(form.inventory)),
          checkedIn: 0,
          status: getTicketStatus(addedSold, Number(form.inventory)),
        }, ...data.ticketCategories];
    const eventSold = nextTickets.filter((item) => item.eventId === eventId).reduce((sum, item) => sum + item.sold, 0);
    return {
      ...data,
      ticketCategories: nextTickets,
      events: data.events.map((event) => (event.id === eventId ? { ...event, ticketsSold: eventSold } : event)),
      activities: [{ id: `activity-${Date.now()}`, message: `${existingTicket ? "Updated" : "Added"} ${name} ticket category`, entity: "Events", time: "Just now", type: "Ticketing" }, ...data.activities],
    };
  }

  if (group === "sponsor") {
    const sponsor = {
      eventId,
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      sponsorshipAmount: Number(form.sponsorshipAmount),
      status: form.status as SponsorStatus,
      notes: "Added from event workspace.",
      nextFollowUp: "2026-06-10",
      agreementUploaded: form.agreementUploaded === "Yes",
      paymentReceived: form.paymentReceived === "Yes",
    };

    if (editId) {
      return {
        ...data,
        sponsors: data.sponsors.map((item) => (item.id === editId ? { ...item, ...sponsor } : item)),
        activities: [{ id: `activity-${Date.now()}`, message: `Updated event sponsor ${form.companyName}`, entity: "Events", time: "Just now", type: "Sponsor" }, ...data.activities],
      };
    }

    return {
      ...data,
      sponsors: [{ id, ...sponsor }, ...data.sponsors],
      activities: [{ id: `activity-${Date.now()}`, message: `Added event sponsor ${form.companyName}`, entity: "Events", time: "Just now", type: "Sponsor" }, ...data.activities],
    };
  }

  if (group === "artist") {
    const artist = {
      eventId,
      name: form.name.trim(),
      fee: Number(form.fee),
      travelCost: Number(form.travelCost),
      hotelCost: Number(form.hotelCost),
      greenRoomCost: Number(form.greenRoomCost),
      technicalRiderStatus: form.technicalRiderStatus as "Pending" | "Received" | "Approved",
      paymentStatus: form.paymentStatus as PaymentStatus,
      contractStatus: form.contractStatus as ContractStatus,
      profile: "Added from event workspace.",
      performanceSlot: "TBC",
    };

    if (editId) {
      return {
        ...data,
        artists: data.artists.map((item) => (item.id === editId ? { ...item, ...artist } : item)),
        activities: [{ id: `activity-${Date.now()}`, message: `Updated artist ${form.name}`, entity: "Events", time: "Just now", type: "Artist" }, ...data.activities],
      };
    }

    return {
      ...data,
      artists: [{ id, ...artist }, ...data.artists],
      activities: [{ id: `activity-${Date.now()}`, message: `Assigned artist ${form.name}`, entity: "Events", time: "Just now", type: "Artist" }, ...data.activities],
    };
  }

  if (group === "vendor") {
    const vendor = {
      eventId,
      name: form.name.trim(),
      category: form.category as VendorCategory,
      amount: Number(form.amount),
      advancePaid: Number(form.advancePaid),
      status: form.status as "Pending" | "Paid",
      dueDate: form.dueDate,
      owner: "Ops",
    };

    if (editId) {
      return {
        ...data,
        vendors: data.vendors.map((item) => (item.id === editId ? { ...item, ...vendor } : item)),
        activities: [{ id: `activity-${Date.now()}`, message: `Updated vendor ${form.name}`, entity: "Events", time: "Just now", type: "Vendor" }, ...data.activities],
      };
    }

    return {
      ...data,
      vendors: [{ id, ...vendor }, ...data.vendors],
      activities: [{ id: `activity-${Date.now()}`, message: `Assigned vendor ${form.name}`, entity: "Events", time: "Just now", type: "Vendor" }, ...data.activities],
    };
  }

  if (group === "expense") {
    const expense = {
      eventId,
      category: resolveExpenseCategory(form.category, form.customCategory),
      description: form.description.trim(),
      amount: Number(form.amount),
      date: form.date,
    };
    if (editId) {
      return {
        ...data,
        expenses: data.expenses.map((item) => (item.id === editId ? { ...item, ...expense } : item)),
        activities: [{ id: `activity-${Date.now()}`, message: `Updated event expense ${formatCurrency(Number(form.amount))}`, entity: "Events", time: "Just now", type: "Finance" }, ...data.activities],
      };
    }

    return {
      ...data,
      expenses: [{ id, ...expense }, ...data.expenses],
      activities: [{ id: `activity-${Date.now()}`, message: `Added event expense ${formatCurrency(Number(form.amount))}`, entity: "Events", time: "Just now", type: "Finance" }, ...data.activities],
    };
  }

  if (group === "timeline") {
    const timelineItem = { eventId, title: form.title.trim(), description: form.description.trim(), date: form.date, status: form.status as "Done" | "Active" | "Upcoming" };
    if (editId) {
      return {
        ...data,
        timeline: data.timeline.map((item) => (item.id === editId ? { ...item, ...timelineItem } : item)),
      };
    }

    return {
      ...data,
      timeline: [{ id, ...timelineItem }, ...data.timeline],
    };
  }

  if (group === "task") {
    const task = { eventId, title: form.title.trim(), owner: form.owner.trim(), dueDate: form.dueDate, priority: form.priority as TaskPriority, status: form.status as TaskStatus };
    if (editId) {
      return {
        ...data,
        tasks: data.tasks.map((item) => (item.id === editId ? { ...item, ...task } : item)),
        activities: [{ id: `activity-${Date.now()}`, message: `Updated task ${form.title}`, entity: "Events", time: "Just now", type: "Event" }, ...data.activities],
      };
    }

    return {
      ...data,
      tasks: [{ id, ...task }, ...data.tasks],
      activities: [{ id: `activity-${Date.now()}`, message: `Added task ${form.title}`, entity: "Events", time: "Just now", type: "Event" }, ...data.activities],
    };
  }

  return {
    ...data,
    events: data.events.map((event) => event.id === eventId ? { ...event, files: [{ id, name: form.name.trim(), fileType: form.fileType.trim(), uploadDate: form.uploadDate }, ...event.files] } : event),
  };
}
