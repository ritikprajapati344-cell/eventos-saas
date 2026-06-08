import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Edit3, FileSignature, Hotel, Mic2, Plane, Plus, ReceiptIndianRupee, Trash2, X } from "lucide-react";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { Artist, ContractStatus, PaymentStatus } from "../types";
import { formatCurrency } from "../utils/finance";

interface ArtistsProps {
  artists: Artist[];
}

type ArtistContractStatus = ContractStatus | "Cancelled";

type ArtistForm = {
  contractStatus: ArtistContractStatus;
  fee: string;
  hotelCost: string;
  name: string;
  paymentStatus: PaymentStatus;
  performanceSlot: string;
  profile: string;
  travelCost: string;
};

type ArtistFormErrors = Partial<Record<keyof ArtistForm, string>>;

const STORAGE_KEY = "eventos-demo-data-v2";

const initialForm: ArtistForm = {
  contractStatus: "Draft",
  fee: "",
  hotelCost: "0",
  name: "",
  paymentStatus: "Pending",
  performanceSlot: "",
  profile: "",
  travelCost: "0",
};

const paymentTone: Record<PaymentStatus, "green" | "amber" | "red"> = {
  Paid: "green",
  Partial: "amber",
  Pending: "red",
};

const contractOptions: ArtistContractStatus[] = ["Draft", "Sent", "Signed", "Cancelled"];

const contractTone: Record<ArtistContractStatus, "green" | "blue" | "red" | "slate"> = {
  Draft: "slate",
  Sent: "blue",
  Signed: "green",
  Cancelled: "red",
  "On Hold": "slate",
};

