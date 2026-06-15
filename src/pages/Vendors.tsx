import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Clock, Edit3, Hammer, Plus, Trash2, WalletCards, X } from "lucide-react";
import { EventContextChip } from "../components/EventContextChip";
import { ALL_EVENTS_FILTER, EventFilter, matchesEventFilter } from "../components/EventFilter";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { VendorsDataSource } from "../hooks/useVendorsData";
import type { VendorWriteInput } from "../lib/vendorsRepository";
import type { EventOSData, Vendor, VendorCategory } from "../types";
import { formatCurrency } from "../utils/finance";

interface VendorsProps {
  events: EventOSData["events"];
  vendors: Vendor[];
  vendorsData: VendorsDataSource;
}

type VendorPaymentStatus = Vendor["status"] | "Partial";

type VendorForm = {
  advancePaid: string;
  amount: string;
  category: VendorCategory | "Custom" | "";
  customCategory: string;
  dueDate: string;
  eventId: string;
  name: string;
  owner: string;
  status: VendorPaymentStatus;
};

type VendorFormErrors = Partial<Record<keyof VendorForm, string>>;

const STORAGE_KEY = "eventos-demo-data-v2";
const vendorCategories: Array<VendorCategory | "Custom"> = ["Sound", "Light", "Stage", "Decoration", "Security", "Food", "Custom"];

const initialForm: VendorForm = {
  advancePaid: "0",
  amount: "",
  category: "Sound",
  customCategory: "",
  dueDate: "",
  eventId: "",
  name: "",
  owner: "Ops",
  status: "Pending",
};

const statusTone: Record<VendorPaymentStatus, "green" | "amber" | "red"> = {
  Paid: "green",
  Partial: "amber",
  Pending: "red",
};

