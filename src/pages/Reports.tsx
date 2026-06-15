import { useMemo, useState } from "react";
import { BadgeIndianRupee, Download, FileSpreadsheet, FileText, TrendingUp, WalletCards } from "lucide-react";
import { EventContextChip } from "../components/EventContextChip";
import { ALL_EVENTS_FILTER, EventFilter, matchesEventFilter, UNASSIGNED_EVENTS_FILTER } from "../components/EventFilter";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../hooks/useAuth";
import { useFinanceData } from "../hooks/useFinanceData";
import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventOSData, Expense, Sponsor } from "../types";
import { formatCurrency, formatNumber, getSponsorRevenue, getTotalExpenses, getTotalRevenue } from "../utils/finance";

interface ReportsProps {
  data: EventOSData;
}

const reports = [
  {
    id: "revenue",
    title: "Revenue Report",
    description: "Ticket sales, sponsor revenue and event-wise commercial performance.",
    icon: TrendingUp,
  },
  {
    id: "expense",
    title: "Expense Report",
    description: "Venue, artist, marketing, production and operations expense detail.",
    icon: FileText,
  },
  {
    id: "sponsor",
    title: "Sponsor Report",
    description: "Pipeline stages, closed deals, open proposals and contact ownership.",
    icon: FileSpreadsheet,
  },
  {
    id: "profit",
    title: "Profit Report",
    description: "Net profit summary with revenue minus expenses calculation.",
    icon: Download,
  },
] as const;

type ReportId = (typeof reports)[number]["id"];
type ReportScope = {
  filter: string;
  label: string;
};

type ManagedExpense = Expense & {
  notes?: string;
  paymentStatus?: "Paid" | "Partial" | "Pending";
  vendorId?: string;
};

