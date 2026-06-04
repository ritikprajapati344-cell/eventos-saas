import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Edit3, Landmark, PieChart, Plus, ReceiptText, Trash2, WalletCards, X } from "lucide-react";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { EventOSData, Expense, ExpenseCategory, Vendor } from "../types";
import { formatCurrency } from "../utils/finance";

interface ExpensesProps {
  data: EventOSData;
}

type ExpensePaymentStatus = "Paid" | "Partial" | "Pending";

type ManagedExpense = Expense & {
  notes?: string;
  paymentStatus?: ExpensePaymentStatus;
  vendorId?: string;
};

type ExpenseForm = {
  amount: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  notes: string;
  paymentStatus: ExpensePaymentStatus;
  vendorId: string;
};

type ExpenseFormErrors = Partial<Record<keyof ExpenseForm, string>>;

const STORAGE_KEY = "eventos-demo-data-v2";
const directExpenseValue = "__direct_expense__";
const expenseCategories: ExpenseCategory[] = ["Venue", "Artist", "Marketing", "Sound", "Lighting", "Food", "Security"];

const initialForm: ExpenseForm = {
  amount: "",
  category: "Marketing",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  notes: "",
  paymentStatus: "Pending",
  vendorId: directExpenseValue,
};

const statusTone: Record<ExpensePaymentStatus, "green" | "amber" | "red"> = {
  Paid: "green",
  Partial: "amber",
  Pending: "red",
};