export default function Artists({ artists }: ArtistsProps) {
  const [artistList, setArtistList] = useState<Artist[]>(() => readStoredArtists() ?? artists);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ArtistFormErrors>({});
  const [form, setForm] = useState<ArtistForm>(initialForm);
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storedArtists = readStoredArtists();
    if (storedArtists) setArtistList(storedArtists);
  }, []);

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const filteredArtists = useMemo(() => artistList.filter((artist) => artistMatchesSearch(artist, globalQuery)), [artistList, globalQuery]);
  const totals = useMemo(() => getArtistTotals(artistList), [artistList]);
  const formTotal = getArtistTotal({
    fee: Number(form.fee || 0),
    travelCost: Number(form.travelCost || 0),
    hotelCost: Number(form.hotelCost || 0),
  });

  const openAddModal = () => {
    setEditingArtistId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (artist: Artist) => {
    setEditingArtistId(artist.id);
    setErrors({});
    setForm({
      contractStatus: normalizeContractStatus(artist.contractStatus),
      fee: String(artist.fee),
      hotelCost: String(artist.hotelCost),
      name: artist.name,
      paymentStatus: artist.paymentStatus,
      performanceSlot: artist.performanceSlot,
      profile: artist.profile,
      travelCost: String(artist.travelCost),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingArtistId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const updateField = (field: keyof ArtistForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const saveArtist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateArtistForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const artistPayload = makeArtistPayload(form);
    const nextArtists = editingArtistId
      ? artistList.map((artist) => (artist.id === editingArtistId ? { ...artist, ...artistPayload } : artist))
      : [{ id: `artist-${Date.now()}`, ...artistPayload }, ...artistList];

    setArtistList(nextArtists);
    persistArtists(nextArtists);
    closeModal();
  };

  const deleteArtist = (artist: Artist) => {
    if (!window.confirm(`Delete artist ${artist.name}?`)) return;
    const nextArtists = artistList.filter((item) => item.id !== artist.id);
    setArtistList(nextArtists);
    persistArtists(nextArtists);
  };

  const updateContractStatus = (artist: Artist, contractStatus: ArtistContractStatus) => {
    const nextArtists = artistList.map((item) => (item.id === artist.id ? { ...item, contractStatus: contractStatus as ContractStatus } : item));
    setArtistList(nextArtists);
    persistArtists(nextArtists);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Artists"
        description="Artist profiles with performance fee, travel, hotel and contract status in one operational view."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500" onClick={openAddModal} type="button">
            <Plus size={17} />
            Add Artist
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Artist Budget" value={formatCurrency(totals.total)} helper="Fee + travel + hotel" icon={Mic2} />
        <KpiCard title="Performance Fees" value={formatCurrency(totals.fees)} helper="Artist fee commitments" icon={ReceiptIndianRupee} tone="success" />
        <KpiCard title="Travel Cost" value={formatCurrency(totals.travel)} helper="Flights and transfers" icon={Plane} tone="warning" />
        <KpiCard title="Hotel Cost" value={formatCurrency(totals.hotel)} helper="Rooms and hospitality" icon={Hotel} tone="danger" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filteredArtists.length === 0 && (
          <div className="glass-panel rounded-lg p-5 text-sm text-app-muted md:col-span-2 2xl:col-span-3">
            No artists added yet.
          </div>
        )}
        {filteredArtists.map((artist) => {
          const contractStatus = normalizeContractStatus(artist.contractStatus);
          return (
            <article key={artist.id} className="glass-panel flex min-w-0 flex-col rounded-lg p-4">
              <div className="flex flex-col items-start justify-between gap-2 min-[430px]:flex-row min-[430px]:gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Artist Profile</p>
                  <h2 className="mt-2 break-words text-lg font-semibold text-white">{artist.name}</h2>
                </div>
                <StatusBadge label={artist.paymentStatus} tone={paymentTone[artist.paymentStatus]} />
              </div>
              <p className="mt-3 min-h-[48px] break-words text-sm leading-6 text-app-muted">{artist.profile || "No notes added."}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Info label="Performance Fee" value={formatCurrency(artist.fee)} />
                <Info label="Travel Cost" value={formatCurrency(artist.travelCost)} />
                <Info label="Hotel Cost" value={formatCurrency(artist.hotelCost)} />
                <Info label="Total Cost" value={formatCurrency(getArtistTotal(artist))} />
                <Info className="col-span-2" label="Performance Slot" value={artist.performanceSlot || "TBC"} />
              </div>

              <div className="mt-4 grid gap-3">
                <label className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
                  <span className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <FileSignature size={16} />
                    Contract Status
                  </span>
                  <div className="flex flex-col items-stretch gap-2 min-[430px]:flex-row min-[430px]:items-center">
                    <select className="dashboard-input h-9 text-xs" onChange={(event) => updateContractStatus(artist, event.target.value as ArtistContractStatus)} value={contractStatus}>
                      {contractOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <StatusBadge label={contractStatus} tone={contractTone[contractStatus]} />
                  </div>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <IconButton icon={Edit3} label="Edit" onClick={() => openEditModal(artist)} />
                <IconButton danger icon={Trash2} label="Delete" onClick={() => deleteArtist(artist)} />
              </div>
            </article>
          );
        })}
      </section>

      {isModalOpen && (
        <ArtistModal
          editing={Boolean(editingArtistId)}
          errors={errors}
          form={form}
          onCancel={closeModal}
          onChange={updateField}
          onSubmit={saveArtist}
          total={formTotal}
        />
      )}
    </div>
  );
}

function ArtistModal({
  editing,
  errors,
  form,
  onCancel,
  onChange,
  onSubmit,
  total,
}: {
  editing: boolean;
  errors: ArtistFormErrors;
  form: ArtistForm;
  onCancel: () => void;
  onChange: (field: keyof ArtistForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  total: number;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Artist Workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Artist" : "Add Artist"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-app-primary/25 bg-app-primary/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-blue-200">Total Artist Cost</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(total)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.name} label="Artist Name"><input className="dashboard-input" onChange={(event) => onChange("name", event.target.value)} value={form.name} /></Field>
          <Field label="Performance Slot"><input className="dashboard-input" onChange={(event) => onChange("performanceSlot", event.target.value)} value={form.performanceSlot} /></Field>
          <Field error={errors.fee} label="Performance Fee"><input className="dashboard-input" min={0} onChange={(event) => onChange("fee", event.target.value)} type="number" value={form.fee} /></Field>
          <Field error={errors.travelCost} label="Travel Cost"><input className="dashboard-input" min={0} onChange={(event) => onChange("travelCost", event.target.value)} type="number" value={form.travelCost} /></Field>
          <Field error={errors.hotelCost} label="Hotel Cost"><input className="dashboard-input" min={0} onChange={(event) => onChange("hotelCost", event.target.value)} type="number" value={form.hotelCost} /></Field>
          <Field label="Payment Status">
            <select className="dashboard-input" onChange={(event) => onChange("paymentStatus", event.target.value)} value={form.paymentStatus}>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </Field>
          <Field label="Contract Status">
            <select className="dashboard-input" onChange={(event) => onChange("contractStatus", event.target.value)} value={form.contractStatus}>
              {contractOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-app-muted">Notes</span>
            <textarea className="dashboard-input mt-2 min-h-24 resize-y leading-6" onChange={(event) => onChange("profile", event.target.value)} value={form.profile} />
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] sm:w-auto" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 sm:w-auto" type="submit">
            {editing ? "Save Changes" : "Add Artist"}
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

function Info({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function artistMatchesSearch(artist: Artist, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    artist.name,
    artist.performanceSlot,
    artist.contractStatus,
    artist.paymentStatus,
    artist.profile,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getArtistTotal(artist: { fee: number; travelCost: number; hotelCost: number }) {
  return artist.fee + artist.travelCost + artist.hotelCost;
}

function getArtistTotals(artists: Artist[]) {
  return artists.reduce(
    (totals, artist) => ({
      fees: totals.fees + artist.fee,
      hotel: totals.hotel + artist.hotelCost,
      total: totals.total + getArtistTotal(artist),
      travel: totals.travel + artist.travelCost,
    }),
    { fees: 0, hotel: 0, total: 0, travel: 0 },
  );
}

function validateArtistForm(form: ArtistForm) {
  const errors: ArtistFormErrors = {};
  if (!form.name.trim()) errors.name = "Artist name is required.";
  if (!form.fee.trim()) errors.fee = "Performance fee is required.";
  if (form.fee.trim() && !isNonNegativeNumber(form.fee)) errors.fee = "Performance fee must be 0 or more.";
  if (form.travelCost.trim() && !isNonNegativeNumber(form.travelCost)) errors.travelCost = "Travel cost must be 0 or more.";
  if (form.hotelCost.trim() && !isNonNegativeNumber(form.hotelCost)) errors.hotelCost = "Hotel cost must be 0 or more.";
  return errors;
}

function isNonNegativeNumber(value: string) {
  const number = Number(value);
  return !Number.isNaN(number) && number >= 0;
}

function makeArtistPayload(form: ArtistForm): Omit<Artist, "id"> {
  return {
    contractStatus: form.contractStatus as ContractStatus,
    fee: Number(form.fee),
    hotelCost: Number(form.hotelCost || 0),
    name: form.name.trim(),
    paymentStatus: form.paymentStatus,
    performanceSlot: form.performanceSlot.trim() || "TBC",
    profile: form.profile.trim(),
    travelCost: Number(form.travelCost || 0),
  };
}

function normalizeContractStatus(status: ContractStatus): ArtistContractStatus {
  return status === "On Hold" ? "Draft" : (status as ArtistContractStatus);
}

function readStoredArtists() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { artists?: Artist[] };
    return parsed.artists ?? null;
  } catch {
    return null;
  }
}

function persistArtists(artists: Artist[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, artists }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ artists }));
  }
}
