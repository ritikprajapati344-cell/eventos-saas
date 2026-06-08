import { BadgeIndianRupee, Download, FileSpreadsheet, FileText, TrendingUp, WalletCards } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import type { EventOSData, Expense, Sponsor } from "../types";
import { formatCurrency, formatNumber, getNetProfit, getSponsorRevenue, getTotalExpenses, getTotalRevenue } from "../utils/finance";

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

type ManagedExpense = Expense & {
  notes?: string;
  paymentStatus?: "Paid" | "Partial" | "Pending";
  vendorId?: string;
};

export default function Reports({ data }: ReportsProps) {
  const totalRevenue = getTotalRevenue(data.events, data.sponsors, data.ticketCategories);
  const totalExpenses = getTotalExpenses(data.expenses);
  const netProfit = getNetProfit(data.events, data.sponsors, data.expenses, data.ticketCategories);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Commercial reports for organizers, partners and internal event reviews." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard icon={BadgeIndianRupee} label="Revenue" value={formatCurrency(totalRevenue)} />
        <SummaryCard icon={WalletCards} label="Expenses" value={formatCurrency(totalExpenses)} />
        <SummaryCard icon={TrendingUp} label="Net Profit" value={formatCurrency(netProfit)} positive />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <article key={report.title} className="glass-panel rounded-lg p-4 sm:p-5">
              <div className="flex flex-col items-start gap-4 min-[430px]:flex-row">
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/15 text-blue-200">
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-white">{report.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{report.description}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ExportButton label="PDF" icon={FileText} onClick={() => exportPdf(report.id, data)} />
                    <ExportButton label="Excel" icon={FileSpreadsheet} onClick={() => exportCsv(report.id, data)} />
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
          <FormulaTile label="Total Revenue" value={formatCurrency(totalRevenue)} helper={`Includes ${formatCurrency(getSponsorRevenue(data.sponsors))} sponsor revenue`} />
          <FormulaTile label="Total Expenses" value={formatCurrency(totalExpenses)} helper="From venue, artist, marketing and operations" />
          <FormulaTile label="Net Profit" value={formatCurrency(netProfit)} helper="Revenue minus expenses" />
        </div>
      </section>
    </div>
  );
}

function ExportButton({ icon: Icon, label, onClick }: { icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]" onClick={onClick} type="button">
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

function exportPdf(reportId: ReportId, data: EventOSData) {
  const report = buildReport(reportId, data);
  const summary = buildSummaryRows(data);
  const lines = [
    "EventOS",
    report.name,
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    "",
    "Summary",
    ...summary.map(([label, value]) => `${label}: ${formatPdfText(value)}`),
    "",
    report.name,
    formatTableForPdf(report.headers, report.rows.map((row) => row.map(formatPdfText))),
  ].flat();
  downloadBlob(makePdfBlob(lines), `${report.fileBase}.pdf`);
}

function exportCsv(reportId: ReportId, data: EventOSData) {
  const report = buildReport(reportId, data);
  const rows = [
    ["EventOS", report.name],
    ["Generated", new Date().toLocaleString("en-IN")],
    [],
    ...buildSummaryRows(data),
    [],
    report.headers,
    ...(report.rows.length > 0 ? report.rows : [["No records found"]]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${report.fileBase}.csv`);
}

function buildReport(reportId: ReportId, data: EventOSData) {
  if (reportId === "revenue") {
    const ticketRows = data.ticketCategories.map((ticket) => [
      "Ticket",
      ticket.name,
      formatNumber(ticket.sold),
      formatCurrency(ticket.sold * ticket.price),
      "",
    ]);
    const sponsorRows = data.sponsors.map((sponsor) => [
      "Sponsor",
      sponsor.companyName,
      "",
      "",
      formatCurrency(sponsor.sponsorshipAmount),
    ]);

    return {
      fileBase: "eventos-revenue-report",
      headers: ["Type", "Name", "Sold", "Ticket Revenue", "Sponsor Revenue"],
      name: "Revenue Report",
      rows: [...ticketRows, ...sponsorRows],
    };
  }

  if (reportId === "expense") {
    return {
      fileBase: "eventos-expense-report",
      headers: ["Category", "Description", "Vendor", "Amount", "Status", "Date"],
      name: "Expense Report",
      rows: (data.expenses as ManagedExpense[]).map((expense) => [
        expense.category,
        expense.description,
        getVendorName(expense.vendorId, data),
        formatCurrency(expense.amount),
        expense.paymentStatus ?? "Paid",
        formatDate(expense.date),
      ]),
    };
  }

  if (reportId === "sponsor") {
    return {
      fileBase: "eventos-sponsor-report",
      headers: ["Company", "Contact", "Amount", "Stage", "Payment Status"],
      name: "Sponsor Report",
      rows: data.sponsors.map((sponsor) => [
        sponsor.companyName,
        sponsor.contactPerson,
        formatCurrency(sponsor.sponsorshipAmount),
        sponsor.status,
        getSponsorPaymentStatus(sponsor),
      ]),
    };
  }

  const revenue = getTotalRevenue(data.events, data.sponsors, data.ticketCategories);
  const expenses = getTotalExpenses(data.expenses);
  const profit = getNetProfit(data.events, data.sponsors, data.expenses, data.ticketCategories);
  const margin = revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}%` : "0.0%";

  return {
    fileBase: "eventos-profit-report",
    headers: ["Revenue", "Expenses", "Net Profit", "Profit Margin"],
    name: "Profit Report",
    rows: [[formatCurrency(revenue), formatCurrency(expenses), formatCurrency(profit), margin]],
  };
}

function buildSummaryRows(data: EventOSData) {
  return [
    ["Revenue", formatCurrency(getTotalRevenue(data.events, data.sponsors, data.ticketCategories))],
    ["Expenses", formatCurrency(getTotalExpenses(data.expenses))],
    ["Profit", formatCurrency(getNetProfit(data.events, data.sponsors, data.expenses, data.ticketCategories))],
  ];
}

function formatTableForPdf(headers: string[], rows: string[][]) {
  if (rows.length === 0) return ["No records found"];
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

function getSponsorPaymentStatus(sponsor: Sponsor) {
  return sponsor.paymentReceived ? "Paid" : "Pending";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN");
}
