import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleDollarSign, DoorOpen, Edit3, Plus, Star, Ticket, Tickets, Trash2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { axisStyle, chartPalette, gridStyle } from "../components/charts/ChartTheme";
import { EventContextChip } from "../components/EventContextChip";
import { ALL_EVENTS_FILTER, EventFilter, matchesEventFilter } from "../components/EventFilter";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { TicketingDataSource } from "../hooks/useTicketingData";
import type { TicketCategoryWriteInput } from "../lib/ticketCategoriesRepository";
import type { EventOSData, TicketCategory } from "../types";
import { formatCurrency, formatNumber } from "../utils/finance";

interface TicketingProps {
  data: EventOSData;
  ticketingData: TicketingDataSource;
}

type TicketDisplayStatus = "Not Started" | "Active" | "Low Stock" | "Sold Out";

type TicketEditorForm = {
  additionalSold: string;
  inventory: string;
  price: string;
};

type TicketEditorErrors = Partial<Record<keyof TicketEditorForm, string>>;

type TicketCreateForm = {
  checkedIn: string;
  eventId: string;
  inventory: string;
  name: string;
  price: string;
  sold: string;
};

type TicketCreateErrors = Partial<Record<keyof TicketCreateForm, string>>;

const STORAGE_KEY = "eventos-demo-data-v2";
const initialCreateForm: TicketCreateForm = {
  checkedIn: "0",
  eventId: "",
  inventory: "",
  name: "",
  price: "",
  sold: "0",
};

const tooltipStyle = {
  background: "#0F172A",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  color: "#E5EEF9",
};

