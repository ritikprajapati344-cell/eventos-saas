import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { CalendarPlus, Clock, Copy, Edit3, MoreVertical, MapPin, RotateCcw, Ticket, Trash2, Archive, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { ActivitiesDataSource } from "../hooks/useActivitiesData";
import type { EventFilesDataSource } from "../hooks/useEventFilesData";
import type { EventsDataSource } from "../hooks/useEventsData";
import type { ActivityWriteInput } from "../lib/activitiesRepository";
import type { EventWriteInput } from "../lib/eventsRepository";
import type { EventItem, EventOSData, EventStatus, EventType } from "../types";
import { formatCurrency, formatNumber } from "../utils/finance";

interface EventsProps {
  activitiesData: ActivitiesDataSource;
  data: EventOSData;
  eventFilesData: EventFilesDataSource;
  eventsData: EventsDataSource;
  setData: Dispatch<SetStateAction<EventOSData>>;
}

type ModalMode = "create" | "edit";

const eventTone: Record<EventStatus, "blue" | "green" | "amber" | "red" | "slate"> = {
  Planning: "blue",
  Upcoming: "amber",
  Ongoing: "green",
  Completed: "slate",
  Cancelled: "red",
};

const eventTypes: EventType[] = ["Comedy Show", "Concert", "Corporate Event", "College Fest", "Conference", "Custom"];
const statusOptions: EventStatus[] = ["Planning", "Upcoming", "Ongoing"];
const activityWarningMessage = "The event change was saved, but its activity could not be recorded.";

const sections: Array<{ title: string; status: EventStatus }> = [
  { title: "Planning Events", status: "Planning" },
  { title: "Upcoming Events", status: "Upcoming" },
  { title: "Ongoing Events", status: "Ongoing" },
  { title: "Completed Events", status: "Completed" },
  { title: "Cancelled Events", status: "Cancelled" },
];

const emptyForm = {
  name: "",
  venue: "",
  city: "",
  date: "2026-12-20",
  eventTime: "19:30",
  capacity: "",
  eventType: "Comedy Show",
  mainArtist: "",
  organizer: "Event Ops",
  expectedRevenue: "",
  expectedExpense: "",
  status: "Planning",
};

export default function Events({ activitiesData, data, eventFilesData, eventsData, setData }: EventsProps) {
  const navigate = useNavigate();
  const calendar = buildEventsCalendar(data);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activityWarning, setActivityWarning] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const activeEvents = data.events.filter((event) => !event.archived);
  const archivedEvents = data.events.filter((event) => event.archived);
  const visibleActionError = actionError || eventsData.error;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const recordActivity = async (input: ActivityWriteInput) => {
    try {
      await activitiesData.createActivity(input);
      setActivityWarning("");
      return true;
    } catch {
      setActivityWarning(activityWarningMessage);
      return false;
    }
  };

  const openCreate = () => {
    eventsData.clearError();
    setActionError("");
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setModalMode("create");
  };

  const openEdit = (event: EventItem) => {
    eventsData.clearError();
    setActionError("");
    setOpenMenu(null);
    setEditingId(event.id);
    setForm({
      name: event.name,
      venue: event.venue,
      city: event.city,
      date: event.date,
      eventTime: event.eventTime,
      capacity: String(event.capacity),
      eventType: event.eventType,
      mainArtist: event.mainArtist,
      organizer: event.owner,
      expectedRevenue: String(event.expectedRevenue),
      expectedExpense: String(event.expectedExpense),
      status: event.status === "Completed" || event.status === "Cancelled" ? "Planning" : event.status,
    });
    setError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setError("");
  };

  const saveEvent = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const validationError = validateEventForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (modalMode === "edit" && editingId) {
      if (eventsData.isSupabaseMode) {
        setIsSaving(true);
        try {
          const existingEvent = data.events.find((event) => event.id === editingId);
          if (!existingEvent) throw new Error("The selected event no longer exists.");
          await eventsData.updateEvent(editingId, formToEventInput(form, existingEvent));
          closeModal();
          showToast("Event updated successfully.");
        } catch (saveError) {
          setError(getErrorMessage(saveError, "Unable to update the event."));
        } finally {
          setIsSaving(false);
        }
        return;
      }

      setData((current) => ({
        ...current,
        events: current.events.map((event) =>
          event.id === editingId
            ? {
                ...event,
                name: form.name.trim(),
                venue: form.venue.trim(),
                city: form.city.trim(),
                date: form.date,
                eventTime: form.eventTime,
                capacity: Number(form.capacity),
                eventType: form.eventType as EventType,
                mainArtist: form.mainArtist.trim(),
                owner: form.organizer.trim(),
                expectedRevenue: Number(form.expectedRevenue),
                expectedExpense: Number(form.expectedExpense),
                status: form.status as EventStatus,
              }
            : event,
        ),
      }));
      closeModal();
      showToast("Event updated successfully.");
      return;
    }

    const id = `event-${Date.now()}`;
    const newEvent: EventItem = {
      id,
      name: form.name.trim(),
      venue: form.venue.trim(),
      city: form.city.trim(),
      date: form.date,
      eventTime: form.eventTime,
      eventType: form.eventType as EventType,
      mainArtist: form.mainArtist.trim(),
      capacity: Number(form.capacity),
      status: form.status as EventStatus,
      ticketsSold: 0,
      ticketPrice: 0,
      owner: form.organizer.trim(),
      progress: 0,
      expectedRevenue: Number(form.expectedRevenue),
      expectedExpense: Number(form.expectedExpense),
      archived: false,
      notes: "",
      files: [],
    };

    if (eventsData.isSupabaseMode) {
      setIsSaving(true);
      try {
        const createdEvent = await eventsData.createEvent(eventToWriteInput(newEvent));
        const activitySaved = await recordActivity({
          entity: "Events",
          entityId: createdEvent.id,
          eventId: createdEvent.id,
          message: `Created event ${createdEvent.name}`,
          metadata: { action: "created", source: "events" },
          type: "Event",
        });
        closeModal();
        showToast("Event created successfully.");
        navigate(`/events/${createdEvent.id}`, {
          state: activitySaved ? undefined : { activityWarning: activityWarningMessage },
        });
      } catch (saveError) {
        setError(getErrorMessage(saveError, "Unable to create the event."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => ({
      ...current,
      events: [newEvent, ...current.events],
      activities: [{ id: `activity-${Date.now()}`, message: `Created event ${newEvent.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
    }));
    closeModal();
    showToast("Event created successfully.");
    navigate(`/events/${id}`);
  };

  const deleteEvent = async (event: EventItem) => {
    setOpenMenu(null);
    if (!window.confirm(`Delete ${event.name} and all linked workspace data?`)) return;

    if (eventsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        const deletion = await eventsData.deleteEvent(event.id);
        eventFilesData.forgetEventFiles(event.id);
        await recordActivity({
          entity: "Events",
          entityId: event.id,
          message: `Deleted event ${event.name}`,
          metadata: {
            action: "deleted",
            eventName: event.name,
            queuedFileCount: deletion.queuedFileCount,
            source: "events",
          },
          type: "Event",
        });
        showToast(deletion.queuedFileCount > 0
          ? `Event deleted. ${deletion.queuedFileCount} file cleanup ${deletion.queuedFileCount === 1 ? "job is" : "jobs are"} queued and pending.`
          : "Event deleted successfully. No file cleanup was required.");
      } catch (deleteError) {
        setActionError(getErrorMessage(deleteError, "Unable to delete the event."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => ({
      ...current,
      events: current.events.filter((item) => item.id !== event.id),
      ticketCategories: current.ticketCategories.filter((item) => item.eventId !== event.id),
      sponsors: current.sponsors.filter((item) => item.eventId !== event.id),
      artists: current.artists.filter((item) => item.eventId !== event.id),
      vendors: current.vendors.filter((item) => item.eventId !== event.id),
      expenses: current.expenses.filter((item) => item.eventId !== event.id),
      timeline: current.timeline.filter((item) => item.eventId !== event.id),
      tasks: current.tasks.filter((item) => item.eventId !== event.id),
      activities: [{ id: `activity-${Date.now()}`, message: `Deleted event ${event.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
    }));
    showToast("Event deleted successfully.");
  };

  const archiveEvent = async (event: EventItem, archived: boolean) => {
    setOpenMenu(null);

    if (eventsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await eventsData.updateEvent(event.id, eventToWriteInput({ ...event, archived }));
        await recordActivity({
          entity: "Events",
          entityId: event.id,
          eventId: event.id,
          message: `${archived ? "Archived" : "Restored"} event ${event.name}`,
          metadata: { action: archived ? "archived" : "restored", source: "events" },
          type: "Event",
        });
        showToast(archived ? "Event archived successfully." : "Event restored successfully.");
      } catch (archiveError) {
        setActionError(getErrorMessage(archiveError, "Unable to update the event archive status."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === event.id ? { ...item, archived } : item)),
      activities: [{ id: `activity-${Date.now()}`, message: `${archived ? "Archived" : "Restored"} event ${event.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
    }));
    showToast(archived ? "Event archived successfully." : "Event restored successfully.");
  };

  const duplicateEvent = async (event: EventItem) => {
    setOpenMenu(null);

    if (eventsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        const duplicatedEvent = await eventsData.createEvent(eventToWriteInput({
          ...event,
          archived: false,
          id: "",
          name: `${event.name} Copy`,
          progress: 0,
          status: "Planning",
          ticketPrice: 0,
          ticketsSold: 0,
        }));
        setData((current) => ({
          ...current,
          activities: [{ id: `activity-${Date.now()}`, message: `Duplicated event ${event.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
        }));
        showToast(`Created ${duplicatedEvent.name}.`);
      } catch (duplicateError) {
        setActionError(getErrorMessage(duplicateError, "Unable to duplicate the event."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const newId = `event-${Date.now()}`;
    setData((current) => {
      const tickets = current.ticketCategories
        .filter((ticket) => ticket.eventId === event.id)
        .map((ticket) => ({ ...ticket, id: `ticket-${Date.now()}-${ticket.id}`, eventId: newId, sold: 0, checkedIn: 0, status: "Not Started" as const }));
      const timeline = current.timeline
        .filter((item) => item.eventId === event.id)
        .map((item) => ({ ...item, id: `timeline-${Date.now()}-${item.id}`, eventId: newId }));
      const tasks = current.tasks
        .filter((task) => task.eventId === event.id)
        .map((task) => ({ ...task, id: `task-${Date.now()}-${task.id}`, eventId: newId, status: "Open" as const }));

      return {
        ...current,
        events: [
          {
            ...event,
            id: newId,
            name: `${event.name} Copy`,
            status: "Planning",
            ticketsSold: 0,
            progress: 0,
            archived: false,
            files: event.files.map((file) => ({ ...file, id: `file-${Date.now()}-${file.id}` })),
          },
          ...current.events,
        ],
        ticketCategories: [...tickets, ...current.ticketCategories],
        timeline: [...timeline, ...current.timeline],
        tasks: [...tasks, ...current.tasks],
        activities: [{ id: `activity-${Date.now()}`, message: `Duplicated event ${event.name}`, entity: "Events", time: "Just now", type: "Event" }, ...current.activities],
      };
    });
    showToast("Event duplicated successfully.");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        description="Modern event workflow with planning, upcoming, ongoing, completed, cancelled and archived workspaces."
        action={
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500"
            disabled={isSaving}
            onClick={openCreate}
            type="button"
          >
            <CalendarPlus size={17} />
            Create Event
          </button>
        }
      />

      {toast && <div className="rounded-lg border border-app-success/30 bg-app-success/12 px-4 py-3 text-sm font-medium text-green-100">{toast}</div>}
      {activityWarning && (
        <div className="rounded-lg border border-app-warning/30 bg-app-warning/10 px-4 py-3 text-sm text-amber-100">
          {activityWarning}
        </div>
      )}
      {visibleActionError && (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-4 py-3 text-sm text-red-100">
          {visibleActionError}
        </div>
      )}

      {eventsData.isSupabaseMode && eventsData.isLoading ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
          <p className="mt-4 text-sm font-medium text-slate-200">Loading workspace events...</p>
        </section>
      ) : eventsData.isSupabaseMode && data.events.length === 0 && visibleActionError ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <CalendarPlus className="mx-auto text-app-danger" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">Events are unavailable</h2>
          <p className="mt-2 text-sm text-app-muted">No local or demo events were loaded as a fallback.</p>
        </section>
      ) : eventsData.isSupabaseMode && data.events.length === 0 && !visibleActionError ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <CalendarPlus className="mx-auto text-app-primary" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">No events yet</h2>
          <p className="mt-2 text-sm text-app-muted">Create the first event for this workspace to get started.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-5">
        {sections.map((section) => {
          const events = activeEvents.filter((event) => event.status === section.status);
          return (
            <div key={section.title} className="glass-panel rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-app-muted">{events.length}</span>
              </div>
              <div className="space-y-3">
                {events.map((event) => (
                  <EventMiniCard
                    key={event.id}
                    data={data}
                    event={event}
                    isMenuOpen={openMenu === event.id}
                    onArchive={() => archiveEvent(event, true)}
                    onDelete={() => deleteEvent(event)}
                    onDuplicate={() => duplicateEvent(event)}
                    onEdit={() => openEdit(event)}
                    onToggleMenu={() => setOpenMenu(openMenu === event.id ? null : event.id)}
                  />
                ))}
                {events.length === 0 && <p className="rounded-lg bg-white/[0.035] p-3 text-sm text-app-muted">No events in this stage.</p>}
              </div>
            </div>
          );
        })}
          </section>

          <section className="glass-panel rounded-lg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Archived Events</h2>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-app-muted">{archivedEvents.length}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {archivedEvents.map((event) => (
            <EventMiniCard
              key={event.id}
              data={data}
              event={event}
              isArchived
              isMenuOpen={openMenu === event.id}
              onArchive={() => archiveEvent(event, true)}
              onDelete={() => deleteEvent(event)}
              onDuplicate={() => duplicateEvent(event)}
              onEdit={() => openEdit(event)}
              onRestore={() => archiveEvent(event, false)}
              onToggleMenu={() => setOpenMenu(openMenu === event.id ? null : event.id)}
            />
          ))}
          {archivedEvents.length === 0 && <p className="rounded-lg bg-white/[0.035] p-3 text-sm text-app-muted">No archived events yet.</p>}
        </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel rounded-lg p-4">
          <h2 className="mb-4 text-base font-semibold text-white">Event Timeline</h2>
          <div className="space-y-3">
            {data.timeline.filter((item) => activeEvents.some((event) => event.id === item.eventId)).map((item) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center">
                <div className="text-sm text-app-muted">{new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-app-muted">{item.description}</p>
                </div>
                <StatusBadge label={item.status} tone={item.status === "Done" ? "green" : item.status === "Active" ? "blue" : "amber"} />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-lg p-4">
          <h2 className="mb-4 text-base font-semibold text-white">Event Calendar</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-app-muted">
            {["M", "T", "W", "T", "F", "S", "S"].map((day) => <span key={day} className="py-1">{day}</span>)}
            <div className="col-span-7 mb-2 flex items-center justify-between rounded-lg bg-white/[0.035] px-3 py-2">
              <span className="text-xs uppercase tracking-[0.14em] text-app-muted">{calendar.monthLabel}</span>
              <span className="text-xs text-slate-300">{calendar.monthEvents.length} events</span>
            </div>
            {calendar.cells.map((day, index) => day === null ? (
              <div key={`blank-${index}`} className="aspect-square rounded-lg border border-transparent" />
            ) : (
              <div key={day} className={`grid aspect-square place-items-center rounded-lg border text-xs ${calendar.eventDays.has(day) ? "border-app-success/40 bg-app-success/15 text-white" : "border-white/5 bg-white/[0.025] text-slate-400"}`}>{day}</div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {calendar.monthEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2 text-sm">
                <span className="truncate text-slate-200">{event.name}</span>
                <StatusBadge label={event.status} tone={eventTone[event.status]} />
              </div>
            ))}
          </div>
        </div>
          </section>
        </>
      )}

      {modalMode && (
        <EventModal
          error={error}
          form={form}
          isSaving={isSaving}
          mode={modalMode}
          onCancel={closeModal}
          onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
          onSubmit={saveEvent}
        />
      )}
    </div>
  );
}

function EventMiniCard({
  event,
  data,
  isArchived = false,
  isMenuOpen,
  onArchive,
  onDelete,
  onDuplicate,
  onEdit,
  onRestore,
  onToggleMenu,
}: {
  event: EventItem;
  data: EventOSData;
  isArchived?: boolean;
  isMenuOpen: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onRestore?: () => void;
  onToggleMenu: () => void;
}) {
  const soldPercent = event.capacity > 0 ? Math.round((event.ticketsSold / event.capacity) * 100) : 0;
  const ticketRevenue = data.ticketCategories.filter((ticket) => ticket.eventId === event.id).reduce((sum, ticket) => sum + ticket.sold * ticket.price, 0);
  const sponsorRevenue = data.sponsors.filter((sponsor) => sponsor.eventId === event.id && sponsor.status === "Closed Won" && sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);

  return (
    <article className="relative rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-app-primary/40 hover:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link className="min-w-0 flex-1 focus:outline-none" to={`/events/${event.id}`}>
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-5 text-white">{event.name}</h3>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge label={isArchived ? "Archived" : event.status} tone={isArchived ? "slate" : eventTone[event.status]} />
          <button className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]" onClick={onToggleMenu} type="button">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="absolute right-3 top-12 z-10 w-44 rounded-lg border border-white/10 bg-slate-950 p-1 shadow-premium">
          <MenuLink icon={Eye} label="View Workspace" to={`/events/${event.id}`} />
          <MenuButton icon={Edit3} label="Edit Event" onClick={onEdit} />
          <MenuButton icon={Copy} label="Duplicate Event" onClick={onDuplicate} />
          {isArchived && onRestore ? <MenuButton icon={RotateCcw} label="Restore Event" onClick={onRestore} /> : <MenuButton icon={Archive} label="Archive Event" onClick={onArchive} />}
          <MenuButton danger icon={Trash2} label="Delete Event" onClick={onDelete} />
        </div>
      )}

      <Link className="mt-3 block focus:outline-none focus:ring-2 focus:ring-app-primary/45" to={`/events/${event.id}`}>
        <div className="space-y-2 text-xs text-app-muted">
          <p className="flex items-center gap-2"><MapPin size={14} />{event.venue}, {event.city}</p>
          <p className="flex items-center gap-2"><Clock size={14} />{new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at {event.eventTime}</p>
        </div>
        <div className="mt-4 grid gap-2 min-[420px]:grid-cols-2">
          <InfoTile label="Capacity" value={formatNumber(event.capacity)} />
          <InfoTile label="Revenue" value={formatCurrency(ticketRevenue + sponsorRevenue)} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-app-muted"><Ticket size={13} />Sold</span>
            <span className="text-white">{soldPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-app-success" style={{ width: `${soldPercent}%` }} />
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-app-primary">View Workspace</p>
      </Link>
    </article>
  );
}

function EventModal({
  error,
  form,
  isSaving,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
  error: string;
  form: typeof emptyForm;
  isSaving: boolean;
  mode: ModalMode;
  onCancel: () => void;
  onChange: (field: keyof typeof emptyForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Events Workspace</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{mode === "create" ? "Create Event" : "Edit Event"}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event Name" value={form.name} onChange={(value) => onChange("name", value)} />
          <Field label="Venue" value={form.venue} onChange={(value) => onChange("venue", value)} />
          <Field label="City" value={form.city} onChange={(value) => onChange("city", value)} />
          <Field label="Event Date" type="date" value={form.date} onChange={(value) => onChange("date", value)} />
          <Field label="Event Time" type="time" value={form.eventTime} onChange={(value) => onChange("eventTime", value)} />
          <Field label="Capacity" type="number" value={form.capacity} onChange={(value) => onChange("capacity", value)} />
          <SelectField label="Event Type" value={form.eventType} onChange={(value) => onChange("eventType", value)} options={eventTypes} />
          <Field label="Main Artist" value={form.mainArtist} onChange={(value) => onChange("mainArtist", value)} />
          <Field label="Organizer" value={form.organizer} onChange={(value) => onChange("organizer", value)} />
          <Field label="Expected Revenue" type="number" value={form.expectedRevenue} onChange={(value) => onChange("expectedRevenue", value)} />
          <Field label="Expected Expense" type="number" value={form.expectedExpense} onChange={(value) => onChange("expectedExpense", value)} />
          <SelectField label="Status" value={form.status} onChange={(value) => onChange("status", value)} options={statusOptions} />
        </div>
        {error && <p className="mt-4 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 py-2 text-sm text-red-100">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} onClick={onCancel} type="button">Cancel</button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Event"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <input className="dashboard-input mt-2" min={type === "number" ? 0 : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <select className="dashboard-input mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function MenuButton({ danger = false, icon: Icon, label, onClick }: { danger?: boolean; icon: typeof Eye; label: string; onClick: () => void }) {
  return <button className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${danger ? "text-red-200 hover:bg-app-danger/12" : "text-slate-200 hover:bg-white/[0.06]"}`} onClick={onClick} type="button"><Icon size={15} />{label}</button>;
}

function MenuLink({ icon: Icon, label, to }: { icon: typeof Eye; label: string; to: string }) {
  return <Link className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]" to={to}><Icon size={15} />{label}</Link>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-white">{value}</p>
    </div>
  );
}

function validateEventForm(form: typeof emptyForm) {
  const required: Array<keyof typeof emptyForm> = ["name", "venue", "city", "date", "eventTime", "capacity", "eventType", "mainArtist", "organizer", "expectedRevenue", "expectedExpense", "status"];
  for (const field of required) {
    if (!form[field].trim()) return "Please fill all required fields.";
  }
  for (const field of ["capacity", "expectedRevenue", "expectedExpense"] as Array<keyof typeof emptyForm>) {
    if (Number.isNaN(Number(form[field])) || Number(form[field]) < 0) return "Please enter valid non-negative numbers.";
  }
  return "";
}

function formToEventInput(form: typeof emptyForm, existingEvent: EventItem): EventWriteInput {
  return {
    archived: existingEvent.archived,
    capacity: Number(form.capacity),
    city: form.city.trim(),
    date: form.date,
    eventTime: form.eventTime,
    eventType: form.eventType as EventType,
    expectedExpense: Number(form.expectedExpense),
    expectedRevenue: Number(form.expectedRevenue),
    mainArtist: form.mainArtist.trim(),
    name: form.name.trim(),
    notes: existingEvent.notes,
    owner: form.organizer.trim(),
    status: form.status as EventStatus,
    venue: form.venue.trim(),
  };
}

function eventToWriteInput(event: EventItem): EventWriteInput {
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function buildEventsCalendar(data: EventOSData) {
  const visibleEvents = data.events.filter((event) => !event.archived);
  const sortedEvents = [...visibleEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const anchor = sortedEvents.find((event) => event.status !== "Cancelled") ?? sortedEvents[0];
  const anchorDate = anchor ? new Date(anchor.date) : new Date();
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEvents = visibleEvents.filter((event) => {
    const date = new Date(event.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const eventDays = new Set(monthEvents.map((event) => new Date(event.date).getDate()));

  return {
    cells: [...Array<null>(mondayOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)],
    eventDays,
    monthEvents,
    monthLabel: anchorDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}
