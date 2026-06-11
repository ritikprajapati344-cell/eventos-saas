import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  CircleDollarSign,
  Edit3,
  Landmark,
  Percent,
  Plus,
  ReceiptIndianRupee,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { axisStyle, chartPalette, gridStyle } from "../components/charts/ChartTheme";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { FinanceDataSource } from "../hooks/useFinanceData";
import type {
  FinancePaymentMode as PaymentMode,
  FinanceTransactionRecord as FinanceTransaction,
  FinanceTransactionSource as TransactionSource,
  FinanceTransactionType as TransactionType,
  FinanceTransactionWriteInput,
} from "../lib/financeTransactionsRepository";
import type { Artist, EventOSData, PaymentStatus, Vendor } from "../types";
import { formatCurrency, getNetProfit, getSponsorRevenue, getTicketRevenue, getTotalExpenses, getTotalRevenue } from "../utils/finance";

interface FinanceProps {
  data: EventOSData;
  financeData: FinanceDataSource;
}

type TransactionForm = {
  amount: string;
  date: string;
  notes: string;
  paymentMode: PaymentMode;
  source: TransactionSource;
  type: TransactionType;
};

type TransactionErrors = Partial<Record<keyof TransactionForm, string>>;

const TRANSACTION_STORAGE_KEY = "eventos-finance-transactions-v1";

const initialForm: TransactionForm = {
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  paymentMode: "UPI",
  source: "Other",
  type: "Income",
};

const transactionTypes: TransactionType[] = ["Income", "Expense"];
const transactionSources: TransactionSource[] = ["Ticket", "Sponsor", "Vendor", "Artist", "Other"];
const paymentModes: PaymentMode[] = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

const tooltipStyle = {
  background: "#0F172A",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  color: "#E5EEF9",
};