export default function Reports({ data }: ReportsProps) {
  const { workspaceId } = useAuth();
  const financeData = useFinanceData(workspaceId);
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS_FILTER);
  const localTransactions = useMemo(readStoredFinanceTransactions, []);
  const activeTransactions = financeData.isSupabaseMode ? financeData.transactions : localTransactions;
  const scopedData = useMemo(() => filterReportData(data, eventFilter), [data, eventFilter]);
  const scopedTransactions = useMemo(
    () => activeTransactions.filter((transaction) => matchesEventFilter(transaction.eventId, eventFilter)),
    [activeTransactions, eventFilter],
  );
  const scope = getReportScope(data, eventFilter);
  const financials = getReportFinancials(scopedData, scopedTransactions);
  const selectedEvent = data.events.find((event) => event.id === eventFilter);
  const isFinanceLoading = financeData.isSupabaseMode && financeData.isLoading;
  const isFinanceUnavailable = financeData.isSupabaseMode && Boolean(financeData.error);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Commercial reports for organizers, partners and internal event reviews." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard icon={BadgeIndianRupee} label="Revenue" value={formatCurrency(financials.revenue)} />
        <SummaryCard icon={WalletCards} label="Expenses" value={formatCurrency(financials.expenses)} />
        <SummaryCard icon={TrendingUp} label="Net Profit" value={formatCurrency(financials.profit)} positive={financials.profit >= 0} />
      </section>

      <EventFilter events={data.events} onChange={setEventFilter} value={eventFilter} />

      <section className="glass-panel flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-app-muted">Report scope</p>
          <p className="mt-1 break-words text-sm font-medium text-white">{scope.label}</p>
        </div>
        {eventFilter === ALL_EVENTS_FILTER ? (
          <span className="inline-flex self-start rounded-full border border-app-primary/25 bg-app-primary/12 px-3 py-1.5 text-xs font-medium text-blue-100 sm:self-auto">
            All Events
          </span>
        ) : (
          <EventContextChip className="self-start sm:self-auto" event={selectedEvent} />
        )}
      </section>

      {isFinanceUnavailable && (
        <div className="rounded-lg border border-app-warning/30 bg-app-warning/10 px-4 py-3 text-sm text-amber-100">
          Finance transactions could not be loaded. Other report data remains available, and no local finance fallback was used.
        </div>
      )}
      {isFinanceLoading && (
        <div className="rounded-lg border border-app-primary/25 bg-app-primary/10 px-4 py-3 text-sm text-blue-100">
          Loading finance transactions before reports can be exported...
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          const reportData = buildReport(report.id, scopedData, scopedTransactions, data, scope);
          return (
            <article key={report.title} className="glass-panel rounded-lg p-4 sm:p-5">
              <div className="flex flex-col items-start gap-4 min-[430px]:flex-row">
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/15 text-blue-200">
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-white">{report.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{report.description}</p>
                  <p className={`mt-3 text-xs ${reportData.rows.length > 0 ? "text-slate-400" : "text-amber-200"}`}>
                    {reportData.rows.length > 0
                      ? `${formatNumber(reportData.rows.length)} report ${reportData.rows.length === 1 ? "row" : "rows"} in ${scope.label}`
                      : `No ${report.title.toLowerCase()} data for ${scope.label}.`}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ExportButton disabled={isFinanceLoading} label="PDF" icon={FileText} onClick={() => exportPdf(report.id, scopedData, scopedTransactions, data, scope)} />
                    <ExportButton disabled={isFinanceLoading} label="Excel" icon={FileSpreadsheet} onClick={() => exportCsv(report.id, scopedData, scopedTransactions, data, scope)} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="glass-panel rounded-lg p-5">
        <h2 className="text-base font-semibold text-white">Profit Formula</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FormulaTile label="Total Revenue" value={formatCurrency(financials.revenue)} helper={`Includes ${formatCurrency(getSponsorRevenue(scopedData.sponsors))} sponsor revenue and recorded income`} />
          <FormulaTile label="Total Expenses" value={formatCurrency(financials.expenses)} helper="Expense records plus recorded finance expenses" />
          <FormulaTile label="Net Profit" value={formatCurrency(financials.profit)} helper={`Revenue minus expenses for ${scope.label}`} />
        </div>
      </section>
    </div>
  );
}

function ExportButton({
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={onClick} type="button">
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, positive = false }: { icon: typeof FileText; label: string; value: string; positive?: boolean }) {
  return (
    <article className="glass-panel min-h-[126px] min-w-0 rounded-lg p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-app-muted">{label}</p>
          <p className={`mt-2 break-words text-2xl font-semibold leading-tight tracking-normal ${positive ? "text-app-success" : "text-white"}`}>{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${positive ? "border-app-success/30 bg-app-success/14 text-green-200" : "border-app-primary/30 bg-app-primary/14 text-blue-200"}`}>
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function FormulaTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function exportPdf(
  reportId: ReportId,
  data: EventOSData,
  transactions: FinanceTransactionRecord[],
  lookupData: EventOSData,
  scope: ReportScope,
) {
  const report = buildReport(reportId, data, transactions, lookupData, scope);
  const summary = buildSummaryRows(data, transactions);
  const lines = [
    "EventOS",
    report.name,
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    `Scope: ${scope.label}`,
    "",
    "Summary",
    ...summary.map(([label, value]) => `${label}: ${formatPdfText(value)}`),
    "",
    report.name,
    formatTableForPdf(
      report.headers,
      report.rows.map((row) => row.map(formatPdfText)),
      `No records found for ${scope.label}`,
    ),
  ].flat();
  downloadBlob(makePdfBlob(lines), `${report.fileBase}.pdf`);
}

function exportCsv(
  reportId: ReportId,
  data: EventOSData,
  transactions: FinanceTransactionRecord[],
  lookupData: EventOSData,
  scope: ReportScope,
) {
  const report = buildReport(reportId, data, transactions, lookupData, scope);
  const rows = [
    ["EventOS", report.name],
    ["Generated", new Date().toLocaleString("en-IN")],
    ["Scope", scope.label],
    [],
    ...buildSummaryRows(data, transactions),
    [],
    report.headers,
    ...(report.rows.length > 0 ? report.rows : [[`No records found for ${scope.label}`]]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${report.fileBase}.csv`);
}

function buildReport(
  reportId: ReportId,
  data: EventOSData,
  transactions: FinanceTransactionRecord[],
  lookupData: EventOSData,
  scope: ReportScope,
) {
  if (reportId === "revenue") {
    const categorizedEventIds = new Set(data.ticketCategories.map((ticket) => ticket.eventId));
    const ticketRows = data.ticketCategories.map((ticket) => [
      getEventName(ticket.eventId, lookupData),
      "Ticket",
      ticket.name,
      formatNumber(ticket.sold),
      formatCurrency(ticket.sold * ticket.price),
      "",
      "",
    ]);
    const legacyTicketRows = data.events
      .filter((event) => !categorizedEventIds.has(event.id) && event.ticketsSold > 0)
      .map((event) => [
        event.name,
        "Ticket",
        "Legacy ticket sales",
        formatNumber(event.ticketsSold),
        formatCurrency(event.ticketsSold * event.ticketPrice),
        "",
        "",
      ]);
    const sponsorRows = data.sponsors.map((sponsor) => [
      getEventName(sponsor.eventId, lookupData),
      "Sponsor",
      sponsor.companyName,
      "",
      "",
      formatCurrency(sponsor.sponsorshipAmount),
      "",
    ]);
    const financeRows = transactions
      .filter((transaction) => transaction.type === "Income")
      .map((transaction) => [
        getEventName(transaction.eventId, lookupData),
        "Finance Income",
        transaction.source,
        "",
        formatCurrency(transaction.amount),
        "",
        formatDate(transaction.date),
      ]);

    return {
      fileBase: "eventos-revenue-report",
      headers: ["Event", "Type", "Name / Source", "Sold", "Revenue", "Sponsor Value", "Date"],
      name: "Revenue Report",
      rows: [...ticketRows, ...legacyTicketRows, ...sponsorRows, ...financeRows],
    };
  }

  if (reportId === "expense") {
    const expenseRows = (data.expenses as ManagedExpense[]).map((expense) => [
      getEventName(expense.eventId, lookupData),
      expense.category,
      expense.description,
      getVendorName(expense.vendorId, lookupData),
      formatCurrency(expense.amount),
      expense.paymentStatus ?? "Paid",
      formatDate(expense.date),
    ]);
    const financeRows = transactions
      .filter((transaction) => transaction.type === "Expense")
      .map((transaction) => [
        getEventName(transaction.eventId, lookupData),
        `Finance - ${transaction.source}`,
        transaction.notes || "Recorded finance expense",
        "Direct Expense",
        formatCurrency(transaction.amount),
        "Recorded",
        formatDate(transaction.date),
      ]);

    return {
      fileBase: "eventos-expense-report",
      headers: ["Event", "Category", "Description", "Vendor", "Amount", "Status", "Date"],
      name: "Expense Report",
      rows: [...expenseRows, ...financeRows],
    };
  }

  if (reportId === "sponsor") {
    return {
      fileBase: "eventos-sponsor-report",
      headers: ["Event", "Company", "Contact", "Amount", "Stage", "Payment Status"],
      name: "Sponsor Report",
      rows: data.sponsors.map((sponsor) => [
        getEventName(sponsor.eventId, lookupData),
        sponsor.companyName,
        sponsor.contactPerson,
        formatCurrency(sponsor.sponsorshipAmount),
        sponsor.status,
        getSponsorPaymentStatus(sponsor),
      ]),
    };
  }

  return {
    fileBase: "eventos-profit-report",
    headers: ["Event", "Revenue", "Expenses", "Net Profit", "Profit Margin"],
    name: "Profit Report",
    rows: buildProfitRows(data, transactions, lookupData, scope),
  };
}

function buildProfitRows(
  data: EventOSData,
  transactions: FinanceTransactionRecord[],
  lookupData: EventOSData,
  scope: ReportScope,
) {
  if (!hasReportData(data, transactions)) return [];

  if (scope.filter !== ALL_EVENTS_FILTER) {
    const financials = getReportFinancials(data, transactions);
    return [[
      scope.label,
      formatCurrency(financials.revenue),
      formatCurrency(financials.expenses),
      formatCurrency(financials.profit),
      getProfitMargin(financials.revenue, financials.profit),
    ]];
  }

  const eventIds = new Set<string>();
  data.events.forEach((event) => {
    if (event.ticketsSold > 0) eventIds.add(event.id);
  });
  data.ticketCategories.forEach((ticket) => eventIds.add(ticket.eventId));
  data.sponsors.forEach((sponsor) => {
    if (sponsor.eventId) eventIds.add(sponsor.eventId);
  });
  data.expenses.forEach((expense) => {
    if (expense.eventId) eventIds.add(expense.eventId);
  });
  transactions.forEach((transaction) => {
    if (transaction.eventId) eventIds.add(transaction.eventId);
  });

  const rows = [...eventIds]
    .map((eventId) => {
      const eventData = filterReportData(data, eventId);
      const eventTransactions = transactions.filter((transaction) => transaction.eventId === eventId);
      const financials = getReportFinancials(eventData, eventTransactions);
      return [
        getEventName(eventId, lookupData),
        formatCurrency(financials.revenue),
        formatCurrency(financials.expenses),
        formatCurrency(financials.profit),
        getProfitMargin(financials.revenue, financials.profit),
      ];
    })
    .sort((left, right) => left[0].localeCompare(right[0]));

  const unassignedData = filterReportData(data, UNASSIGNED_EVENTS_FILTER);
  const unassignedTransactions = transactions.filter((transaction) => !transaction.eventId);
  if (hasReportData(unassignedData, unassignedTransactions)) {
    const financials = getReportFinancials(unassignedData, unassignedTransactions);
    rows.push([
      "Workspace-wide",
      formatCurrency(financials.revenue),
      formatCurrency(financials.expenses),
      formatCurrency(financials.profit),
      getProfitMargin(financials.revenue, financials.profit),
    ]);
  }

  return rows;
}

function buildSummaryRows(data: EventOSData, transactions: FinanceTransactionRecord[]) {
  const financials = getReportFinancials(data, transactions);
  return [
    ["Revenue", formatCurrency(financials.revenue)],
    ["Expenses", formatCurrency(financials.expenses)],
    ["Profit", formatCurrency(financials.profit)],
  ];
}

function filterReportData(data: EventOSData, filter: string): EventOSData {
  if (filter === ALL_EVENTS_FILTER) return data;

  return {
    ...data,
    artists: data.artists.filter((artist) => matchesEventFilter(artist.eventId, filter)),
    events: data.events.filter((event) => filter !== UNASSIGNED_EVENTS_FILTER && event.id === filter),
    expenses: data.expenses.filter((expense) => matchesEventFilter(expense.eventId, filter)),
    sponsors: data.sponsors.filter((sponsor) => matchesEventFilter(sponsor.eventId, filter)),
    tasks: data.tasks.filter((task) => matchesEventFilter(task.eventId, filter)),
    ticketCategories: data.ticketCategories.filter((ticket) => matchesEventFilter(ticket.eventId, filter)),
    timeline: data.timeline.filter((item) => matchesEventFilter(item.eventId, filter)),
    vendors: data.vendors.filter((vendor) => matchesEventFilter(vendor.eventId, filter)),
  };
}

function getReportScope(data: EventOSData, filter: string): ReportScope {
  if (filter === ALL_EVENTS_FILTER) return { filter, label: "All Events" };
  if (filter === UNASSIGNED_EVENTS_FILTER) return { filter, label: "Workspace-wide / Unassigned" };

  return {
    filter,
    label: data.events.find((event) => event.id === filter)?.name ?? "Unknown Event",
  };
}

function getReportFinancials(data: EventOSData, transactions: FinanceTransactionRecord[]) {
  const recordedIncome = transactions
    .filter((transaction) => transaction.type === "Income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const recordedExpenses = transactions
    .filter((transaction) => transaction.type === "Expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const revenue = getTotalRevenue(data.events, data.sponsors, data.ticketCategories) + recordedIncome;
  const expenses = getTotalExpenses(data.expenses) + recordedExpenses;

  return {
    expenses,
    profit: revenue - expenses,
    revenue,
  };
}

function getProfitMargin(revenue: number, profit: number) {
  return revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}%` : "0.0%";
}

function hasReportData(data: EventOSData, transactions: FinanceTransactionRecord[]) {
  return data.events.some((event) => event.ticketsSold > 0)
    || data.ticketCategories.length > 0
    || data.sponsors.length > 0
    || data.expenses.length > 0
    || transactions.length > 0;
}

function formatTableForPdf(headers: string[], rows: string[][], emptyMessage: string) {
  if (rows.length === 0) return [emptyMessage];
  const printableRows = [headers, ...rows];
  return printableRows.flatMap((row, index) => {
    const line = row.join(" | ");
    return index === 0 ? [line, "-".repeat(Math.min(line.length, 110))] : [line];
  });
}

function formatPdfText(value: string) {
  return value.replace(/₹\s?/g, "INR ");
}

function makePdfBlob(lines: string[]) {
  const pageHeight = 792;
  const left = 48;
  const top = 742;
  const lineHeight = 15;
  const maxLinesPerPage = 44;
  const fontSize = 11;
  const wrappedLines = lines.flatMap((line) => wrapPdfLine(line, 92));
  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += maxLinesPerPage) {
    pages.push(wrappedLines.slice(index, index + maxLinesPerPage));
  }

  const fontObjectId = 3 + pages.length * 2;
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    const content = pageLines
      .map((line, lineIndex) => `BT /F1 ${fontSize} Tf 1 0 0 1 ${left} ${top - lineIndex * lineHeight} Tm (${escapePdfText(line)}) Tj ET`)
      .join("\n");
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function wrapPdfLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line];
  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += maxLength) {
    chunks.push(line.slice(index, index + maxLength));
  }
  return chunks;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeCsvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getVendorName(vendorId: string | undefined, data: EventOSData) {
  if (!vendorId) return "Direct Expense";
  return data.vendors.find((vendor) => vendor.id === vendorId)?.name ?? "Direct Expense";
}

function getEventName(eventId: string | undefined, data: EventOSData) {
  if (!eventId) return "Workspace-wide";
  return data.events.find((event) => event.id === eventId)?.name ?? "Unknown Event";
}

function getSponsorPaymentStatus(sponsor: Sponsor) {
  return sponsor.paymentReceived ? "Paid" : "Pending";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN");
}

function readStoredFinanceTransactions() {
  try {
    const saved = localStorage.getItem("eventos-finance-transactions-v1");
    return saved ? JSON.parse(saved) as FinanceTransactionRecord[] : [];
  } catch {
    return [];
  }
}