export default function Ticketing({ data, ticketingData }: TicketingProps) {
  const [actionError, setActionError] = useState("");
  const [createErrors, setCreateErrors] = useState<TicketCreateErrors>({});
  const [createForm, setCreateForm] = useState<TicketCreateForm>(initialCreateForm);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [errors, setErrors] = useState<TicketEditorErrors>({});
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS_FILTER);
  const [form, setForm] = useState<TicketEditorForm>({ additionalSold: "0", inventory: "", price: "" });
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ticketList, setTicketList] = useState<TicketCategory[]>(() => (
    ticketingData.isSupabaseMode ? [] : readStoredTickets() ?? data.ticketCategories
  ));

  useEffect(() => {
    if (ticketingData.isSupabaseMode) return;

    const storedTickets = readStoredTickets();
    if (storedTickets) setTicketList(storedTickets);
  }, [ticketingData.isSupabaseMode]);

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const activeTickets = ticketingData.isSupabaseMode ? ticketingData.ticketCategories : ticketList;
  const eventScopedTickets = useMemo(
    () => activeTickets.filter((ticket) => matchesEventFilter(ticket.eventId, eventFilter)),
    [activeTickets, eventFilter],
  );
  const totals = useMemo(() => getTicketTotals(eventScopedTickets), [eventScopedTickets]);
  const filteredTickets = useMemo(
    () => eventScopedTickets.filter((ticket) => ticketMatchesSearch(ticket, globalQuery, data.events)),
    [data.events, eventScopedTickets, globalQuery],
  );
  const chartData = filteredTickets.map((ticket) => ({ name: ticket.name, sold: ticket.sold, available: getAvailable(ticket) }));
  const bestSeller = getBestSellingCategory(eventScopedTickets);
  const editingTicket = activeTickets.find((ticket) => ticket.id === editingTicketId);
  const visibleActionError = actionError || ticketingData.error;

  const openEditor = (ticket: TicketCategory) => {
    ticketingData.clearError();
    setActionError("");
    setEditingTicketId(ticket.id);
    setErrors({});
    setForm({
      additionalSold: "0",
      inventory: String(ticket.inventory),
      price: String(ticket.price),
    });
  };

  const closeEditor = () => {
    setEditingTicketId(null);
    setErrors({});
    setForm({ additionalSold: "0", inventory: "", price: "" });
  };

  const updateField = (field: keyof TicketEditorForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openCreate = () => {
    ticketingData.clearError();
    setActionError("");
    if (data.events.length === 0) {
      setActionError("Create an event before adding a ticket category.");
      return;
    }
    setCreateErrors({});
    setCreateForm({ ...initialCreateForm, eventId: data.events[0]?.id ?? "" });
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateErrors({});
    setCreateForm(initialCreateForm);
    setIsCreateOpen(false);
  };

  const updateCreateField = (field: keyof TicketCreateForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined }));
  };

  const createTicketCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateTicketCreateForm(createForm);
    if (Object.keys(validationErrors).length > 0) {
      setCreateErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setActionError("");
    try {
      await ticketingData.createTicketCategory(createFormToWriteInput(createForm));
      closeCreate();
    } catch (createError) {
      setActionError(getErrorMessage(createError, "Unable to create the ticket category."));
    } finally {
      setIsSaving(false);
    }
  };

  const saveTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTicket) return;

    const validationErrors = validateTicketForm(form, editingTicket);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const inventory = Number(form.inventory);
    const additionalSold = Number(form.additionalSold || 0);
    const sold = editingTicket.sold + additionalSold;

    if (ticketingData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await ticketingData.updateTicketCategory(editingTicket.id, {
          checkedIn: Math.min(editingTicket.checkedIn, sold),
          eventId: editingTicket.eventId,
          inventory,
          name: editingTicket.name,
          price: Number(form.price),
          sold,
        });
        closeEditor();
      } catch (saveError) {
        setActionError(getErrorMessage(saveError, "Unable to update the ticket category."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const nextTickets = ticketList.map((ticket) =>
      ticket.id === editingTicket.id
        ? {
            ...ticket,
            checkedIn: Math.min(ticket.checkedIn, sold),
            inventory,
            price: Number(form.price),
            sold,
          }
        : ticket,
    );

    setTicketList(nextTickets);
    persistTickets(nextTickets);
    closeEditor();
  };

  const deleteTicketCategory = async (ticket: TicketCategory) => {
    if (!window.confirm(`Delete ticket category ${ticket.name}?`)) return;

    setIsSaving(true);
    setActionError("");
    try {
      await ticketingData.deleteTicketCategory(ticket.id);
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError, "Unable to delete the ticket category."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ticketing"
        description="Ticket categories, inventory, sold count, available tickets, revenue tracking and check-in status."
        action={ticketingData.isSupabaseMode ? (
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || data.events.length === 0}
            onClick={openCreate}
            type="button"
          >
            <Plus size={17} />
            Add Ticket Category
          </button>
        ) : undefined}
      />

      {visibleActionError && (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-4 py-3 text-sm text-red-100">
          {visibleActionError}
        </div>
      )}

      {ticketingData.isSupabaseMode && data.events.length === 0 && !ticketingData.isLoading && (
        <div className="rounded-lg border border-app-warning/30 bg-app-warning/10 px-4 py-3 text-sm text-amber-100">
          Create an event before adding a ticket category.
        </div>
      )}

      <EventFilter events={data.events} onChange={setEventFilter} value={eventFilter} />

      {ticketingData.isSupabaseMode && ticketingData.isLoading ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
          <p className="mt-4 text-sm font-medium text-slate-200">Loading workspace ticket categories...</p>
        </section>
      ) : ticketingData.isSupabaseMode && activeTickets.length === 0 && visibleActionError ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <Ticket className="mx-auto text-app-danger" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">Ticket categories are unavailable</h2>
          <p className="mt-2 text-sm text-app-muted">No local or demo ticket categories were loaded as a fallback.</p>
        </section>
      ) : (
        <>
          <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TicketKpi title="Ticket Inventory" value={formatNumber(totals.inventory)} helper="Total configured tickets" icon={Tickets} />
        <TicketKpi title="Tickets Sold" value={formatNumber(totals.sold)} helper={`${getSellThrough(totals.sold, totals.inventory)}% sell-through`} icon={Ticket} tone="success" />
        <TicketKpi title="Available Tickets" value={formatNumber(totals.available)} helper="Remaining inventory" icon={DoorOpen} tone="warning" />
        <TicketKpi
          title="Ticket Revenue"
          value={totals.sold > 0 ? formatCurrency(totals.revenue) : "No sales yet"}
          helper={totals.sold > 0 ? "Category-wise revenue" : "Revenue begins after ticket sales"}
          icon={CircleDollarSign}
          tone="success"
        />
        <TicketKpi
          title="Best Seller"
          value={bestSeller ? bestSeller.name : "No sales"}
          helper={bestSeller ? `${formatNumber(bestSeller.sold)} sold - ${formatCurrency(bestSeller.sold * bestSeller.price)}` : "Add sold tickets"}
          icon={Star}
          tone="primary"
        />
        <TicketKpi title="Checked In" value={`${formatNumber(totals.checkedIn)} / ${formatNumber(totals.sold)}`} helper="QR scanning for V2" icon={BadgeCheck} tone="primary" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ChartCard title="Ticket Sales Summary" subtitle="Sold versus available by category">
          <div className="h-[250px] sm:h-[330px]">
            {chartData.length === 0 ? (
              <div className="grid h-full place-items-center rounded-lg border border-white/10 bg-white/[0.025] px-4 text-center text-sm text-app-muted">No matching ticket categories.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="sold" stackId="a" fill={chartPalette.green} radius={[0, 0, 4, 4]} />
                  <Bar dataKey="available" stackId="a" fill="#334155" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <div className="glass-panel overflow-hidden rounded-lg p-4">
          <h2 className="mb-3 text-base font-semibold text-white">Ticket Categories</h2>
          {filteredTickets.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-app-muted">No matching ticket categories.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="premium-table w-full min-w-[1120px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-app-muted">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Inventory</th>
                    <th className="px-4 py-2 text-right">Sold</th>
                    <th className="px-4 py-2 text-right">Available</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const status = getTicketStatus(ticket);
                    return (
                      <tr key={ticket.id} className="bg-white/[0.04]">
                        <td className="rounded-l-lg px-4 py-4 font-medium text-white">{ticket.name}</td>
                        <td className="px-4 py-4">
                          <EventContextChip event={data.events.find((event) => event.id === ticket.eventId)} />
                        </td>
                        <td className="px-4 py-4 text-right text-slate-300">{formatCurrency(ticket.price)}</td>
                        <td className="px-4 py-4 text-right text-slate-300">{formatNumber(ticket.inventory)}</td>
                        <td className="px-4 py-4 text-right text-slate-300">{formatNumber(ticket.sold)}</td>
                        <td className="px-4 py-4 text-right text-slate-300">{formatNumber(getAvailable(ticket))}</td>
                        <td className="px-4 py-4 text-right font-semibold text-white">
                          {ticket.sold > 0 ? formatCurrency(getTicketRevenue(ticket)) : <span className="text-xs font-medium text-app-muted">No sales yet</span>}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge label={status} tone={getStatusTone(status)} />
                        </td>
                        <td className="rounded-r-lg px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={() => openEditor(ticket)} type="button">
                              <Edit3 size={14} />
                              Edit
                            </button>
                            {ticketingData.isSupabaseMode && (
                              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 text-xs font-medium text-red-200 transition hover:bg-app-danger/20 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={() => void deleteTicketCategory(ticket)} type="button">
                                <Trash2 size={14} />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </section>
        </>
      )}

      {editingTicket && (
        <TicketEditorModal
          errors={errors}
          form={form}
          isSaving={isSaving}
          onCancel={closeEditor}
          onChange={updateField}
          onSubmit={saveTicket}
          event={data.events.find((event) => event.id === editingTicket.eventId)}
          ticket={editingTicket}
        />
      )}

      {isCreateOpen && (
        <TicketCreateModal
          errors={createErrors}
          events={data.events}
          form={createForm}
          isSaving={isSaving}
          onCancel={closeCreate}
          onChange={updateCreateField}
          onSubmit={createTicketCategory}
        />
      )}
    </div>
  );
}

function TicketEditorModal({
  errors,
  event,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  ticket,
}: {
  errors: TicketEditorErrors;
  event?: EventOSData["events"][number];
  form: TicketEditorForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof TicketEditorForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  ticket: TicketCategory;
}) {
  const inventory = Number(form.inventory || 0);
  const sold = ticket.sold + Number(form.additionalSold || 0);
  const available = Math.max(inventory - sold, 0);
  const revenue = sold * Number(form.price || 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Ticket Category Quick Editor</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{ticket.name}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <EventContextChip className="mb-4" event={event} />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Summary label="Current Sold" value={formatNumber(ticket.sold)} />
          <Summary label="Available After Save" value={formatNumber(available)} />
          <Summary label="Revenue After Save" value={sold > 0 ? formatCurrency(revenue) : "No sales yet"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.price} label="Price">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("price", event.target.value)} type="number" value={form.price} />
          </Field>
          <Field error={errors.inventory} label="Inventory">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("inventory", event.target.value)} type="number" value={form.inventory} />
          </Field>
          <Field error={errors.additionalSold} label="Additional Sold Tickets">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("additionalSold", event.target.value)} type="number" value={form.additionalSold} />
          </Field>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Save Category"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TicketCreateModal({
  errors,
  events,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  errors: TicketCreateErrors;
  events: EventOSData["events"];
  form: TicketCreateForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof TicketCreateForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const inventory = Number(form.inventory || 0);
  const sold = Number(form.sold || 0);
  const available = Math.max(inventory - sold, 0);
  const revenue = sold * Number(form.price || 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Ticketing Workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Add Ticket Category</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Summary label="Available" value={formatNumber(available)} />
          <Summary label="Revenue" value={sold > 0 ? formatCurrency(revenue) : "No sales yet"} />
          <Summary label="Status" value={getTicketStatusFromValues(sold, inventory)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.eventId} label="Event">
            <select className="dashboard-input" onChange={(event) => onChange("eventId", event.target.value)} value={form.eventId}>
              <option value="">Select event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </Field>
          <Field error={errors.name} label="Category Name">
            <input className="dashboard-input" onChange={(event) => onChange("name", event.target.value)} value={form.name} />
          </Field>
          <Field error={errors.price} label="Price">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("price", event.target.value)} type="number" value={form.price} />
          </Field>
          <Field error={errors.inventory} label="Inventory">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("inventory", event.target.value)} type="number" value={form.inventory} />
          </Field>
          <Field error={errors.sold} label="Sold">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("sold", event.target.value)} type="number" value={form.sold} />
          </Field>
          <Field error={errors.checkedIn} label="Checked In">
            <input className="dashboard-input" min={0} onChange={(event) => onChange("checkedIn", event.target.value)} type="number" value={form.checkedIn} />
          </Field>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Add Category"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <span className="mt-1 block text-xs text-red-200">{error}</span>}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TicketKpi({
  helper,
  icon: Icon,
  title,
  tone = "primary",
  value,
}: {
  helper: string;
  icon: typeof Ticket;
  title: string;
  tone?: "primary" | "success" | "warning";
  value: string;
}) {
  const tones = {
    primary: "border-app-primary/30 bg-app-primary/14 text-blue-200",
    success: "border-app-success/30 bg-app-success/14 text-green-200",
    warning: "border-app-warning/30 bg-app-warning/14 text-amber-200",
  };

  return (
    <article className="glass-panel min-w-0 rounded-lg p-3.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm leading-5 text-app-muted">{title}</p>
          <p className="mt-2 break-words text-2xl font-semibold leading-tight text-white">{value}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 break-words text-xs leading-5 text-slate-400">{helper}</p>
    </article>
  );
}

function getAvailable(ticket: TicketCategory) {
  return Math.max(ticket.inventory - ticket.sold, 0);
}

function getTicketRevenue(ticket: TicketCategory) {
  return ticket.sold * ticket.price;
}

function getTicketStatus(ticket: TicketCategory): TicketDisplayStatus {
  return getTicketStatusFromValues(ticket.sold, ticket.inventory);
}

function getTicketStatusFromValues(sold: number, inventory: number): TicketDisplayStatus {
  const available = Math.max(inventory - sold, 0);
  if (sold <= 0) return "Not Started";
  if (available === 0) return "Sold Out";
  if (available / inventory <= 0.2) return "Low Stock";
  return "Active";
}

function getStatusTone(status: TicketDisplayStatus): "blue" | "green" | "amber" | "red" | "slate" {
  if (status === "Sold Out") return "green";
  if (status === "Low Stock") return "amber";
  if (status === "Active") return "blue";
  return "slate";
}

function getSellThrough(sold: number, inventory: number) {
  return inventory > 0 ? Math.round((sold / inventory) * 100) : 0;
}

function getTicketTotals(tickets: TicketCategory[]) {
  return tickets.reduce(
    (totals, ticket) => ({
      available: totals.available + getAvailable(ticket),
      checkedIn: totals.checkedIn + ticket.checkedIn,
      inventory: totals.inventory + ticket.inventory,
      revenue: totals.revenue + getTicketRevenue(ticket),
      sold: totals.sold + ticket.sold,
    }),
    { available: 0, checkedIn: 0, inventory: 0, revenue: 0, sold: 0 },
  );
}

function getBestSellingCategory(tickets: TicketCategory[]) {
  return tickets.filter((ticket) => ticket.sold > 0).reduce<TicketCategory | null>((best, ticket) => {
    if (!best || ticket.sold > best.sold) return ticket;
    return best;
  }, null);
}

function ticketMatchesSearch(ticket: TicketCategory, query: string, events: EventOSData["events"]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const status = getTicketStatus(ticket);
  const revenue = getTicketRevenue(ticket);
  return [
    events.find((event) => event.id === ticket.eventId)?.name ?? "",
    ticket.name,
    status,
    String(ticket.price),
    formatCurrency(ticket.price),
    String(ticket.inventory),
    String(ticket.sold),
    String(getAvailable(ticket)),
    String(revenue),
    formatCurrency(revenue),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function validateTicketForm(form: TicketEditorForm, ticket: TicketCategory) {
  const errors: TicketEditorErrors = {};
  const price = Number(form.price);
  const inventory = Number(form.inventory);
  const additionalSold = Number(form.additionalSold || 0);
  const finalSold = ticket.sold + additionalSold;

  if (!form.price.trim()) errors.price = "Price is required.";
  if (form.price.trim() && (Number.isNaN(price) || price < 0)) errors.price = "Price must be 0 or more.";
  if (!form.inventory.trim()) errors.inventory = "Inventory is required.";
  if (form.inventory.trim() && (Number.isNaN(inventory) || inventory < 0)) errors.inventory = "Inventory must be 0 or more.";
  if (form.additionalSold.trim() && (Number.isNaN(additionalSold) || additionalSold < 0)) errors.additionalSold = "Additional sold must be 0 or more.";
  if (!errors.inventory && !errors.additionalSold && finalSold > inventory) errors.additionalSold = "Sold tickets cannot exceed inventory.";

  return errors;
}

function validateTicketCreateForm(form: TicketCreateForm) {
  const errors: TicketCreateErrors = {};
  const price = Number(form.price);
  const inventory = Number(form.inventory);
  const sold = Number(form.sold || 0);
  const checkedIn = Number(form.checkedIn || 0);

  if (!form.eventId) errors.eventId = "Event is required.";
  if (!form.name.trim()) errors.name = "Category name is required.";
  if (!form.price.trim()) errors.price = "Price is required.";
  if (form.price.trim() && (Number.isNaN(price) || price < 0)) errors.price = "Price must be 0 or more.";
  if (!form.inventory.trim()) errors.inventory = "Inventory is required.";
  if (form.inventory.trim() && (Number.isNaN(inventory) || inventory < 0)) errors.inventory = "Inventory must be 0 or more.";
  if (form.sold.trim() && (Number.isNaN(sold) || sold < 0)) errors.sold = "Sold tickets must be 0 or more.";
  if (form.checkedIn.trim() && (Number.isNaN(checkedIn) || checkedIn < 0)) errors.checkedIn = "Checked-in tickets must be 0 or more.";
  if (!errors.inventory && !errors.sold && sold > inventory) errors.sold = "Sold tickets cannot exceed inventory.";
  if (!errors.sold && !errors.checkedIn && checkedIn > sold) errors.checkedIn = "Checked-in tickets cannot exceed sold tickets.";

  return errors;
}

function createFormToWriteInput(form: TicketCreateForm): TicketCategoryWriteInput {
  return {
    checkedIn: Number(form.checkedIn || 0),
    eventId: form.eventId,
    inventory: Number(form.inventory),
    name: form.name.trim(),
    price: Number(form.price),
    sold: Number(form.sold || 0),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function readStoredTickets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { ticketCategories?: TicketCategory[] };
    return parsed.ticketCategories ?? null;
  } catch {
    return null;
  }
}

function persistTickets(ticketCategories: TicketCategory[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, ticketCategories }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ticketCategories }));
  }
}