export default function Expenses({ data }: ExpensesProps) {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [expenseList, setExpenseList] = useState<ManagedExpense[]>(() => readStoredExpenses() ?? data.expenses);
  const [form, setForm] = useState<ExpenseForm>(initialForm);
  const [globalQuery, setGlobalQuery] = useState(() => sessionStorage.getItem("eventos-global-search") ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const vendors = useMemo(() => readStoredVendors() ?? data.vendors, [data.vendors]);

  useEffect(() => {
    const storedExpenses = readStoredExpenses();
    if (storedExpenses) setExpenseList(storedExpenses);
  }, []);

  useEffect(() => {
    const handleGlobalSearch = (event: Event) => {
      setGlobalQuery(String((event as CustomEvent<string>).detail ?? ""));
    };

    window.addEventListener("eventos:global-search", handleGlobalSearch);
    return () => window.removeEventListener("eventos:global-search", handleGlobalSearch);
  }, []);

  const filteredExpenses = useMemo(() => expenseList.filter((expense) => expenseMatchesSearch(expense, vendors, globalQuery)), [expenseList, globalQuery, vendors]);
  const totals = useMemo(() => getExpenseTotals(expenseList), [expenseList]);
  const categories = useMemo(() => getCategoryTotals(expenseList), [expenseList]);
  const largestExpense = getLargestExpense(expenseList);

  const openAddModal = () => {
    setEditingExpenseId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: ManagedExpense) => {
    setEditingExpenseId(expense.id);
    setErrors({});
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date,
      description: expense.description,
      notes: expense.notes ?? "",
      paymentStatus: expense.paymentStatus ?? "Paid",
      vendorId: expense.vendorId ?? directExpenseValue,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingExpenseId(null);
    setErrors({});
    setForm(initialForm);
    setIsModalOpen(false);
  };

  const updateField = (field: keyof ExpenseForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const saveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateExpenseForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = makeExpensePayload(form);
    const nextExpenses = editingExpenseId
      ? expenseList.map((expense) => (expense.id === editingExpenseId ? { ...expense, ...payload } : expense))
      : [{ id: `expense-${Date.now()}`, ...payload }, ...expenseList];

    setExpenseList(nextExpenses);
    persistExpenses(nextExpenses);
    closeModal();
  };

  const deleteExpense = (expense: ManagedExpense) => {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) return;
    const nextExpenses = expenseList.filter((item) => item.id !== expense.id);
    setExpenseList(nextExpenses);
    persistExpenses(nextExpenses);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Expense management for venue, artist, marketing, sound, lighting, food and security categories."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500" onClick={openAddModal} type="button">
            <Plus size={17} />
            Add Expense
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard title="Total Expenses" value={formatCurrency(totals.total)} helper="From expense records" icon={WalletCards} tone="warning" />
        <KpiCard title="Paid Expenses" value={formatCurrency(totals.paid)} helper="Marked paid" icon={ReceiptText} tone="success" />
        <KpiCard title="Pending Expenses" value={formatCurrency(totals.pending)} helper="Pending + partial" icon={Landmark} tone="danger" />
        <KpiCard title="Categories" value={String(totals.categoryCount)} helper="Expense categories used" icon={PieChart} />
        <KpiCard title="Largest Expense" value={largestExpense ? formatCurrency(largestExpense.amount) : "₹0"} helper={largestExpense?.description ?? "No expense records"} icon={ReceiptText} tone="primary" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="glass-panel rounded-lg p-5">
          <h2 className="text-base font-semibold text-white">Expense Summary</h2>
          <div className="mt-5 space-y-4">
            {Object.entries(categories).map(([category, amount]) => {
              const percent = totals.total ? Math.round((amount / totals.total) * 100) : 0;
              return (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">{category}</span>
                    <span className="font-medium text-white">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-app-primary" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel overflow-hidden rounded-lg p-4">
          <h2 className="mb-3 text-base font-semibold text-white">Expense Records</h2>
          {filteredExpenses.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm text-app-muted">No expense records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="premium-table w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-app-muted">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Vendor</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => {
                    const status = expense.paymentStatus ?? "Paid";
                    return (
                      <tr key={expense.id} className="bg-white/[0.04]">
                        <td className="rounded-l-lg px-4 py-4 font-medium text-white">{expense.category}</td>
                        <td className="px-4 py-4 text-slate-300">
                          <p className="font-medium text-slate-200">{expense.description}</p>
                          {expense.notes && <p className="mt-1 text-xs text-app-muted">{expense.notes}</p>}
                        </td>
                        <td className="px-4 py-4 text-slate-300">{getVendorName(expense.vendorId, vendors)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-white">{formatCurrency(expense.amount)}</td>
                        <td className="px-4 py-4"><StatusBadge label={status} tone={statusTone[status]} /></td>
                        <td className="px-4 py-4 text-slate-400">{new Date(expense.date).toLocaleDateString("en-IN")}</td>
                        <td className="rounded-r-lg px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <IconButton icon={Edit3} label="Edit" onClick={() => openEditModal(expense)} />
                            <IconButton danger icon={Trash2} label="Delete" onClick={() => deleteExpense(expense)} />
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

      {isModalOpen && (
        <ExpenseModal
          editing={Boolean(editingExpenseId)}
          errors={errors}
          form={form}
          onCancel={closeModal}
          onChange={updateField}
          onSubmit={saveExpense}
          vendors={vendors}
        />
      )}
    </div>
  );
}

function ExpenseModal({
  editing,
  errors,
  form,
  onCancel,
  onChange,
  onSubmit,
  vendors,
}: {
  editing: boolean;
  errors: ExpenseFormErrors;
  form: ExpenseForm;
  onCancel: () => void;
  onChange: (field: keyof ExpenseForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  vendors: Vendor[];
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/76 px-4 py-6 backdrop-blur-sm">
      <form className="w-full max-w-3xl rounded-lg border border-white/10 bg-app-panel p-5 shadow-premium" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Expense Management</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Expense" : "Add Expense"}</h2>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field error={errors.category} label="Category">
            <select className="dashboard-input" onChange={(event) => onChange("category", event.target.value)} value={form.category}>
              {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          <Field error={errors.description} label="Description"><input className="dashboard-input" onChange={(event) => onChange("description", event.target.value)} value={form.description} /></Field>
          <Field error={errors.amount} label="Amount"><input className="dashboard-input" min={0} onChange={(event) => onChange("amount", event.target.value)} type="number" value={form.amount} /></Field>
          <Field error={errors.date} label="Date"><input className="dashboard-input" onChange={(event) => onChange("date", event.target.value)} type="date" value={form.date} /></Field>
          <Field label="Payment Status">
            <select className="dashboard-input" onChange={(event) => onChange("paymentStatus", event.target.value)} value={form.paymentStatus}>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </Field>
          <Field label="Vendor">
            <select className="dashboard-input" onChange={(event) => onChange("vendorId", event.target.value)} value={form.vendorId}>
              <option value={directExpenseValue}>Direct Expense</option>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </Field>
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-app-muted">Notes</span>
            <textarea className="dashboard-input mt-2 min-h-24 resize-y leading-6" onChange={(event) => onChange("notes", event.target.value)} value={form.notes} />
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="h-10 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="h-10 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500" type="submit">
            {editing ? "Save Changes" : "Add Expense"}
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

function getExpenseTotals(expenses: ManagedExpense[]) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paid = expenses.filter((expense) => (expense.paymentStatus ?? "Paid") === "Paid").reduce((sum, expense) => sum + expense.amount, 0);
  const pending = expenses.filter((expense) => (expense.paymentStatus ?? "Paid") !== "Paid").reduce((sum, expense) => sum + expense.amount, 0);
  const categoryCount = new Set(expenses.map((expense) => expense.category)).size;
  return { categoryCount, paid, pending, total };
}

function getCategoryTotals(expenses: ManagedExpense[]) {
  return expenses.reduce<Record<ExpenseCategory, number>>(
    (acc, expense) => {
      acc[expense.category] += expense.amount;
      return acc;
    },
    {
      Venue: 0,
      Artist: 0,
      Marketing: 0,
      Sound: 0,
      Lighting: 0,
      Food: 0,
      Security: 0,
    },
  );
}

function getLargestExpense(expenses: ManagedExpense[]) {
  return expenses.reduce<ManagedExpense | null>((largest, expense) => {
    if (!largest || expense.amount > largest.amount) return expense;
    return largest;
  }, null);
}

function validateExpenseForm(form: ExpenseForm) {
  const errors: ExpenseFormErrors = {};
  const amount = Number(form.amount);

  if (!form.category) errors.category = "Category is required.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (!form.amount.trim()) errors.amount = "Amount is required.";
  if (form.amount.trim() && (Number.isNaN(amount) || amount <= 0)) errors.amount = "Amount must be greater than 0.";
  if (!form.date.trim()) errors.date = "Date is required.";

  return errors;
}

function makeExpensePayload(form: ExpenseForm): Omit<ManagedExpense, "id"> {
  return {
    amount: Number(form.amount),
    category: form.category,
    date: form.date,
    description: form.description.trim(),
    notes: form.notes.trim(),
    paymentStatus: form.paymentStatus,
    vendorId: form.vendorId === directExpenseValue ? undefined : form.vendorId,
  };
}

function getVendorName(vendorId: string | undefined, vendors: Vendor[]) {
  if (!vendorId) return "Direct Expense";
  return vendors.find((vendor) => vendor.id === vendorId)?.name ?? "Direct Expense";
}

function expenseMatchesSearch(expense: ManagedExpense, vendors: Vendor[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    expense.category,
    expense.description,
    getVendorName(expense.vendorId, vendors),
    String(expense.amount),
    formatCurrency(expense.amount),
    expense.paymentStatus ?? "Paid",
    expense.notes ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function readStoredExpenses() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { expenses?: ManagedExpense[] };
    return parsed.expenses ?? null;
  } catch {
    return null;
  }
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

function persistExpenses(expenses: ManagedExpense[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) as Record<string, unknown> : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, expenses }));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses }));
  }
}