export default function Vendors({ events, vendors, vendorsData }: VendorsProps) {
  const [actionError, setActionError] = useState("");
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [errors, setErrors] = useState<VendorFormErrors>({});
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS_FILTER);
  const [form, setForm] = useState<VendorForm>(initialForm);
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendorList, setVendorList] = useState<Vendor[]>(() => (
    vendorsData.isSupabaseMode ? [] : readStoredVendors() ?? vendors
  ));

  useEffect(() => {
    if (vendorsData.isSupabaseMode) return;

    const storedVendors = readStoredVendors();
    if (storedVendors) setVendorList(storedVendors);
  }, [vendorsData.isSupabaseMode]);

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const activeVendors = vendorsData.isSupabaseMode ? vendorsData.vendors : vendorList;
  const eventScopedVendors = useMemo(
    () => activeVendors.filter((vendor) => matchesEventFilter(vendor.eventId, eventFilter)),
    [activeVendors, eventFilter],
  );
  const filteredVendors = useMemo(
    () => eventScopedVendors.filter((vendor) => vendorMatchesSearch(vendor, globalQuery, events)),
    [eventScopedVendors, events, globalQuery],
  );
  const totals = useMemo(() => getVendorTotals(eventScopedVendors), [eventScopedVendors]);
  const pendingVendors = filteredVendors.filter((vendor) => getPaymentStatus(vendor) !== "Paid");
  const paidVendors = filteredVendors.filter((vendor) => getPaymentStatus(vendor) === "Paid");
  const visibleActionError = actionError || vendorsData.error;
  const formRemaining = Math.max(Number(form.amount || 0) - Number(form.advancePaid || 0), 0);

  const openAddModal = () => {
    vendorsData.clearError();
    setActionError("");
    setEditingVendorId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    vendorsData.clearError();
    setActionError("");
    const isCustomCategory = !vendorCategories.includes(vendor.category as VendorCategory);
    setEditingVendorId(vendor.id);
    setErrors({});
    setForm({
      advancePaid: String(vendor.advancePaid ?? 0),
      amount: String(vendor.amount),
      category: isCustomCategory ? "Custom" : vendor.category,
      customCategory: isCustomCategory ? vendor.category : "",
      dueDate: vendor.dueDate,
      eventId: vendor.eventId ?? "",
      name: vendor.name,
      owner: vendor.owner,
      status: getPaymentStatus(vendor),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingVendorId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const updateField = (field: keyof VendorForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "category" && value !== "Custom" ? { customCategory: "" } : {}),
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const saveVendor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateVendorForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const vendorPayload = makeVendorPayload(form);

    if (vendorsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        const writeInput = vendorToWriteInput(vendorPayload, form.status);

        if (editingVendorId) {
          await vendorsData.updateVendor(editingVendorId, writeInput);
        } else {
          await vendorsData.createVendor(writeInput);
        }

        closeModal();
      } catch (saveError) {
        setActionError(getErrorMessage(saveError, "Unable to save the vendor."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const nextVendors = editingVendorId
      ? vendorList.map((vendor) => (vendor.id === editingVendorId ? { ...vendor, ...vendorPayload } : vendor))
      : [{ id: `vendor-${Date.now()}`, ...vendorPayload }, ...vendorList];

    setVendorList(nextVendors);
    persistVendors(nextVendors);
    closeModal();
  };

  const deleteVendor = async (vendor: Vendor) => {
    if (!window.confirm(`Delete vendor ${vendor.name}?`)) return;

    if (vendorsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await vendorsData.deleteVendor(vendor.id);
      } catch (deleteError) {
        setActionError(getErrorMessage(deleteError, "Unable to delete the vendor."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const nextVendors = vendorList.filter((item) => item.id !== vendor.id);
    setVendorList(nextVendors);
    persistVendors(nextVendors);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description="Vendor directory with payment tracking, pending payments and completed payment visibility."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={openAddModal} type="button">
            <Plus size={17} />
            Add Vendor
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Vendor Budget" value={formatCurrency(totals.amount)} helper="All vendor categories" icon={Hammer} />
        <KpiCard title="Pending Payments" value={formatCurrency(totals.remaining)} helper={`${pendingVendors.length} vendors with balance`} icon={Clock} tone="warning" />
        <KpiCard title="Completed Payments" value={formatCurrency(totals.advancePaid)} helper="Advance and paid amounts" icon={BadgeCheck} tone="success" />
        <KpiCard title="Payment Health" value={`${totals.health}%`} helper="Vendor cashflow complete" icon={WalletCards} tone="primary" />
      </section>

      <EventFilter events={events} onChange={setEventFilter} value={eventFilter} />

      {visibleActionError && (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-4 py-3 text-sm text-red-100">
          {visibleActionError}
        </div>
      )}

      {vendorsData.isSupabaseMode && vendorsData.isLoading ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
          <p className="mt-4 text-sm font-medium text-slate-200">Loading workspace vendors...</p>
        </section>
      ) : vendorsData.isSupabaseMode && activeVendors.length === 0 && visibleActionError ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <Hammer className="mx-auto text-app-danger" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">Vendors are unavailable</h2>
          <p className="mt-2 text-sm text-app-muted">No local or demo vendors were loaded as a fallback.</p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel overflow-hidden rounded-lg p-4">
          <h2 className="mb-3 text-base font-semibold text-white">Vendor Directory</h2>
          {filteredVendors.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-app-muted">No vendors found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="premium-table w-full min-w-[1080px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-app-muted">
                  <tr>
                    <th className="px-4 py-2">Vendor</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Advance</th>
                    <th className="px-4 py-2 text-right">Remaining</th>
                    <th className="px-4 py-2">Due Date</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((vendor) => {
                    const paymentStatus = getPaymentStatus(vendor);
                    const dueState = getDueDateState(vendor.dueDate);
                    return (
                      <tr key={vendor.id} className="bg-white/[0.04]">
                        <td className="rounded-l-lg px-4 py-4 font-medium text-white">
                          <p className="break-words">{vendor.name}</p>
                          <EventContextChip className="mt-2" event={events.find((event) => event.id === vendor.eventId)} />
                        </td>
                        <td className="px-4 py-4 text-slate-300">{vendor.category}</td>
                        <td className="px-4 py-4 text-slate-300">{vendor.owner}</td>
                        <td className="px-4 py-4 text-right font-semibold text-white">{formatCurrency(vendor.amount)}</td>
                        <td className="px-4 py-4 text-right text-slate-300">{formatCurrency(vendor.advancePaid ?? 0)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-white">{formatCurrency(getRemainingAmount(vendor))}</td>
                        <td className={`px-4 py-4 ${dueState.textClass}`}>{dueState.label}</td>
                        <td className="px-4 py-4">
                          <StatusBadge label={paymentStatus} tone={statusTone[paymentStatus]} />
                        </td>
                        <td className="rounded-r-lg px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <IconButton disabled={isSaving} icon={Edit3} label="Edit" onClick={() => openEditModal(vendor)} />
                            <IconButton danger disabled={isSaving} icon={Trash2} label="Delete" onClick={() => void deleteVendor(vendor)} />
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <PaymentList events={events} title="Pending Payments" vendors={pendingVendors} />
          <PaymentList events={events} title="Completed Payments" vendors={paidVendors} />
        </div>
        </section>
      )}

      {isModalOpen && (
        <VendorModal
          editing={Boolean(editingVendorId)}
          errors={errors}
          events={events}
          form={form}
          isSaving={isSaving}
          onCancel={closeModal}
          onChange={updateField}
          onSubmit={saveVendor}
          remaining={formRemaining}
        />
      )}
    </div>
  );
}

function PaymentList({ events, title, vendors }: { events: EventOSData["events"]; title: string; vendors: Vendor[] }) {
  return (
    <section className="glass-panel rounded-lg p-4">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      <div className="space-y-3">
        {vendors.length === 0 && <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-app-muted">No vendors in this group.</p>}
        {vendors.map((vendor) => {
          const paymentStatus = getPaymentStatus(vendor);
          const dueState = getDueDateState(vendor.dueDate);
          return (
            <div key={vendor.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-white">{vendor.name}</p>
                  <p className="mt-1 break-words text-xs text-app-muted">{vendor.category} - {vendor.owner}</p>
                  <EventContextChip className="mt-2" event={events.find((event) => event.id === vendor.eventId)} />
                </div>
                <StatusBadge label={paymentStatus} tone={statusTone[paymentStatus]} />
              </div>
              <div className="mt-3 grid gap-2 text-xs min-[420px]:grid-cols-2">
                <Info label="Amount" value={formatCurrency(vendor.amount)} />
                <Info label="Remaining" value={formatCurrency(getRemainingAmount(vendor))} />
              </div>
              <p className={`mt-3 text-xs ${dueState.textClass}`}>{dueState.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VendorModal({
  editing,
  errors,
  events,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  remaining,
}: {
  editing: boolean;
  errors: VendorFormErrors;
  events: EventOSData["events"];
  form: VendorForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof VendorForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  remaining: number;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Vendor Workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-app-primary/25 bg-app-primary/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-blue-200">Remaining Amount</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(remaining)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event">
            <select className="dashboard-input" onChange={(event) => onChange("eventId", event.target.value)} value={form.eventId}>
              <option value="">Workspace-wide / Unassigned</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </Field>
          <Field error={errors.name} label="Vendor Name"><input className="dashboard-input" onChange={(event) => onChange("name", event.target.value)} value={form.name} /></Field>
          <Field error={errors.category} label="Category">
            <select className="dashboard-input" onChange={(event) => onChange("category", event.target.value)} value={form.category}>
              {vendorCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          {form.category === "Custom" && (
            <Field error={errors.customCategory} label="Custom Category">
              <input className="dashboard-input" onChange={(event) => onChange("customCategory", event.target.value)} value={form.customCategory} />
            </Field>
          )}
          <Field label="Owner"><input className="dashboard-input" onChange={(event) => onChange("owner", event.target.value)} value={form.owner} /></Field>
          <Field error={errors.amount} label="Amount"><input className="dashboard-input" min={0} onChange={(event) => onChange("amount", event.target.value)} type="number" value={form.amount} /></Field>
          <Field error={errors.advancePaid} label="Advance Paid"><input className="dashboard-input" min={0} onChange={(event) => onChange("advancePaid", event.target.value)} type="number" value={form.advancePaid} /></Field>
          <Field error={errors.dueDate} label="Due Date"><input className="dashboard-input" onChange={(event) => onChange("dueDate", event.target.value)} type="date" value={form.dueDate} /></Field>
          <Field label="Status">
            <select className="dashboard-input" onChange={(event) => onChange("status", event.target.value)} value={form.status}>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Vendor"}
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

function IconButton({
  danger = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: typeof Edit3;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        danger ? "border-app-danger/30 bg-app-danger/10 text-red-200 hover:bg-app-danger/20" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/30 px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-100">{value}</p>
    </div>
  );
}

function getRemainingAmount(vendor: Vendor) {
  return Math.max(vendor.amount - (vendor.advancePaid ?? 0), 0);
}

function getPaymentStatus(vendor: Vendor): VendorPaymentStatus {
  const remaining = getRemainingAmount(vendor);
  if (vendor.status === "Paid" || remaining === 0) return "Paid";
  if ((vendor.advancePaid ?? 0) > 0) return "Partial";
  return "Pending";
}

function getDueDateState(dueDate: string) {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const label = due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  if (due.getTime() > today.getTime()) return { label, textClass: "text-green-200" };
  if (due.getTime() === today.getTime()) return { label, textClass: "text-amber-200" };
  return { label, textClass: "text-red-200" };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getVendorTotals(vendors: Vendor[]) {
  const amount = vendors.reduce((sum, vendor) => sum + vendor.amount, 0);
  const advancePaid = vendors.reduce((sum, vendor) => sum + (vendor.advancePaid ?? 0), 0);
  const remaining = vendors.reduce((sum, vendor) => sum + getRemainingAmount(vendor), 0);
  const health = amount > 0 ? Math.round((advancePaid / amount) * 100) : 0;
  return { advancePaid, amount, health, remaining };
}

function vendorMatchesSearch(vendor: Vendor, query: string, events: EventOSData["events"]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const remaining = getRemainingAmount(vendor);
  const eventName = events.find((event) => event.id === vendor.eventId)?.name ?? "Workspace-wide";
  return [
    eventName,
    vendor.name,
    vendor.category,
    vendor.owner,
    getPaymentStatus(vendor),
    vendor.status,
    vendor.dueDate,
    new Date(vendor.dueDate).toLocaleDateString("en-IN"),
    String(vendor.amount),
    formatCurrency(vendor.amount),
    String(remaining),
    formatCurrency(remaining),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function validateVendorForm(form: VendorForm) {
  const errors: VendorFormErrors = {};
  const amount = Number(form.amount);
  const advancePaid = Number(form.advancePaid || 0);

  if (!form.name.trim()) errors.name = "Vendor name is required.";
  if (!form.category) errors.category = "Category is required.";
  if (form.category === "Custom" && !form.customCategory.trim()) errors.customCategory = "Custom category is required.";
  if (!form.amount.trim()) errors.amount = "Amount is required.";
  if (form.amount.trim() && (Number.isNaN(amount) || amount < 0)) errors.amount = "Amount must be 0 or more.";
  if (form.advancePaid.trim() && (Number.isNaN(advancePaid) || advancePaid < 0)) errors.advancePaid = "Advance paid must be 0 or more.";
  if (!errors.amount && !errors.advancePaid && advancePaid > amount) errors.advancePaid = "Advance paid cannot be greater than amount.";
  if (!form.dueDate.trim()) errors.dueDate = "Due date is required.";

  return errors;
}

function makeVendorPayload(form: VendorForm): Omit<Vendor, "id"> {
  const amount = Number(form.amount);
  const advancePaid = Number(form.advancePaid || 0);
  const normalizedStatus: Vendor["status"] = form.status === "Paid" || advancePaid >= amount ? "Paid" : "Pending";
  const category = form.category === "Custom" ? form.customCategory.trim() : form.category;

  return {
    advancePaid,
    amount,
    category: category as VendorCategory,
    dueDate: form.dueDate,
    eventId: form.eventId || undefined,
    name: form.name.trim(),
    owner: form.owner.trim() || "Ops",
    status: normalizedStatus,
  };
}

function vendorToWriteInput(
  vendor: Omit<Vendor, "id">,
  formStatus: VendorPaymentStatus,
): VendorWriteInput {
  return {
    advancePaid: vendor.advancePaid ?? 0,
    amount: vendor.amount,
    category: vendor.category,
    dueDate: vendor.dueDate,
    eventId: vendor.eventId,
    name: vendor.name,
    owner: vendor.owner,
    status: formStatus,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function readStoredVendors() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { vendors?: Vendor[] };
    return parsed.vendors ?? null;
  } catch {
    return null;
  }
}

function persistVendors(vendors: Vendor[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, vendors }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ vendors }));
  }
}
