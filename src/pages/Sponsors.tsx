import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarClock, Edit3, Handshake, Mail, Phone, Plus, TrendingUp, Trash2, UserRound, X } from "lucide-react";
import { EventContextChip } from "../components/EventContextChip";
import { ALL_EVENTS_FILTER, EventFilter, matchesEventFilter } from "../components/EventFilter";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { ActivitiesDataSource } from "../hooks/useActivitiesData";
import type { SponsorsDataSource } from "../hooks/useSponsorsData";
import type { ActivityWriteInput } from "../lib/activitiesRepository";
import type { SponsorWriteInput } from "../lib/sponsorsRepository";
import type { EventOSData, Sponsor, SponsorStatus } from "../types";
import { formatCurrency, getPipelineValue, getSponsorRevenue } from "../utils/finance";

interface SponsorsProps {
  activitiesData: ActivitiesDataSource;
  events: EventOSData["events"];
  sponsors: Sponsor[];
  sponsorsData: SponsorsDataSource;
  setData: Dispatch<SetStateAction<EventOSData>>;
}

type SponsorForm = {
  agreementUploaded: "No" | "Yes";
  companyName: string;
  contactPerson: string;
  email: string;
  eventId: string;
  nextFollowUp: string;
  notes: string;
  paymentReceived: "No" | "Yes";
  phone: string;
  sponsorshipAmount: string;
  status: SponsorStatus;
};

type SponsorFormErrors = Partial<Record<keyof SponsorForm, string>>;

const stages: SponsorStatus[] = ["Lead", "Contacted", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];

const initialForm: SponsorForm = {
  agreementUploaded: "No",
  companyName: "",
  contactPerson: "",
  email: "",
  eventId: "",
  nextFollowUp: "",
  notes: "",
  paymentReceived: "No",
  phone: "",
  sponsorshipAmount: "",
  status: "Lead",
};

const stageTone: Record<SponsorStatus, "blue" | "green" | "amber" | "red" | "slate"> = {
  Lead: "slate",
  Contacted: "blue",
  "Proposal Sent": "amber",
  Negotiation: "amber",
  "Closed Won": "green",
  "Closed Lost": "red",
};