export default function Finance({ data, financeData }: FinanceProps) {
  const [actionError, setActionError] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [errors, setErrors] = useState<TransactionErrors>({});
  const [form, setForm] = useState<TransactionForm>(initialForm);
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => (
    financeData.isSupabaseMode ? [] : readStoredTransactions()
  ));

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const activeTransactions = financeData.isSupabaseMode ? financeData.transactions : transactions;
  const ledgerTotals = useMemo(() => getLedgerTotals(activeTransactions), [activeTransactions]);
  const filteredTransactions = useMemo(() => activeTransactions.filter((transaction) => transactionMatchesSearch(transaction, globalQuery)), [activeTransactions, globalQuery]);
  const ticketRevenue = getTicketRevenue(data.events, data.ticketCategories);
  const sponsorRevenue = getSponsorRevenue(data.sponsors);
  const baseRevenue = getTotalRevenue(data.events, data.sponsors, data.ticketCategories);
  const baseExpenses = getTotalExpenses(data.expenses);
  const baseProfit = getNetProfit(data.events, data.sponsors, data.expenses, data.ticketCategories);
  const totalRevenue = baseRevenue + ledgerTotals.income;
  const expenses = baseExpenses + ledgerTotals.expense;
  const profit = baseProfit + ledgerTotals.income - ledgerTotals.expense;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const receivables = getReceivablePayableSummary(data);
  const breakdown = getPaymentBreakdown(data);
  const visibleActionError = actionError || financeData.error;

  const openAddModal = () => {
    financeData.clearError();
    setActionError("");
    setEditingTransactionId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (transaction: FinanceTransaction) => {
    financeData.clearError();
    setActionError("");
    setEditingTransactionId(transaction.id);
    setErrors({});
    setForm({
      amount: String(transaction.amount),
      date: transaction.date,
      notes: transaction.notes,
      paymentMode: transaction.paymentMode,
      source: transaction.source,
      type: transaction.type,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingTransactionId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const updateField = (field: keyof TransactionForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const saveTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateTransaction(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = makeTransactionPayload(form);

    if (financeData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        const existingTransaction = editingTransactionId
          ? activeTransactions.find((transaction) => transaction.id === editingTransactionId)
          : undefined;
        const writeInput = transactionToWriteInput(payload, existingTransaction);

        if (editingTransactionId) {
          await financeData.updateTransaction(editingTransactionId, writeInput);
        } else {
          await financeData.createTransaction(writeInput);
        }

        closeModal();
      } catch (saveError) {
        setActionError(getErrorMessage(saveError, "Unable to save the finance transaction."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const nextTransactions = editingTransactionId
      ? transactions.map((transaction) => (transaction.id === editingTransactionId ? { ...transaction, ...payload } : transaction))
      : [{ id: `finance-${Date.now()}`, ...payload }, ...transactions];

    setTransactions(nextTransactions);
    persistTransactions(nextTransactions);
    closeModal();
  };

  const deleteTransaction = async (transaction: FinanceTransaction) => {
    if (!window.confirm(`Delete ${transaction.type.toLowerCase()} transaction of ${formatCurrency(transaction.amount)}?`)) return;

    if (financeData.isSupabaseMode) {
      setIsSaving(true);
      setActionError("");
      try {
        await financeData.deleteTransaction(transaction.id);
      } catch (deleteError) {
        setActionError(getErrorMessage(deleteError, "Unable to delete the finance transaction."));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const nextTransactions = transactions.filter((item) => item.id !== transaction.id);
    setTransactions(nextTransactions);
    persistTransactions(nextTransactions);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance"
        description="Revenue, expenses, profit, sponsor revenue, ticket revenue and financial summary."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={openAddModal} type="button">
            <Plus size={17} />
            Add Transaction
          </button>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Revenue" value={formatCurrency(totalRevenue)} helper="Ticket + sponsor + ledger" icon={BadgeIndianRupee} tone="success" />
        <KpiCard title="Expenses" value={formatCurrency(expenses)} helper="App expenses + ledger" icon={WalletCards} tone="warning" />
        <KpiCard title="Profit" value={formatCurrency(profit)} helper="Revenue - expenses" icon={TrendingUp} tone={profit >= 0 ? "success" : "danger"} />
        <KpiCard title="Profit Margin" value={`${profitMargin.toFixed(1)}%`} helper="Net profit / revenue" icon={Percent} tone={profit >= 0 ? "success" : "danger"} />
        <KpiCard title="Sponsor Revenue" value={formatCurrency(sponsorRevenue)} helper="Closed won sponsors" icon={ReceiptIndianRupee} />
        <KpiCard title="Ticket Revenue" value={formatCurrency(ticketRevenue)} helper="All ticket categories" icon={CircleDollarSign} tone="primary" />
        <KpiCard title="Ledger Income" value={formatCurrency(ledgerTotals.income)} helper="Manual finance entries" icon={Landmark} tone="success" />
        <KpiCard title="Ledger Expense" value={formatCurrency(ledgerTotals.expense)} helper="Manual finance entries" icon={WalletCards} tone="warning" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard title="Sponsor Receivable" value={formatCurrency(receivables.sponsorReceivable)} helper="Deals minus received" icon={ReceiptIndianRupee} tone="warning" />
        <KpiCard title="Vendor Payable" value={formatCurrency(receivables.vendorPayable)} helper="Remaining vendor balances" icon={WalletCards} tone="danger" />
        <KpiCard title="Artist Payable" value={formatCurrency(receivables.artistPayable)} helper="Unpaid artist balances" icon={BadgeIndianRupee} tone="danger" />
      </section>

      {visibleActionError && (
        <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-4 py-3 text-sm text-red-100">
          {visibleActionError}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="Financial Forecast" subtitle="Forecast and actual revenue across event planning months">
          {financeData.isSupabaseMode ? (
            <div className="grid h-[250px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-5 text-center sm:h-[340px]">
              <div>
                <TrendingUp className="mx-auto text-slate-500" size={24} />
                <p className="mt-3 text-sm text-app-muted">Financial forecast data is not available in cloud mode yet.</p>
              </div>
            </div>
          ) : (
            <div className="h-[250px] sm:h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueForecast}>
                  <defs>
                    <linearGradient id="financeForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPalette.blue} stopOpacity={0.44} />
                      <stop offset="95%" stopColor={chartPalette.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="forecast" stroke={chartPalette.blue} strokeWidth={3} fill="url(#financeForecast)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <section className="glass-panel rounded-lg p-4">
          <h2 className="mb-4 text-base font-semibold text-white">Financial Summary</h2>
          <div className="space-y-3">
            <Summary label="Ticket Revenue" value={formatCurrency(ticketRevenue)} />
            <Summary label="Sponsor Revenue" value={formatCurrency(sponsorRevenue)} />
            <Summary label="Ledger Income" value={formatCurrency(ledgerTotals.income)} positive />
            <Summary label="Total Revenue" value={formatCurrency(totalRevenue)} strong />
            <Summary label="Total Expenses" value={formatCurrency(expenses)} danger />
            <Summary label="Net Profit" value={formatCurrency(profit)} strong danger={profit < 0} positive={profit >= 0} />
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-panel rounded-lg p-4">
          <h2 className="mb-4 text-base font-semibold text-white">Payment Status Breakdown</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <BreakdownCard label="Sponsors Received" value={formatCurrency(breakdown.sponsorsReceived)} badge="Paid" tone="green" />
            <BreakdownCard label="Sponsors Pending" value={formatCurrency(breakdown.sponsorsPending)} badge="Pending" tone="red" />
            <BreakdownCard label="Vendors Paid" value={formatCurrency(breakdown.vendorsPaid)} badge="Paid" tone="green" />
            <BreakdownCard label="Vendors Pending" value={formatCurrency(breakdown.vendorsPending)} badge={breakdown.vendorsPartial > 0 ? "Partial" : "Pending"} tone={breakdown.vendorsPartial > 0 ? "amber" : "red"} />
            <BreakdownCard label="Artists Paid" value={formatCurrency(breakdown.artistsPaid)} badge="Paid" tone="green" />
            <BreakdownCard label="Artists Pending" value={formatCurrency(breakdown.artistsPending)} badge={breakdown.artistsPartial > 0 ? "Partial" : "Pending"} tone={breakdown.artistsPartial > 0 ? "amber" : "red"} />
          </div>
        </section>

        <section className="glass-panel overflow-hidden rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Finance Ledger</h2>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300">{filteredTransactions.length}</span>
          </div>
          {financeData.isSupabaseMode && financeData.isLoading ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
              <p className="mt-3 text-sm text-app-muted">Loading workspace finance transactions...</p>
            </div>
          ) : financeData.isSupabaseMode && visibleActionError ? (
            <div className="rounded-lg border border-app-danger/30 bg-app-danger/10 p-4">
              <p className="text-sm font-medium text-red-100">Finance transactions are unavailable.</p>
              <p className="mt-1 text-xs text-red-100/70">No local finance transactions were loaded as a fallback.</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-app-muted">No finance transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="premium-table w-full min-w-[940px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-app-muted">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Payment Mode</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="bg-white/[0.04]">
                      <td className="rounded-l-lg px-4 py-4 text-slate-300">{new Date(transaction.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-4">
                        <StatusBadge label={transaction.type} tone={transaction.type === "Income" ? "green" : "red"} />
                      </td>
                      <td className="px-4 py-4 text-slate-300">{transaction.source}</td>
                      <td className="px-4 py-4 text-slate-300">{transaction.paymentMode}</td>
                      <td className="px-4 py-4 text-slate-400">{transaction.notes || "No notes"}</td>
                      <td className={`px-4 py-4 text-right font-semibold ${transaction.type === "Income" ? "text-app-success" : "text-app-danger"}`}>{formatCurrency(transaction.amount)}</td>
                      <td className="rounded-r-lg px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <IconButton disabled={isSaving} icon={Edit3} label="Edit" onClick={() => openEditModal(transaction)} />
                          <IconButton danger disabled={isSaving} icon={Trash2} label="Delete" onClick={() => void deleteTransaction(transaction)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {isModalOpen && (
        <TransactionModal
          editing={Boolean(editingTransactionId)}
          errors={errors}
          form={form}
          isSaving={isSaving}
          onCancel={closeModal}
          onChange={updateField}
          onSubmit={saveTransaction}
        />
      )}
    </div>
  );
}

function TransactionModal({
  editing,
  errors,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  editing: boolean;
  errors: TransactionErrors;
  form: TransactionForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (field: keyof TransactionForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Finance Ledger</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Transaction" : "Add Transaction"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.date} label="Date"><input className="dashboard-input" onChange={(event) => onChange("date", event.target.value)} type="date" value={form.date} /></Field>
          <Field error={errors.type} label="Type">
            <select className="dashboard-input" onChange={(event) => onChange("type", event.target.value)} value={form.type}>
              {transactionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field error={errors.source} label="Source">
            <select className="dashboard-input" onChange={(event) => onChange("source", event.target.value)} value={form.source}>
              {transactionSources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
          </Field>
          <Field error={errors.paymentMode} label="Payment Mode">
            <select className="dashboard-input" onChange={(event) => onChange("paymentMode", event.target.value)} value={form.paymentMode}>
              {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </Field>
          <Field error={errors.amount} label="Amount"><input className="dashboard-input" min={0} onChange={(event) => onChange("amount", event.target.value)} type="number" value={form.amount} /></Field>
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
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Transaction"}
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

function Summary({ danger = false, label, positive = false, strong = false, value }: { danger?: boolean; label: string; positive?: boolean; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
      <span className="text-sm text-app-muted">{label}</span>
      <span className={`break-words text-right font-semibold ${danger ? "text-app-danger" : positive ? "text-app-success" : strong ? "text-white" : "text-slate-300"}`}>{value}</span>
    </div>
  );
}

function BreakdownCard({ badge, label, tone, value }: { badge: string; label: string; tone: "green" | "amber" | "red"; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-app-muted">{label}</p>
        <StatusBadge label={badge} tone={tone} />
      </div>
      <p className="mt-2 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function validateTransaction(form: TransactionForm) {
  const errors: TransactionErrors = {};
  const amount = Number(form.amount);

  if (!form.date.trim()) errors.date = "Date is required.";
  if (!form.type) errors.type = "Type is required.";
  if (!form.source) errors.source = "Source is required.";
  if (!form.paymentMode) errors.paymentMode = "Payment mode is required.";
  if (!form.amount.trim()) errors.amount = "Amount is required.";
  if (form.amount.trim() && (Number.isNaN(amount) || amount < 0)) errors.amount = "Amount must be 0 or more.";

  return errors;
}

function makeTransactionPayload(form: TransactionForm): Omit<FinanceTransaction, "id"> {
  return {
    amount: Number(form.amount),
    date: form.date,
    notes: form.notes.trim(),
    paymentMode: form.paymentMode,
    source: form.source,
    type: form.type,
  };
}

function transactionToWriteInput(
  transaction: Omit<FinanceTransaction, "id">,
  existingTransaction?: FinanceTransaction,
): FinanceTransactionWriteInput {
  return {
    amount: transaction.amount,
    date: transaction.date,
    eventId: existingTransaction?.eventId,
    notes: transaction.notes,
    paymentMode: transaction.paymentMode,
    source: transaction.source,
    type: transaction.type,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function getLedgerTotals(transactions: FinanceTransaction[]) {
  return transactions.reduce(
    (totals, transaction) => ({
      expense: totals.expense + (transaction.type === "Expense" ? transaction.amount : 0),
      income: totals.income + (transaction.type === "Income" ? transaction.amount : 0),
    }),
    { expense: 0, income: 0 },
  );
}

function getReceivablePayableSummary(data: EventOSData) {
  const sponsorDealValue = data.sponsors.reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const sponsorReceived = data.sponsors.filter((sponsor) => sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  return {
    artistPayable: data.artists.reduce((sum, artist) => sum + getArtistPendingAmount(artist), 0),
    sponsorReceivable: Math.max(sponsorDealValue - sponsorReceived, 0),
    vendorPayable: data.vendors.reduce((sum, vendor) => sum + getVendorRemaining(vendor), 0),
  };
}

function getPaymentBreakdown(data: EventOSData) {
  const sponsorsReceived = data.sponsors.filter((sponsor) => sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const sponsorsPending = data.sponsors.filter((sponsor) => !sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const vendorsPaid = data.vendors.reduce((sum, vendor) => sum + (vendor.advancePaid ?? 0), 0);
  const vendorsPending = data.vendors.reduce((sum, vendor) => sum + getVendorRemaining(vendor), 0);
  const artistsPaid = data.artists.reduce((sum, artist) => sum + getArtistPaidAmount(artist), 0);
  const artistsPending = data.artists.reduce((sum, artist) => sum + getArtistPendingAmount(artist), 0);
  return {
    artistsPaid,
    artistsPartial: data.artists.filter((artist) => artist.paymentStatus === "Partial").length,
    artistsPending,
    sponsorsPending,
    sponsorsReceived,
    vendorsPaid,
    vendorsPartial: data.vendors.filter((vendor) => (vendor.advancePaid ?? 0) > 0 && getVendorRemaining(vendor) > 0).length,
    vendorsPending,
  };
}

function getVendorRemaining(vendor: Vendor) {
  return Math.max(vendor.amount - (vendor.advancePaid ?? 0), 0);
}

function getArtistTotal(artist: Artist) {
  return artist.fee + artist.travelCost + artist.hotelCost + (artist.greenRoomCost ?? 0);
}

function getArtistPaidAmount(artist: Artist) {
  const total = getArtistTotal(artist);
  if (artist.paymentStatus === "Paid") return total;
  if (artist.paymentStatus === "Partial") return Math.round(total / 2);
  return 0;
}

function getArtistPendingAmount(artist: Artist) {
  return Math.max(getArtistTotal(artist) - getArtistPaidAmount(artist), 0);
}

function transactionMatchesSearch(transaction: FinanceTransaction, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    transaction.type,
    transaction.source,
    String(transaction.amount),
    formatCurrency(transaction.amount),
    transaction.paymentMode,
    transaction.notes,
    transaction.date,
    new Date(transaction.date).toLocaleDateString("en-IN"),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function readStoredTransactions() {
  try {
    const saved = localStorage.getItem(TRANSACTION_STORAGE_KEY);
    return saved ? JSON.parse(saved) as FinanceTransaction[] : [];
  } catch {
    return [];
  }
}

function persistTransactions(transactions: FinanceTransaction[]) {
  localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(transactions));
}