export default function Sponsors({ activitiesData, events, sponsors, sponsorsData, setData }: SponsorsProps) {
  const [actionError, setActionError] = useState("");
  const [activityWarning, setActivityWarning] = useState("");
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [errors, setErrors] = useState<SponsorFormErrors>({});
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS_FILTER);
  const [form, setForm] = useState<SponsorForm>(initialForm);
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (sponsorsData.isSupabaseMode) return;

    setData((current) => {
      const cleanedSponsors = dedupeSponsors(current.sponsors).filter((sponsor) => !isStaleSponsor(sponsor));
      if (cleanedSponsors.length === current.sponsors.length) return current;
      return { ...current, sponsors: cleanedSponsors };
    });
  }, [setData, sponsorsData.isSupabaseMode]);

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const cleanSponsors = useMemo(() => dedupeSponsors(sponsors).filter((sponsor) => !isStaleSponsor(sponsor)), [sponsors]);
  const eventScopedSponsors = useMemo(
    () => cleanSponsors.filter((sponsor) => matchesEventFilter(sponsor.eventId, eventFilter)),
    [cleanSponsors, eventFilter],
  );
  const filteredSponsors = useMemo(
    () => eventScopedSponsors.filter((sponsor) => sponsorMatchesSearch(sponsor, globalQuery, events)),
    [eventScopedSponsors, events, globalQuery],
  );
  const closedRevenue = getSponsorRevenue(eventScopedSponsors);
  const openPipeline = getPipelineValue(eventScopedSponsors);
  const activeDeals = eventScopedSponsors.filter((sponsor) => !["Closed Won", "Closed Lost"].includes(sponsor.status)).length;
  const visibleActionError = actionError || sponsorsData.error;

  const recordActivity = async (input: ActivityWriteInput) => {
    try {
      await activitiesData.createActivity(input);
      setActivityWarning("");
    } catch {
      setActivityWarning("The sponsor change was saved, but its activity could not be recorded.");
    }
  };

  const openAddModal = () => {
    sponsorsData.clearError();
    setActionError("");
    setEditingSponsorId(null);
    setForm(initialForm);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (sponsor: Sponsor) => {
    sponsorsData.clearError();
    setActionError("");
    setEditingSponsorId(sponsor.id);
    setForm({
      agreementUploaded: sponsor.agreementUploaded ? "Yes" : "No",
      companyName: sponsor.companyName,
      contactPerson: sponsor.contactPerson,
      email: sponsor.email ?? "",
      eventId: sponsor.eventId ?? "",
      nextFollowUp: sponsor.nextFollowUp ?? "",
      notes: sponsor.notes,
      paymentReceived: sponsor.paymentReceived ? "Yes" : "No",
      phone: normalizePhoneInput(sponsor.phone ?? ""),
      sponsorshipAmount: String(sponsor.sponsorshipAmount),
      status: sponsor.status,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingSponsorId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const updateField = (field: keyof SponsorForm, value: string) => {
    const nextValue = field === "phone" ? normalizePhoneInput(value) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const saveSponsor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateSponsorForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const sponsorPayload = makeSponsorPayload(form);

    if (sponsorsData.isSupabaseMode) {
      setIsSaving(true);
      try {
        const writeInput = sponsorToWriteInput(sponsorPayload);

        const savedSponsor = editingSponsorId
          ? await sponsorsData.updateSponsor(editingSponsorId, writeInput)
          : await sponsorsData.createSponsor(writeInput);

        await recordActivity({
          entity: "Sponsors",
          entityId: savedSponsor.id,
          eventId: savedSponsor.eventId,
          message: `${editingSponsorId ? "Updated" : "Added"} sponsor ${form.companyName.trim()}`,
          metadata: { action: editingSponsorId ? "updated" : "created", source: "sponsors" },
          type: "Sponsor",
        });
        closeModal();
      } catch (saveError) {
        setActionError(getErrorMessage(saveError, "Unable to save the sponsor."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => {
      const sponsorsWithoutStale = dedupeSponsors(current.sponsors).filter((sponsor) => !isStaleSponsor(sponsor));
      const nextSponsors = editingSponsorId
        ? sponsorsWithoutStale.map((sponsor) => (sponsor.id === editingSponsorId ? { ...sponsor, ...sponsorPayload } : sponsor))
        : [{ id: `sponsor-${Date.now()}`, ...sponsorPayload }, ...sponsorsWithoutStale];

      return {
        ...current,
        sponsors: nextSponsors,
        activities: [{
          id: `activity-${Date.now()}`,
          message: `${editingSponsorId ? "Updated" : "Added"} sponsor ${form.companyName.trim()}`,
          entity: "Sponsors",
          time: "Just now",
          type: "Sponsor",
        }, ...current.activities],
      };
    });
    closeModal();
  };

  const deleteSponsor = async (sponsor: Sponsor) => {
    if (!window.confirm(`Delete sponsor ${sponsor.companyName}?`)) return;

    if (sponsorsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await sponsorsData.deleteSponsor(sponsor.id);
        await recordActivity({
          entity: "Sponsors",
          entityId: sponsor.id,
          eventId: sponsor.eventId,
          message: `Deleted sponsor ${sponsor.companyName}`,
          metadata: { action: "deleted", source: "sponsors" },
          type: "Sponsor",
        });
      } catch (deleteError) {
        setActionError(getErrorMessage(deleteError, "Unable to delete the sponsor."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => ({
      ...current,
      sponsors: current.sponsors.filter((item) => item.id !== sponsor.id),
      activities: [{
        id: `activity-${Date.now()}`,
        message: `Deleted sponsor ${sponsor.companyName}`,
        entity: "Sponsors",
        time: "Just now",
        type: "Sponsor",
      }, ...current.activities],
    }));
  };

  const changeStage = async (sponsor: Sponsor, status: SponsorStatus) => {
    if (sponsor.status === status) return;

    if (sponsorsData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await sponsorsData.changeStage(sponsor.id, status);
        await recordActivity({
          entity: "Sponsors",
          entityId: sponsor.id,
          eventId: sponsor.eventId,
          message: `${sponsor.companyName} moved to ${status}`,
          metadata: {
            action: "stage_changed",
            fromStage: sponsor.status,
            source: "sponsors",
            toStage: status,
          },
          type: "Sponsor",
        });
      } catch (stageError) {
        setActionError(getErrorMessage(stageError, "Unable to change the sponsor stage."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setData((current) => ({
      ...current,
      sponsors: current.sponsors.map((item) => (item.id === sponsor.id ? { ...item, status } : item)),
      activities: [{
        id: `activity-${Date.now()}`,
        message: `${sponsor.companyName} moved to ${status}`,
        entity: "Sponsors",
        time: "Just now",
        type: "Sponsor",
      }, ...current.activities],
    }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sponsors"
        description="Kanban CRM pipeline for sponsorship outreach, proposals, negotiation and closed revenue."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={openAddModal} type="button">
            <Plus size={17} />
            Add Sponsor
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Summary icon={Handshake} label="Closed Sponsor Revenue" value={formatCurrency(closedRevenue)} />
        <Summary icon={TrendingUp} label="Open Pipeline Value" value={formatCurrency(openPipeline)} />
        <Summary icon={BriefcaseBusiness} label="Active Deals" value={activeDeals.toString()} />
      </section>

      <EventFilter events={events} onChange={setEventFilter} value={eventFilter} />

      {visibleActionError && (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-4 py-3 text-sm text-red-100">
          {visibleActionError}
        </div>
      )}
      {activityWarning && (
        <div className="rounded-lg border border-app-warning/30 bg-app-warning/10 px-4 py-3 text-sm text-amber-100">
          {activityWarning}
        </div>
      )}

      {sponsorsData.isSupabaseMode && sponsorsData.isLoading ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
          <p className="mt-4 text-sm font-medium text-slate-200">Loading workspace sponsors...</p>
        </section>
      ) : sponsorsData.isSupabaseMode && cleanSponsors.length === 0 && visibleActionError ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <Handshake className="mx-auto text-app-danger" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">Sponsors are unavailable</h2>
          <p className="mt-2 text-sm text-app-muted">No fallback sponsors were loaded.</p>
        </section>
      ) : sponsorsData.isSupabaseMode && cleanSponsors.length === 0 ? (
        <section className="glass-panel rounded-lg p-8 text-center">
          <Handshake className="mx-auto text-app-primary" size={28} />
          <h2 className="mt-4 text-lg font-semibold text-white">No sponsors yet</h2>
          <p className="mt-2 text-sm text-app-muted">Add the first sponsor to begin building this workspace pipeline.</p>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-6">
          {stages.map((stage) => {
            const stageSponsors = filteredSponsors.filter((sponsor) => sponsor.status === stage);
            const total = stageSponsors.reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
            return (
              <div key={stage} className="glass-panel flex min-h-[320px] min-w-0 flex-col rounded-lg p-3 sm:min-h-[460px]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold text-white">{stage}</h2>
                    <p className="mt-1 text-xs text-app-muted">{formatCurrency(total)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">{stageSponsors.length}</span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {stageSponsors.length === 0 && <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-app-muted">No sponsors in this stage.</p>}
                  {stageSponsors.map((sponsor) => (
                    <SponsorCard
                      key={sponsor.id}
                      disabled={isSaving}
                      onDelete={() => void deleteSponsor(sponsor)}
                      onEdit={() => openEditModal(sponsor)}
                      onStageChange={(status) => void changeStage(sponsor, status)}
                      event={events.find((event) => event.id === sponsor.eventId)}
                      sponsor={sponsor}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {isModalOpen && (
        <SponsorModal
          editing={Boolean(editingSponsorId)}
          errors={errors}
          events={events}
          form={form}
          isSaving={isSaving}
          onCancel={closeModal}
          onChange={updateField}
          onSubmit={saveSponsor}
        />
      )}
    </div>
  );
}

function SponsorCard({
  disabled,
  event,
  onDelete,
  onEdit,
  onStageChange,
  sponsor,
}: {
  disabled: boolean;
  event?: EventOSData["events"][number];
  onDelete: () => void;
  onEdit: () => void;
  onStageChange: (status: SponsorStatus) => void;
  sponsor: Sponsor;
}) {
  const followUp = getFollowUpState(sponsor.nextFollowUp);

  return (
    <article className="flex min-w-0 flex-1 flex-col rounded-lg border border-app-primary/25 bg-gradient-to-b from-app-panel/95 to-slate-950/70 p-3 text-sm shadow-premium transition hover:border-app-primary/45">
      <div className="flex min-w-0 flex-col items-start justify-between gap-2 min-[430px]:flex-row min-[430px]:gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold leading-5 text-white">{sponsor.companyName}</p>
          <p className="mt-1 flex min-w-0 items-center gap-2 break-words text-xs leading-5 text-app-muted">
            <UserRound size={14} className="shrink-0" />
            {sponsor.contactPerson}
          </p>
        </div>
        <div className="shrink-0"><StatusBadge label={sponsor.status} tone={stageTone[sponsor.status]} /></div>
      </div>

      <EventContextChip className="mt-3 self-start" event={event} />

      <div className="mt-3 space-y-1.5 text-xs text-slate-300">
        <p className="flex min-w-0 items-start gap-2 break-words">
          <Phone size={13} className="mt-0.5 shrink-0 text-app-muted" />
          {sponsor.phone || "No phone added"}
        </p>
        <p className="flex min-w-0 items-start gap-2 break-all">
          <Mail size={13} className="mt-0.5 shrink-0 text-app-muted" />
          {sponsor.email || "No email added"}
        </p>
      </div>

      <p className="mt-3 break-words text-lg font-semibold text-app-success">{formatCurrency(sponsor.sponsorshipAmount)}</p>
      <p className="mt-2 break-words text-xs leading-5 text-slate-400">{sponsor.notes || "No notes added."}</p>

      <div className={`mt-3 flex items-center gap-2 rounded-lg border px-2 py-2 text-xs ${followUp.classes}`}>
        <CalendarClock size={13} className="shrink-0" />
        <span className="break-words">{followUp.label}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <InfoPill label="Agreement" value={sponsor.agreementUploaded ? "Uploaded" : "Pending"} positive={Boolean(sponsor.agreementUploaded)} />
        <InfoPill label="Payment" value={sponsor.paymentReceived ? "Received" : "Pending"} positive={Boolean(sponsor.paymentReceived)} />
      </div>

      <label className="mt-3 block">
        <span className="text-[11px] uppercase tracking-[0.12em] text-app-muted">Move Stage</span>
        <select className="dashboard-input mt-2 h-9 text-xs" disabled={disabled} onChange={(event) => onStageChange(event.target.value as SponsorStatus)} value={sponsor.status}>
          {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <IconButton disabled={disabled} icon={Edit3} label="Edit" onClick={onEdit} />
        <IconButton danger disabled={disabled} icon={Trash2} label="Delete" onClick={onDelete} />
      </div>
    </article>
  );
}

function SponsorModal({
  editing,
  errors,
  events,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  editing: boolean;
  errors: SponsorFormErrors;
  events: EventOSData["events"];
  form: SponsorForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof SponsorForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Sponsor CRM</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Sponsor" : "Add Sponsor"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event">
            <select className="dashboard-input" onChange={(event) => onChange("eventId", event.target.value)} value={form.eventId}>
              <option value="">Workspace-wide / Unassigned</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </Field>
          <Field error={errors.companyName} label="Company Name"><input className="dashboard-input" onChange={(event) => onChange("companyName", event.target.value)} value={form.companyName} /></Field>
          <Field error={errors.contactPerson} label="Contact Person"><input className="dashboard-input" onChange={(event) => onChange("contactPerson", event.target.value)} value={form.contactPerson} /></Field>
          <Field error={errors.phone} label="Phone"><input className="dashboard-input" inputMode="numeric" maxLength={10} onChange={(event) => onChange("phone", event.target.value)} pattern="[0-9]*" value={form.phone} /></Field>
          <Field error={errors.email} label="Email"><input className="dashboard-input" onChange={(event) => onChange("email", event.target.value)} type="email" value={form.email} /></Field>
          <Field error={errors.sponsorshipAmount} label="Deal Amount"><input className="dashboard-input" min={0} onChange={(event) => onChange("sponsorshipAmount", event.target.value)} type="number" value={form.sponsorshipAmount} /></Field>
          <Field error={errors.status} label="Stage">
            <select className="dashboard-input" onChange={(event) => onChange("status", event.target.value)} value={form.status}>
              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </Field>
          <Field error={errors.nextFollowUp} label="Follow-up Date"><input className="dashboard-input" onChange={(event) => onChange("nextFollowUp", event.target.value)} type="date" value={form.nextFollowUp} /></Field>
          <Field label="Agreement Uploaded">
            <select className="dashboard-input" onChange={(event) => onChange("agreementUploaded", event.target.value)} value={form.agreementUploaded}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </Field>
          <Field label="Payment Received">
            <select className="dashboard-input" onChange={(event) => onChange("paymentReceived", event.target.value)} value={form.paymentReceived}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </Field>
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-app-muted">Notes</span>
            <textarea className="dashboard-input mt-2 min-h-24 resize-y leading-6" onChange={(event) => onChange("notes", event.target.value)} value={form.notes} />
            {errors.notes && <span className="mt-1 block text-xs text-red-200">{errors.notes}</span>}
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Sponsor"}
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

function IconButton({ danger = false, disabled = false, icon: Icon, label, onClick }: { danger?: boolean; disabled?: boolean; icon: typeof Edit3; label: string; onClick: () => void }) {
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

function InfoPill({ label, positive, value }: { label: string; positive: boolean; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-app-primary/20 bg-slate-950/45 px-2 py-2 shadow-[0_10px_26px_rgba(2,6,23,0.18)]">
      <p className="text-[10px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className={`mt-1 break-words font-medium ${positive ? "text-green-200" : "text-slate-300"}`}>{value}</p>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Plus; label: string; value: string }) {
  return (
    <article className="glass-panel min-h-[126px] min-w-0 rounded-lg p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-app-muted">{label}</p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-white">{value}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/14 text-blue-200">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function dedupeSponsors(sponsors: Sponsor[]) {
  const seen = new Set<string>();
  return sponsors.filter((sponsor) => {
    if (!stages.includes(sponsor.status)) return false;
    if (seen.has(sponsor.id)) return false;
    seen.add(sponsor.id);
    return true;
  });
}

function isStaleSponsor(sponsor: Sponsor) {
  const haystack = [
    sponsor.companyName,
    sponsor.contactPerson,
    sponsor.phone,
    sponsor.email,
    sponsor.notes,
  ].join(" ").toLowerCase();

  return haystack.includes("prachi handling");
}

function sponsorMatchesSearch(sponsor: Sponsor, query: string, events: EventOSData["events"]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const eventName = events.find((event) => event.id === sponsor.eventId)?.name ?? "Workspace-wide";

  return [
    eventName,
    sponsor.companyName,
    sponsor.contactPerson,
    sponsor.phone ?? "",
    sponsor.email ?? "",
    sponsor.notes,
    String(sponsor.sponsorshipAmount),
    formatCurrency(sponsor.sponsorshipAmount),
    sponsor.status,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getFollowUpState(nextFollowUp?: string) {
  if (!nextFollowUp) {
    return {
      classes: "border-slate-400/20 bg-slate-500/10 text-slate-300",
      label: "No follow-up date",
    };
  }

  const followUpDate = startOfDay(new Date(nextFollowUp));
  const today = startOfDay(new Date());
  const formattedDate = followUpDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  if (followUpDate.getTime() > today.getTime()) {
    return {
      classes: "border-app-success/25 bg-app-success/10 text-green-200",
      label: `Future follow-up ${formattedDate}`,
    };
  }

  if (followUpDate.getTime() === today.getTime()) {
    return {
      classes: "border-app-warning/30 bg-app-warning/10 text-amber-200",
      label: `Follow-up today ${formattedDate}`,
    };
  }

  return {
    classes: "border-app-danger/30 bg-app-danger/10 text-red-200",
    label: `Overdue follow-up ${formattedDate}`,
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function validateSponsorForm(form: SponsorForm) {
  const errors: SponsorFormErrors = {};

  if (!form.companyName.trim()) errors.companyName = "Company name is required.";
  if (!form.contactPerson.trim()) errors.contactPerson = "Contact person is required.";
  if (!form.status) errors.status = "Stage is required.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (form.phone.trim() && !/^\d{10}$/.test(form.phone.trim())) errors.phone = "Phone number must be exactly 10 digits.";
  if (!form.email.trim()) errors.email = "Email is required.";
  if (form.email.trim() && !isValidEmail(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.sponsorshipAmount.trim()) errors.sponsorshipAmount = "Deal amount is required.";
  const amount = Number(form.sponsorshipAmount);
  if (form.sponsorshipAmount.trim() && (Number.isNaN(amount) || amount < 0)) errors.sponsorshipAmount = "Enter a valid non-negative amount.";

  return errors;
}

function makeSponsorPayload(form: SponsorForm): Omit<Sponsor, "id"> {
  return {
    agreementUploaded: form.agreementUploaded === "Yes",
    companyName: form.companyName.trim(),
    contactPerson: form.contactPerson.trim(),
    email: form.email.trim(),
    eventId: form.eventId || undefined,
    nextFollowUp: form.nextFollowUp,
    notes: form.notes.trim(),
    paymentReceived: form.paymentReceived === "Yes",
    phone: form.phone.trim(),
    sponsorshipAmount: Number(form.sponsorshipAmount),
    status: form.status,
  };
}

function sponsorToWriteInput(sponsor: Omit<Sponsor, "id">): SponsorWriteInput {
  return {
    agreementUploaded: Boolean(sponsor.agreementUploaded),
    companyName: sponsor.companyName,
    contactPerson: sponsor.contactPerson,
    email: sponsor.email ?? "",
    eventId: sponsor.eventId,
    nextFollowUp: sponsor.nextFollowUp,
    notes: sponsor.notes,
    paymentReceived: Boolean(sponsor.paymentReceived),
    phone: sponsor.phone ?? "",
    sponsorshipAmount: sponsor.sponsorshipAmount,
    status: sponsor.status,
  };
}

function normalizePhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}
